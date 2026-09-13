# FantaHub

Builder di formazioni per **PianginaCUP (FP)** e **LaLigaCUP (PD)**: Formazione, Listone, Rose, Scambi, Calendario, Classifica, Regolamento, card Kick-off e pannelli di amministrazione separati per lega.

Pagine statiche + API serverless + dashboard React precompilata, con dati delle leghe sempre separati tramite `leagueId`.

## Sezioni pubbliche

| Route | Lega |
| --- | --- |
| `/` | Landing con scelta della lega |
| `/fp/` | PianginaCUP · Fanta Premier |
| `/pd/` | LaLigaCUP · Fanta Liga |

Ogni lega ha la propria barra sezioni con sette tab:

- **Formazione** — builder con 7 moduli (3-4-3 … 5-4-1), rosa da 22, drag & drop, slot desktop e mobile, blocco portiere unico, **Switch opzionale** (Base: stesso ruolo · Plus: ruolo diverso), card Kick-off, anteprima 9:16 e testo formazione copiabile.
- **Listone** — tabella React con filtri per ruolo/quotazione, righe desktop e card mobile, board disciplinare.
- **Rose** — card delle fantasquadre, ruoli per sezione e caricamento **stemmi** via codice squadra (senza password admin).
- **Scambi** — compositore React con selezione giocatori, controllo dell'equilibrio dei ruoli, trasferimento crediti e riepilogo copiabile.
- **Calendario** — documento HTTPS configurabile per lega; i Google Docs pubblicati passano dal proxy same-origin con sandbox CSP. Non è il vecchio sistema di giornate/partite rimosso dal runtime.
- **Classifica** — tabella con penalità inline dal CSV.
- **Regolamento** — documento HTTPS configurabile per lega; i Google Docs pubblicati usano lo stesso proxy sandboxed del Calendario.

La **Formazione** resta intenzionalmente nel runtime JavaScript vanilla. Listone, Rose, Scambi e Classifica sono React/TypeScript; Calendario e Regolamento sono viste della shell che caricano i rispettivi documenti pubblicati. Le tab documentali senza URL configurato restano nascoste.

Le formazioni salvate restano nel `localStorage` con scope per lega.

## Pannelli Admin Links

- `/fp/admin-links/`
- `/pd/admin-links/`

Separati per lega, stessa password (`ADMIN_LINKS_PASSWORD_HASH`). Da ciascun pannello:

- aggiornare CSV Listone/Rose e Classifica della sola lega;
- aggiornare i Docs pubblicati di Richiami/Penalizzazioni, Regolamento e Calendario;
- generare/resettare i codici stemma delle fantasquadre;
- ricalcolare le associazioni Listone ↔ rose BSD e salvare in Neon gli override;
- migrazione legacy una tantum **Blob → Neon** (sola lettura dal Blob).

## Foto giocatori e fonti

- Dati fantacalcistici (ruolo, quotazione, proprietario) **solo** dal CSV ufficiale della lega.
- Le nuove associazioni servono facce direttamente da BSD (`https://sports.bzzoiro.com/img/player/<id>/`): il backend calcola il manifest in memoria (matching per nome e club, mai per ruolo BSD), lo restituisce al browser e lo cachea in Neon per 6 ore. I riferimenti Blob legacy già verificati restano leggibili. Lazy loading sul client.
- Nessuna nuova faccia viene scritta nel Blob: nessun cron, job o staging media.
- I crest reali arrivano esclusivamente dalla card Kick-off.

## Architettura

- **Frontend**: shell e Formazione in JS vanilla (`js/`) + Listone, Rose, Scambi e Classifica in React/TypeScript (`dashboard/src/`), compilati in `assets/dashboard/` — gli asset generati si aggiornano solo con `npm run build`.
- **API**: endpoint serverless Vercel in `api/` con logica condivisa in `lib/` (moduli CJS): settings, admin/auth, team-logo, player-media, player-photo, discipline, crest e proxy Regolamento/Calendario con i relativi asset immagine.
- **Persistenza**: Neon è la sorgente runtime autorevole (impostazioni, fantasquadre, codici, stemmi, override BSD, cache manifest). Il Vercel Blob non riceve nuove scritture: resta fonte di migrazione e compatibilità in lettura per riferimenti media legacy già verificati.
- **Dettagli e vincoli**: `docs/ARCHITECTURE.md`.

## Struttura

```text
api/                  Endpoint serverless Vercel
assets/dashboard/     Bundle React generato (non modificare a mano)
css/  js/             Fogli stile e moduli della shell storica
dashboard/            App React (Listone, Rose, Scambi, Classifica) + test Vitest
data/                 Fallback statici: classifica.csv, teams.json, settings.json, seed BSD
docs/                 ARCHITECTURE, DEBUGGING, audit
fp/  pd/              Route pubbliche generate da scripts/generate-route-pages.mjs
lib/                  Logica condivisa delle API (CJS)
scripts/              Dev server, diagnosi, generazione route, check statico
tests/                Suite Node (node --test)
vercel.json           Header, rewrite e configurazione build
```

## Avvio locale

Prerequisiti: **Node.js 20 o successivo**, npm, Bash e Python 3.

Creare `.env.local` nella root (senza prefisso `VITE_`, la chiave resta server-side):

```env
BSD_API_KEY=token_bsd
DATABASE_URL=connessione_neon
```

Poi:

```bash
npm ci
npm --prefix dashboard ci
npm run verify
npm run dev:test     # password admin locale: prova123
```

Indirizzi abituali (la porta è quella stampata dal Terminale se 4173 è occupata):

```text
http://localhost:4173/fp/
http://localhost:4173/pd/
http://localhost:4173/fp/admin-links/
http://localhost:4173/pd/admin-links/
```

Il server locale ascolta `127.0.0.1` per impostazione predefinita. Impostare `HOST` esplicitamente solo quando serve esporlo sulla rete locale.

## Verifica

```bash
npm run verify
```

Esegue nell'ordine:

1. rigenerazione delle route statiche FP/PD;
2. typecheck TypeScript del codice di produzione;
3. typecheck TypeScript separato dei test;
4. build dashboard, che ripete il typecheck di produzione e poi esegue Vite senza source map pubbliche;
5. test Node (`tests/*.test.cjs`);
6. test UI Vitest (`dashboard`);
7. diagnosi del repository;
8. controllo statico (`scripts/check-static.sh`), incluso controllo route generate, sintassi, asset pubblici e `git diff --check`.

## Variabili Vercel

| Variabile | Uso |
| --- | --- |
| `ADMIN_LINKS_PASSWORD_HASH` | Password dei pannelli Admin Links |
| `ADMIN_LINKS_SESSION_SECRET` | Firma della sessione admin |
| `BSD_API_KEY` | Token sorgente foto giocatori |
| `DATABASE_URL` | Connessione Neon (altre variabili Neon aggiunte da Vercel) |

Le credenziali Blob servono solo durante la migrazione legacy, poi sono rimovibili.

## Documentazione correlata

- `docs/ARCHITECTURE.md` — confini del prodotto e vincoli invarianti
- `docs/DEBUGGING.md` — debug locale e verifica API
- `docs/MERGE_AUDIT.md` — audit pre-merge delle funzioni principali
- `RELEASE_NOTES_BSD.md` — flusso foto BSD, matching e Neon
- `RESET_ESSENZIALE.md` — perimetro del reset: cosa è stato rimosso (calendario, giornate, voti, admin legacy)
