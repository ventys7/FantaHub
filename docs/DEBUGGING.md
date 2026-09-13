# Debug locale

FantaHub è composto da pagine statiche, API serverless locali e dashboard React precompilata.

## Preparazione

```bash
node --version # deve essere >= 20
npm ci
npm --prefix dashboard ci
npm run verify
```

La verifica richiede anche npm, Bash e Python 3.

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

Per sicurezza ascolta solo `127.0.0.1`. `HOST` cambia esplicitamente il bind; per esempio `HOST=0.0.0.0 npm run dev:test` espone il server alla rete e va usato solo in un ambiente fidato. Il server non serve dotfile, file del repository fuori dall'allowlist pubblica o runtime privato; l'unica eccezione runtime pubblica è `/.lineup-runtime/player-images/`.

## Fonti e persistenza

- CSV Listone/Rose, Classifica e Docs disciplinare: configurati da Admin Links e salvati in Neon.
- Nuove associazioni foto: URL BSD diretti; riferimenti Blob legacy verificati ancora leggibili, nessun nuovo upload Blob.
- Override BSD, profili, codici e stemmi: Neon.
- Crest dei club reali: infrastruttura Kick-off.
- Blob: sola lettura per migrazione e riferimenti media legacy già verificati.

## Test mirati

Usare il gruppo più vicino al problema prima di lanciare l'intera verifica.

### Route, deploy e server statico

```bash
node --test tests/routes-diagnostics.test.cjs tests/deployment-surface.test.cjs tests/dev-server.test.cjs
node scripts/generate-route-pages.mjs --check
```

### Neon: quota, lease, throttle e scritture atomiche

```bash
node --test tests/neon-quota.test.cjs tests/neon-refresh-lease.test.cjs tests/neon-auth-throttle.test.cjs tests/neon-settings-atomic.test.cjs tests/neon-runtime.test.cjs tests/player-media-atomic.test.cjs tests/settings.test.cjs tests/settings-api.test.cjs tests/admin-api.test.cjs tests/logo-access.test.cjs tests/team-logo-api.test.cjs tests/team-profile-name.test.cjs
```

### Fetch configurabili, proxy Google, raster, migrazione e storage

```bash
node --test tests/safe-fetch.test.cjs tests/listone.test.cjs tests/discipline.test.cjs tests/google-docs-proxy.test.cjs tests/crest.test.cjs tests/migrate-neon.test.cjs tests/storage.test.cjs
```

### Media BSD, cache, FaceBridge e quota API

```bash
node --test tests/bsd-resilience.test.cjs tests/bsd-quota.test.cjs tests/face-bridge.test.cjs tests/player-media-refresh-api.test.cjs tests/player-media-refresh-steps.test.cjs tests/player-media-season-roster.test.cjs
```

### Formazione vanilla e compatibilità draft

```bash
node --test tests/formation-runtime-ownership.test.cjs tests/formation-model.test.cjs tests/formation-interactions.test.cjs tests/csv-formation-db.test.cjs tests/csv-parser.test.cjs tests/gk-blocks.test.cjs tests/switch-state.test.cjs tests/switch-modals.test.cjs
```

### Bootstrap CSV, Admin e story preview

```bash
node --test tests/runtime-settings.test.cjs tests/csv-load-errors.test.cjs tests/csv-parser.test.cjs tests/admin-ui.test.cjs tests/admin-api.test.cjs tests/output-story-final-ui.test.cjs
```

### React: bootstrap, Listone, Rose, Scambi e accessibilità

```bash
npm --prefix dashboard run test:ui -- src/main.test.tsx src/pages/Players.test.tsx src/components/GoalkeeperBlock.test.tsx src/components/teams/buildSquads.test.ts src/components/teams/TeamCard.test.tsx src/components/teams/SquadRoleSection.selectable.test.tsx
npm --prefix dashboard run test:ui -- src/trade/tradeModel.test.ts src/trade/TradesView.test.tsx src/trade/TradeSummaryModal.test.tsx
npm --prefix dashboard run test:ui -- src/StandingsApp.test.tsx src/standings.test.ts src/runtimeSettings.test.ts src/logoUpload.test.ts src/styles/responsive.test.ts
npm --prefix dashboard run typecheck
npm --prefix dashboard run test:types
```

## Quota media: distinguere 429 da 502

Le azioni one-shot `sync-missing`, `full-sync` e `continue-full-sync` restituiscono `429` quando la quota BSD è esaurita. La risposta espone soltanto `{ quotaExhausted: true, quota }` canonico e l'header `Retry-After`; un reset non valido viene ricondotto alla prossima mezzanotte UTC. Gli errori ordinari del provider restano `502`.

Le azioni a step `refresh` e `continue-sync` continuano invece a restituire `200` con il proprio stato pending/terminale. Per una regressione mirata:

```bash
node --test tests/player-media-refresh-api.test.cjs tests/bsd-quota.test.cjs tests/player-media-refresh-steps.test.cjs
```

## Verifica da stato generato pulito

Questa procedura rimuove **solo** output ignorati e rigenerabili. Prima verificare che Git li riconosca come ignorati:

```bash
git check-ignore assets/dashboard fp/index.html pd/index.html
node -e "const fs=require('node:fs'); for (const p of ['assets/dashboard','fp/index.html','pd/index.html']) fs.rmSync(p,{recursive:true,force:true})"
npm run verify
node scripts/generate-route-pages.mjs --check
git status --short
```

Al termine devono esistere `assets/dashboard/dashboard.js`, `assets/dashboard/dashboard.css`, `fp/index.html` e `pd/index.html`; non deve esistere alcun `.map` pubblico. Gli output ignorati non devono comparire in `git status`, e `.serena/`, `.swarm/`, `scripts/_exp1.cjs`, `scripts/_exp2.cjs` devono restare non staged.

## Controlli prima del push

```bash
npm run verify
git diff --check
git status
```

`npm run verify` esegue nell'ordine: rigenerazione route, typecheck produzione, typecheck test, build (secondo typecheck produzione + Vite), test Node, Vitest, diagnosi e controllo statico. La build precede i test Node così la verifica parte correttamente anche senza bundle generati; l'ultimo passaggio ricontrolla route, sintassi, assenza di source map pubbliche e `git diff --check`.
