# FantaHub

Builder di formazioni per **PianginaCUP (FP)** e **LaLigaCUP (PD)**: Formazione, Listone, Rose, Classifica, card Kick-off e pannelli di amministrazione separati per lega.

Pagine statiche + API serverless + dashboard React precompilata, con dati delle leghe sempre separati tramite `leagueId`.

## Sezioni pubbliche

| Route | Lega |
| --- | --- |
| `/` | Landing con scelta della lega |
| `/fp/` | PianginaCUP · Fanta Premier |
| `/pd/` | LaLigaCUP · Fanta Liga |

Ogni lega ha la propria barra sezioni con quattro tab:

- **Formazione** — builder con 7 moduli (3-4-3 … 5-4-1), rosa da 22, drag & drop, slot desktop e mobile, blocco portiere unico, **Switch opzionale** (Base: stesso ruolo · Plus: ruolo diverso), card Kick-off, anteprima 9:16 e testo formazione copiabile.
- **Listone** — tabella React con filtri per ruolo/quotazione, righe desktop e card mobile, board disciplinare.
- **Rose** — card delle fantasquadre, ruoli per sezione e caricamento **stemmi** via codice squadra (senza password admin).
- **Classifica** — tabella con penalità inline dal CSV.

Le formazioni salvate restano nel `localStorage` con scope per lega.

## Pannelli Admin Links

- `/fp/admin-links/`
- `/pd/admin-links/`

Separati per lega, stessa password (`ADMIN_LINKS_PASSWORD_HASH`). Da ciascun pannello:

- aggiornare CSV Listone/Rose e Classifica della sola lega;
- aggiornare il Docs pubblicato di Richiami/Penalizzazioni;
- generare/resettare i codici stemma delle fantasquadre;
- ricalcolare le associazioni Listone ↔ rose BSD e salvare in Neon gli override;
- migrazione legacy una tantum **Blob → Neon** (sola lettura dal Blob).

## Foto giocatori e fonti

- Dati fantacalcistici (ruolo, quotazione, proprietario) **solo** dal CSV ufficiale della lega.
- Facce servite direttamente da BSD (`https://sports.bzzoiro.com/img/player/<id>/`): il backend calcola il manifest in memoria (matching per nome e club, mai per ruolo BSD), lo restituisce al browser e lo cachea in Neon per 6 ore. Lazy loading sul client.
- Nessuna faccia finisce nel Blob: nessun cron, job o staging media.
- I crest reali arrivano esclusivamente dalla card Kick-off.

## Architettura

- **Frontend**: shell storica in JS vanilla (`js/`) + dashboard React/TypeScript (`dashboard/src/`), compilata in `assets/dashboard/` — gli asset generati si aggiornano solo con `npm run build`.
- **API**: endpoint serverless Vercel in `api/` con logica condivisa in `lib/` (moduli CJS): settings, admin/auth, team-logo, player-media, player-photo (proxy same-origin per il canvas), discipline.
- **Persistenza**: Neon è l'unica sorgente runtime (impostazioni, fantasquadre, codici, stemmi, override BSD, cache manifest). Il Vercel Blob esiste solo per la migrazione legacy.
- **Dettagli e vincoli**: `docs/ARCHITECTURE.md`.

## Struttura

```text
api/                  Endpoint serverless Vercel
assets/dashboard/     Bundle React generato (non modificare a mano)
css/  js/             Fogli stile e moduli della shell storica
dashboard/            App React (Listone, Rose, Classifica) + test Vitest
data/                 Fallback statici: classifica.csv, teams.json, settings.json, seed BSD
docs/                 ARCHITECTURE, DEBUGGING, audit
fp/  pd/              Route pubbliche generate da scripts/generate-route-pages.mjs
lib/                  Logica condivisa delle API (CJS)
scripts/              Dev server, diagnosi, generazione route, check statico
tests/                Suite Node (node --test)
vercel.json           Header, rewrite e configurazione build
```

## Avvio locale

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

## Verifica

```bash
npm run verify
```

Esegue nell'ordine: test Node (`tests/*.test.cjs`), test UI Vitest (`dashboard`), typecheck + build Vite, rigenerazione route statiche, diagnosi e controllo statico (`scripts/check-static.sh`), incluso `git diff --check`.

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
