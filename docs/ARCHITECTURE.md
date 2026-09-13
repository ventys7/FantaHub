# Architettura essenziale

## Confini del prodotto

FP e PD condividono codice e schema, ma fonti, profili, codici, stemmi, override, cache manifest e checkpoint restano separati tramite `leagueId`. Cache del provider BSD e quota giornaliera sono invece condivise. La sessione Admin è condivisa tra i due pannelli; ogni operazione porta comunque la lega esplicita. Il ruolo fantacalcistico e le quotazioni arrivano esclusivamente dal CSV ufficiale della lega; BSD fornisce identità sportive e foto, non decide i ruoli fantasy.

## Proprietà del frontend

- `fp/` e `pd/` sono shell pubbliche generate dalla stessa base; non si modificano a mano.
- `js/` possiede la Formazione e la navigazione della shell. Formazione resta vanilla e conserva i draft `lineup-fp:draft` / `lineup-pd:draft` versione 1.
- `dashboard/src/` possiede Listone, Rose, Scambi e Classifica in React/TypeScript. Rose, Scambi e Classifica vengono montate al primo accesso; Listone è montato all'avvio.
- Calendario e Regolamento sono viste della shell per documenti HTTPS configurabili, non componenti della futura migrazione React. I Google Docs pubblicati usano il proxy same-origin; gli altri URL HTTPS vengono caricati direttamente nell'iframe.
- `assets/dashboard/` contiene il bundle generato da Vite e non va modificato a mano.
- `fp/admin-links/` e `pd/admin-links/` condividono la logica ma operano sempre sulla lega esplicita.

La migrazione completa della Formazione a React resta lavoro futuro descritto in `docs/V2_PLAN.md`: il runtime pragmatico attuale non contiene un secondo proprietario React della Formazione.

## Deploy e server locale

Il deploy usa la root del repository come output e `.vercelignore` ne esclude file ambiente, runtime locale, directory degli agenti, test, documentazione interna, script sperimentali e source map. `dashboard/vite.config.js` mantiene inoltre `build.sourcemap: false`.

`scripts/dev-server.mjs`:

- ascolta `127.0.0.1` per impostazione predefinita; `HOST` è un opt-in esplicito all'esposizione di rete;
- serve soltanto root, directory pubbliche note, dati statici FP/PD e immagini giocatore sotto `/.lineup-runtime/player-images/`;
- rifiuta dotfile, traversal, percorsi fuori root e fughe tramite symlink dopo `realpath`;
- disabilita la cache in sviluppo, eccetto le immagini runtime immutabili;
- espone localmente lo stesso insieme finito di API del deploy.

## Superficie API

- `api/settings.js`: configurazione pubblica per lega.
- `api/admin.js`: sessione admin, impostazioni, codici e migrazione legacy.
- `api/team-logo.js`: profilo e stemma fantasquadra in Neon.
- `api/player-media.js`: manifest BSD, stato/refresh, manutenzione media, ricerca e override manuali.
- `api/player-photo.js`: proxy raster same-origin per i flussi canvas.
- `api/crest.js`: proxy raster dei crest Kick-off; SVG attivo è rifiutato.
- `api/discipline.js`: parser e cache del documento Richiami/Penalizzazioni.
- `api/regolamento.js` e `api/calendario.js`: proxy HTML dei documenti Google pubblicati.
- `api/regolamento-img.js` e `api/calendario-img.js`: proxy limitati agli asset immagine Google associati.

## Persistenza e concorrenza

Neon è l'autorità runtime in produzione per impostazioni, fantasquadre, codici, stemmi, override BSD, quota, throttle, checkpoint e cache manifest. Nessuna scrittura di produzione ripiega sul Blob; il Blob resta fonte di migrazione e compatibilità in lettura per riferimenti media legacy già verificati.

Le operazioni concorrenti usano confini stretti:

- la quota BSD giornaliera viene letta/incrementata con statement atomici e riparte sulla nuova data UTC senza perdere chiamate già registrate;
- i refresh media acquisiscono un lease per lega con proprietario e token monotono, lo rinnovano durante il lavoro e subordinano checkpoint, override e pubblicazione al token ancora attivo;
- pubblicazione del manifest e cancellazione del checkpoint avvengono atomicamente; una lega già occupata non avvia nuova rete, mentre un worker diventato stale non può più scrivere o pubblicare anche se il lavoro di rete già in corso termina;
- i throttle admin/codice squadra sono persistenti tra istanze serverless, atomici, limitati a cinque errori in quindici minuti e isolati per scopo, lega, squadra/client; un successo azzera solo il bucket verificato;
- gli aggiornamenti impostazioni sono ristretti alla lega richiesta; profilo e stemma di una squadra usano una transazione, non sovrascrivono altre squadre e un indice Neon impedisce alias duplicati dopo normalizzazione di accenti, spazi e maiuscole.

Le impostazioni, l'autenticazione e le scritture identità che richiedono Neon in produzione non ripiegano su storage meno autorevole quando il database o un controllo durevole fallisce. Gli errori del backend di throttle vengono nascosti dietro un `503` generico. La pipeline media conserva invece una modalità process-local per quota, cache e checkpoint quando Neon manca: è utile in locale ma non è durevole né condivisa tra istanze serverless, quindi il deploy supportato richiede `DATABASE_URL`.

## Richieste in uscita e documenti Google

`lib/safe-fetch.cjs` è il confine per le fonti configurabili scaricate dal backend e per le immagini legacy remote. Accetta soltanto HTTPS senza credenziali, rifiuta hostname/IP locali o riservati, verifica tutte le risposte DNS e pinna l'indirizzo approvato alla richiesta. Ogni redirect viene rivalidato; deadline complessiva, MIME consentiti, `Content-Length` e byte realmente letti sono limitati. Non governa gli URL HTTPS non Google caricati direttamente negli iframe Calendario/Regolamento.

I Google Docs pubblicati hanno un confine più stretto in `lib/google-docs-session.cjs`:

- solo URL pubblicati e asset su `docs.google.com`, con redirect manuali rivalidati;
- cookie temporanei isolati per tipo documento e lega;
- HTML e immagini letti come stream con limiti distinti e MIME consentiti;
- URL immagine riscritti verso il proxy same-origin;
- risposta HTML con `Content-Security-Policy: sandbox`.

L'HTML Google attraversato dal proxy è **sandboxed, non sanitizzato**: il browser ne blocca le capacità attive tramite CSP invece di affidarsi a una trasformazione parziale del markup. Un URL HTTPS non Google configurato per Calendario o Regolamento viene invece caricato direttamente nell'iframe e non riceve questa CSP dal proxy FantaHub.

## Immagini e media BSD

- Gli upload stemma verificano base64 canonico, dimensione e firma binaria coerente per PNG/JPEG/WebP prima della persistenza; il client rifiuta inoltre dimensioni decodificate estreme prima di allocare il canvas.
- I crest Kick-off e le foto proxate accettano soltanto raster approvati e applicano limiti sia dichiarati sia sui byte stream; SVG non viene restituito.
- Le nuove associazioni usano URL BSD diretti; riferimenti Blob legacy già verificati restano leggibili. Cache e checkpoint sono in Neon e nessuna faccia riceve nuove scritture Blob.
- Cache trasferimenti, ricerche e stagioni vengono potate quando malformate o scadute. Snapshot sovrapposti nello stesso worker sono serializzati; worker distinti usano una CAS sulla versione PostgreSQL della riga e ritentano il merge. Una persistenza fallita resta pending fino a conferma.
- I miss FaceBridge scadono e diventano ritentabili; nel refresh a step il limite per batch non permette di pubblicare finché tutti i candidati non sono stati processati.
- Configurazioni numeriche di quota, TTL e budget accettano soltanto valori finiti entro limiti dichiarati, altrimenti usano default sicuri.

## Migrazione e fallback locale

La migrazione legacy Blob/runtime → Neon è riavviabile e idempotente. FP e PD vengono riportate separatamente, ma il marker finale viene scritto solo quando entrambe riescono; i retry inseriscono solo fantasquadre mancanti e non sovrascrivono profili aggiornati nel frattempo. Errori transitori lasciano il lavoro ritentabile; immagini remote con URL/MIME non ammessi e loghi mancanti, illeggibili o troppo grandi producono warning e non persistono né byte né riferimenti pericolosi.

Fuori da Vercel, `.lineup-runtime` è il fallback locale. Le letture JSON distinguono file assente (fallback clonato) da contenuto malformato (errore). Le scritture JSON per chiave sono serializzate, usano file temporanei privati nella stessa directory, preservano i permessi esistenti, rinominano atomicamente e ripuliscono il temporaneo anche in errore.

## Vincoli invarianti

1. FP e PD non condividono dati applicativi di lega; quota giornaliera e cache del provider BSD sono infrastruttura condivisa.
2. Formazione ha un solo proprietario vanilla e i draft versione 1 restano compatibili.
3. Il browser non avvia sincronizzazioni o scritture media automatiche.
4. Nessuna scrittura runtime ripiega sul Blob in produzione.
5. Le fonti configurabili scaricate dal backend attraversano un trasporto con validazione SSRF, MIME, byte e timeout; gli iframe HTTPS esterni sono esclusi da questo confine.
6. Gli asset e le route generate cambiano soltanto tramite gli script di build/generazione.

## Debito tecnico non bloccante

La pipeline media è già separata sotto `lib/media/`, ma `lib/media/manifest-state.cjs` resta il coordinatore principale di matching, cache, diagnostica e compatibilità legacy. Un ulteriore refactor va motivato da un problema misurato: non è un prerequisito della futura migrazione React.
