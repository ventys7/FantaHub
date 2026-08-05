# Debug locale

FantaHub è composto da pagine statiche, API serverless locali e dashboard React precompilata.

## Preparazione

```bash
npm ci
npm --prefix dashboard ci
npm run verify
```

Per provare anche Admin Links e le API, creare `.env.local` nella root:

```env
BSD_API_KEY=token_bsd
DATABASE_URL=connessione_neon
```

Le credenziali non devono mai usare il prefisso `VITE_` e non devono essere committate.

## Avvio

```bash
npm run dev:test
```

La password locale è `prova123`. Il server stampa la porta effettiva, normalmente `4173`.

- `http://localhost:4173/fp/`
- `http://localhost:4173/pd/`
- `http://localhost:4173/fp/admin-links/`
- `http://localhost:4173/pd/admin-links/`

Il server locale disabilita la cache per facilitare il debug.

## Fonti e persistenza

- CSV Listone/Rose, Classifica e Docs disciplinare: configurati da Admin Links e salvati in Neon.
- Foto giocatori: URL BSD diretti; nessun upload Blob.
- Override BSD, profili, codici e stemmi: Neon.
- Crest dei club reali: infrastruttura Kick-off.
- Blob: soltanto lettura legacy durante la migrazione una tantum.

## Controlli prima del push

```bash
npm run verify
git diff --check
git status
```

`npm run verify` esegue diagnosi, test Node, typecheck/build Vite, rigenerazione delle route e controlli statici.
