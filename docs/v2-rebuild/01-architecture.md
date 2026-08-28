# Blueprint di Architettura — FantaHub app React unificata (V2)

> Scope: **solo design**. Nessun file applicativo viene creato/modificato da questo documento. Tutti i riferimenti `file:line` sono verificati sull'albero attuale.

## (a) Pattern attuali trovati (`file:line`)

**1. Stato globale mutabile condiviso per implicito (anti-pattern portante).**
- `js/state.js:2-8` definisce `currentManager`, `selectedPlayers`, `slotAssignments`, `draggedPlayerIndex`, `isMobile` come `let` di modulo → letti/scritti da ogni altro modulo senza passaggio esplicito.
- `js/formation-model.js:82-90` `build()` legge `db[currentManager]` e le variabili di `state.js` (non è "pura" nonostante il nome).
- `js/switch-state.js:9-11` `getTeam()` legge `db[currentManager]?.players`; `js/gk-blocks.js:5-7` legge `db`, `selectedPlayers`, `disabledBlocks` (anch'esso dipendente da globals).
- `js/formation-model.js:8` `getModuleValue()` legge `document.getElementById("moduleSelect")?.value` → side-effect su DOM dentro la "logica pura".

**2. Bridge shell→dashboard via global + CustomEvent (polling a cascata).**
- `js/csv.js:10-14` espone `window.LineupLeagueData = { getAssets, getState, refresh }`.
- `js/csv.js:24-32` `dispatchLeagueAssetsReady()` emette `lineup:league-assets-ready` con `{leagueId, assets, state}`.
- `dashboard/src/hooks.ts:11-40` `useLeagueAssets` fa un **polling ogni 300 ms per 20 tentativi** (`sync()`) + listener evento → waterfall evitabile, re-render spurii.
- `dashboard/src/main.tsx:45-48` monta Rose/Scambi/Classifica solo al primo `lineup:league-section-change` (lazy manuale).

**3. Tema per lega via CSS vars impostate imperativamente + hardcoded.**
- `js/router.js:50-54` setta `--primary/--primary-light/--primary-bg/--primary-border/--bg` da `league.theme` (origine in `js/config.js:21-27` FP, `:49-55` PD).
- Viola **hardcoded** fuori dal tema: `css/formation-clean.css:1166` e `js/story.js:294-297` (gradiente maglia `rgba(151,92,246,...)` fissi, non derivati dal primary lega).
- `js/story.js:7-12` `ROLE_COLORS` (P oro/D blu/C verde/A rosso) duplicati sia in canvas che (implicitamente) nell'UI.

**4. Contratto tab/sezione shell.**
- `js/league-dashboard.js:27-53` `activateSection` toggle `data-league-view[hidden]`, setta `document.documentElement.dataset.leagueSection`, dispatcia `lineup:league-section-change`.
- Radici React già presenti in `index.html:257-269` (`league-dashboard-root`, `league-rose-root`, `league-trades-root`, `league-standings-root`).

**5. Persistenza retrocompatibile.**
- `js/persistence.js:15-23` prefisso `lineup-${leagueId}`; `STORAGE_VERSION=1`; snapshot `{manager, module, selectedPlayerIds, slotAssignments, switch}` (`persistence.js:86-98`); restore in `restoreAfterCsv` (`:144-216`).

**6. Moduli già puri/riusabili (no globals):**
- `js/csv-parser.js` (UMD: `module.exports` + `window.LineupCsvParser`, `:1-6`), `js/csv-formation-db.js` (`:1-39`, `buildFormationDb`), `js/formation-constants.js:1-2` (`ALLOWED_MODULES`, `MAX_SELECTED`).
- `js/player-media.js` (factory `LineupPlayerMedia`, cache localStorage `CACHE_VERSION=13`, fetch `/api/player-media`), `js/fixtures.js` (cache Kick-off 24h, `KICKOFF_LEAGUE_IDS`, refresh 30s).

**7. Canvas story come funzione quasi-pura.**
- `js/story.js:557-587` `renderCanvas(model)` prende un `model` e disegna; dipende solo da `window.LineupPlayerMedia`/`LineupKickoffClubs` per le foto. `open()` (`:619`) usa `canvas.toBlob` + `URL.createObjectURL` per preview/share.

## (b) Decisione architetturale + trade-off

### Decisione 1 — Bridge: **sostituire il ponte `window.Lineup*` + CustomEvent con un contratto esplicito React (Context + hook), con shim di compatibilità strangolatore.**
- **Raccomando: sì, sostituire.** Il bridge attuale costringe la dashboard a un *polling 300 ms × 20* (`hooks.ts:21`) e rende "impure" le logiche di dominio (leggono globals). Un `LeagueProvider`/`FormationProvider` con `useLeagueData()` deduplicato (SWR/React Query) elimina il waterfall e i re-render spurii.
- **Trade-off accettato:** durante la migrazione phased servono due fonti di verità. Mitigo con `bridge/legacyBridge.ts` (vedi §d) che *ria pubblica* lo stato del context su `window.LineupLeagueData` e dispaccia `lineup:league-assets-ready`, così `dashboard/src/main.tsx` e `admin-links` continuano a funzionare inalterati finché non vengono assorbiti nell'app unica. Lo shim è marcato `@deprecated` e rimosso all'ultima fase.

### Decisione 2 — Tema: **unica sorgente `theme/tokens.ts`** (FP viola `#7c3aed`, PD rosso `#b91c1c`) + `ThemeProvider` che inietta le CSS vars su `:root`.
- Centralizza i valori oggi duplicati in `js/config.js:21-55` e **rimuove l'hardcode viola** di `css/formation-clean.css:1166` e `js/story.js:294-297` passando `theme.kitGradient` derivato dal `primary` lega al canvas. `roleColors` diventa `theme/roleColors.ts` condiviso da story + UI. Nessun colore lega hardcoded in componenti.

### Decisione 3 — Routing: **SPA React unica, routing per lega + tab come sezioni client-side**, mantenendo gli shell statici `fp/index.html`/`pd/index.html`.
- Rotte: `/` (landing FP/PD), `/:leagueId` (`fp|pd`) con sezioni annidate `formation|listone|rose|classifica|scambi`. `vercel.json` (rewrites, `:507-530`) e `scripts/generate-route-pages.mjs` restano **INV** (V2_PLAN §1.1 INV). Gli shell statici iniettano `<script>window.__LINEUP_LEAGUE__="fp"</script>` così `ThemeProvider` applica il tema **prima del paint** (niente flash). Tab = cambio sezione client-side senza reload (sostituisce `league-dashboard.js`).

### Decisione 4 — Formazione = **PORT FEDELE** (non "sminchiata"): la garanzia di parità è **riuso algoritmico**, non re-implementazione.
- I dati di stato React (`currentManager`, `selectedPlayers:number[]`, `slotAssignments:Record<string,number>`, `switch{starterIndex,benchIndex,plus}`, `disabledBlocks:Set`, `module`) hanno **lo stesso shape** dei globals vanilla. `domain/formation/model.ts#build()` è il `formation-model.js:81-170` portato 1:1 (stesse mappe `starter/bench`, stessa `goalkeeperBenchLabels`, stesso `changedAssignments`), ma con input espliciti invece di leggere globals. `output.buildOutputText` e `story.renderCanvas` vengono riusati tali e quali → testo 9:16 e canvas identici.
- Drag&drop: stessa semantica di `js/dragdrop.js` (slot↔slot, roster↔slot) in `<FormationField>` con HTML5 DnD. Switch: `switchState.ts` riusato, `SwitchPicker` speculare a `js/switch-modals.js` (faccette + ✕ clear). Kick-off: `KickoffCard.tsx` dalla logica `js/fixtures.js`.

### Decisione 5 — Stato: **`FormationProvider` (reducer) + selettore memoizzato `useFormationModel()`**.
- Ogni azione utente (seleziona, assegna slot, switch, reset) è una `dispatch` del reducer; `useFormationModel()` = `useMemo(() => build(state), [deps])`. Così il rendering deriva sempre dallo stesso `build()` testato → parità comportamentale garantita a monte.

## (c) Design componenti/moduli

### `src/theme/`
- **`tokens.ts`** — `LEAGUE_THEME: Record<'fp'|'pd', ThemeTokens>` (copia esatta di `js/config.js:21-55`), `ThemeTokens = {primary, primaryLight, primaryBg, primaryBorder, background, kitGradient, crestAccent}`. Unica sorgente tema.
- **`roleColors.ts`** — `ROLE_COLORS` da `js/story.js:7-12` (`P/D/C/A` → fill/ink), condiviso canvas+UI.
- **`ThemeProvider.tsx`** — `useEffect` che scrive le CSS vars su `document.documentElement` da `leagueId`; espone `useTheme()`.

### `src/domain/` (logica pura, input espliciti, no globals, no DOM)
- **`csv/parser.ts`** — port di `js/csv-parser.js`: `parseLeagueCsv(text): {assets, creditsByManager}`.
- **`csv/formationDb.ts`** — port di `js/csv-formation-db.js`: `buildFormationDb(assets): Record<manager,{players}>`.
- **`formation/constants.ts`** — `ALLOWED_MODULES`, `MAX_SELECTED`, `ROLE_ORDER`, `BENCH_CAPACITY` (da `js/formation-constants.js`, `js/formation-model.js:4-5`).
- **`formation/model.ts`** — `build(input: FormationBuildInput): FormationModel` (port 1:1 di `js/formation-model.js:81-170`); `getSlotDefinitions`, `getBenchDisplayEntry`, `getSwitchLineup`. `FormationBuildInput = { team, module, selectedIndices, slotAssignments }`.
- **`formation/gkBlocks.ts`** — `createGkBlocks(state)` con `select/remove/getGroups/isBlockDisabled/syncDisabledBlocks` (port `js/gk-blocks.js`), stato passato come argomento.
- **`formation/switchState.ts`** — `createSwitch(state, model)` con `setStarter/setBench/setPlus/isPairValid/clear/reconcile/getPairForModel` (port `js/switch-state.js`, algoritmo invariato compresi i toast di errore).
- **`output/buildOutputText.ts`** — `buildOutputText(model)` + `buildLineupModel(model)` (port `js/output.js:3-80`), puro.
- **`story/renderCanvas.ts`** — `renderStoryCanvas(ctx, model, photos, theme)` (port `js/story.js:557-587` + draw*); `theme` parametrizzato al posto dell'hardcode viola.
- **`story/loadStoryPhotos.ts`** — `loadStoryPhotos(model, media)` → `Promise<Map<key,ImageBitmap|HTMLImageElement>>` (port `js/story.js:173-209`), `media` è l'interfaccia `MediaProvider`.
- **`media/playerMedia.ts`** — `createPlayerMedia(leagueId)` factory (port `js/player-media.js`, stessa cache `v13`, stesso `/api/player-media`), interfaccia `MediaProvider = {photo, storyPhoto, crest, player, load}`.
- **`fixtures/fixtures.ts`** — `createFixtures(leagueId)` (port `js/fixtures.js`: cache club 24h, `KICKOFF_LEAGUE_IDS`, timer 30s, `crestUrl`).

### `src/league/`
- **`LeagueProvider.tsx`** — possiede `leagueId` (da `window.__LINEUP_LEAGUE__` o rotta), metadati lega (`LineupLeagues` da `tokens`/`config`), `runtimeSettings` (port `js/runtime-settings.js`).
- **`useLeagueData.ts`** — SWR: fetch CSV (`/api/settings` per URL + fallback `config.csvUrl`, speculare a `js/csv.js:34-56`) → `parseLeagueCsv` → `buildFormationDb`; deduplicato across tab; `revalidateOnFocus` per emulare il live-refresh di `js/csv.js:114-139`. Restituisce `{state, assets, db}`.
- **`useFormationPersistence.ts`** — `load/save` localStorage versionato (port `js/persistence.js`), schema `FormationSnapshotV1`, `STORAGE_VERSION=1` mantenuto, funzione `migrate(snapshot)`.

### `src/formation/` (presentazione React, comportamento = vanilla)
- **`FormationProvider.tsx`** + **`formationReducer.ts`** — stato `{currentManager, selectedPlayers, slotAssignments, switch, disabledBlocks, module}` + azioni `SELECT_PLAYER/REMOVE_PLAYER/ASSIGN_SLOT/UNASSIGN/SET_MODULE/SET_SWITCH_STARTER/BENCH/SET_PLUS/CLEAR_SWITCH/RESET/RESTORE`.
- **`useFormationModel.ts`** — `useMemo(build, [selectedPlayers, slotAssignments, module, currentManager, db])`.
- **`Field.tsx`** (campo + panchina, DnD desktop + slot mobile), **`Slot.tsx`** (`React.memo`), **`Roster.tsx`** (toggle max 22, contatori 11/11), **`Picker.tsx`** (slot picker mobile, faccette), **`GkModal.tsx`**, **`SwitchBar.tsx`** (toggle Base/Plus), **`SwitchPicker.tsx`** (faccette + ✕ clear), **`OutputModal.tsx`**, **`StoryModal.tsx`** (usa `useStoryCanvas`), **`KickoffCard.tsx`**, **`Toast.tsx`** (port `js/app.js:3-18`).

### `src/dashboard/` (ex `dashboard/src/*` assorbiti)
- `ListoneApp`, `RoseApp`, `StandingsApp`, `TradeApp` + componenti esistenti riusati; il loro `useLeagueAssets` (`hooks.ts`) **sostituito** da `useLeagueData()` del context condiviso (niente più polling 300 ms). Mount lazy delle sezioni (speculare a `main.tsx:37-43`) via `React.lazy`.

### `src/admin/` — Admin Links (port di `js/admin-links.js` + `*/admin-links`), stessa password, pannelli per lega.

### `src/bridge/legacyBridge.ts` — `@deprecated` shim: sottoscrive il context e ripubblica `window.LineupLeagueData` + dispaccia `lineup:league-assets-ready` (per `main.tsx`/admin non ancora migrati). Rimosso in fase 10.

## (d) Implementation map (crea / modifica)

**Nuovi (`src/**`)**: `main.tsx`, `App.tsx`, `routes.tsx`, `theme/{tokens,roleColors,ThemeProvider}.{ts,tsx}`, `domain/csv/{parser,formationDb}.ts`, `domain/formation/{constants,model,gkBlocks,switchState}.ts`, `domain/output/buildOutputText.ts`, `domain/story/{renderCanvas,loadStoryPhotos}.ts`, `domain/media/playerMedia.ts`, `domain/fixtures/fixtures.ts`, `league/{LeagueProvider,useLeagueData,useFormationPersistence}.{ts,tsx}`, `formation/{FormationProvider,formationReducer,useFormationModel}.{ts,tsx}` + componenti, `dashboard/*` (spostati da `dashboard/src/*`), `admin/*`, `bridge/legacyBridge.ts`.

**Modifica (build/pipeline, NON backend)**:
- `scripts/generate-route-pages.mjs` — emette gli shell `fp/index.html`, `pd/index.html` (e `*/admin-links/index.html`) con iniezione di `window.__LINEUP_LEAGUE__` + boot della SPA (invece di montare la shell vanilla). Resta INV come contratto di output.
- `vercel.json` — **INV** (rewrites `:507-530`, `maxDuration`, headers). Eventuale aggiunta: rewrite SPA `/*` solo per route non-API (valutare; o si tiene il modello a shell statici multipli).
- `dashboard/vite.config.js` — non più lib-mode (`assets/dashboard/`); il nuovo progetto è **una sola Vite SPA** che importa `src/dashboard/*` come moduli interni. `package.json` `verify` resta il gate.

**Non toccare (V2_PLAN §1.13 / §2)**: `api/*`, `lib/*.cjs`, `api/player-photo.js` (proxy INV), `js/` esistente durante le fasi 1-5 (still source-of-truth dei test `tests/*.test.cjs`), Neon, `vercel.json`.

## (e) Data flow (entry → trasformazioni → output)

1. **Boot** — `fp/index.html` → `src/main.tsx` legge `window.__LINEUP_LEAGUE__="fp"` → `ThemeProvider` scrive CSS vars (no flash) → `LeagueProvider` imposta `leagueId`.
2. **Dati lega** — `useLeagueData()` (SWR): `runtimeSettings` (`/api/settings` + fallback `config.csvUrl`) → `fetch` CSV → `parseLeagueCsv` (`domain/csv/parser.ts`) → `buildFormationDb` (`domain/csv/formationDb.ts`) → `db` in context. Su `ready` → `useFormationPersistence.restore()` popola `FormationProvider` (speculare a `persistence.js:144`).
3. **Interazione** — utente seleziona/trascina → `formationReducer.dispatch` → stato aggiornato → `useFormationModel()` ricalcola `build()` (memo) → `Field/Roster/SwitchBar` re-render. `switchState` valida e salva (debounce 80 ms, `persistence.js:5`).
4. **Output** — `OutputModal`: `buildOutputText(useFormationModel())` (identico a `output.js`) → textarea + copia (`navigator.clipboard`, fallback `execCommand` come `output.js:110-150`).
5. **Story** — `StoryModal` → `loadStoryPhotos(model, media)` → `renderStoryCanvas(ctx, model, photos, theme)` su `<canvas ref>` (stesso `js/story.js`). Preview/share/download via `canvas.toBlob` (in-memory, solo client).
6. **Media** — `MediaProvider.load(leagueId)` fetch `/api/player-media` (cache `v13`), `crest` da `LineupKickoffClubs` (proxy `/api/crest` per CORS, `story.js:138`).
7. **Dashboard/Admin** — leggono `useLeagueData()` dal context (no polling). Lo shim `legacyBridge` tiene vivo il vecchio `window.LineupLeagueData` finché necessario.

## (f) Build sequence a fasi (ogni fase: `npm run verify` verde + collaudo preview)

1. **Fondazione**: `src/theme/*` (tokens da `config.js`), `ThemeProvider`, `routes.tsx`, landing `/`. Shell statici `fp/pd` con boot SPA. Verifica: tema applicato, nessun flash.
2. **Dominio puro**: portare `domain/**` (parser, formationDb, constants, model, gkBlocks, switchState, output, story, media, fixtures) con test vitest speculari ai `tests/*.test.cjs` esistenti (parity). I moduli `js/` restano per i test CJS finché non verde.
3. **League+persistenza**: `LeagueProvider`, `useLeagueData` (SWR), `useFormationPersistence` (schema v1). `legacyBridge` ripubblica il context.
4. **Formazione PORT**: `FormationProvider`+reducer, `Field/Slot/Roster/Picker/GkModal/Switch*` con `useFormationModel`. Drag&drop + switch + canvas + kickoff identici. **Checklist parità**: moduli 7, 11+7, portieri bloccati, switch Base/Plus, output testo, story 9:16.
5. **Dashboard assorbito**: `src/dashboard/*` montati come sezioni lazy; `useLeagueAssets`→`useLeagueData`; rimuovere `dashboard/vite.config.js` lib-mode.
6. **Modali/Toast/FAB/mobile**: `OutputModal`, `StoryModal`, `Toast`, FAB "Visualizza/Copia".
7. **Admin Links** portati in `src/admin/`.
8. **Pulizia**: rimuovere `js/` Formazione non più usati, disattivare `legacyBridge`, `dashboard/` separato fuso.
9. **Test E2E funzionale** (matrice V2_PLAN §1), `verify`, deploy preview.
10. **Merge** su `redesign/v2`.

## (g) Note performance (vercel-react-best-practices)

- **Bundle split**: `React.lazy` per `Rose/Scambi/Classifica/Admin` (come `main.tsx:37`); domain puro in chunk condiviso. Code-split per lega non necessario (stesso bundle, tema a runtime).
- **Re-render memo**: `React.memo` su `Slot`, `PlayerRow`, `Shirt`; `useFormationModel` memoizzato; `useLeagueData` con SWR `dedupingInterval` evita refetch per-tab. **Elimina il polling 300 ms × 20** di `hooks.ts:21`.
- **Client data fetching dedupe/SWR**: un'unica richiesta CSV per `leagueId`, condivisa da tutte le sezioni; `revalidateOnFocus` emula `csv.js:114-139`. Cache SWR + `localStorage` media (`player-media.js`) → niente waterfall al mount.
- **localStorage schema versioning**: `FormationSnapshotV1` + `migrate()` in `useFormationPersistence` (mantiene `STORAGE_VERSION=1` di `persistence.js:4` per retrocompatibilità bozze esistenti; futuri bump gestiti da `migrate`).
- **Avoid waterfall**: `leagueId` noto al boot (shell statico) → tema + fetch CSV partono in parallelo, non in catena. Immagini: `loading="lazy"`, `decoding="async"` (come `fixtures.js:200-201`), fallback lettera.
- **Canvas**: `renderCanvas` eseguito una volta su apertura modale (`requestAnimationFrame`, `story.js:638`), non a ogni keystroke.

## (h) Rischi e mitigazioni

| Rischio | Impatto | Mitigazione |
|---|---|---|
| **Regressione Formazione** (comportamento diverso da vanilla) | Alto — vincolo "port fedele" | `build()`/`output`/`story` riusati 1:1 con input espliciti; **test di parità** che confrontano output di `model.ts` vs `js/formation-model.js` su fixture fissi; suite `tests/*.test.cjs` tenuta verde fino a fase 8. |
| **Breaking contratto dashboard** (`useLeagueAssets`/`LineupLeagueData`) | Alto — Listone/Rose/Classifica rotte | `legacyBridge.ts` ripubblica context→`window.LineupLeagueData`+evento durante la migrazione; switch graduale sezione per sezione; `verify` per each. |
| **Tema hardcoded viola** in `formation-clean.css:1166` / `story.js:294` | Medio — viola anche su PD | `theme.kitGradient` derivato da `primary` lega passato a `renderCanvas`; grep post-migrazione per colori hex fissi. |
| **Conflitto vincolo 4 (no Blob)** vs `canvas.toBlob` in story | Medio | Chiarire: il Blob è **in-memory client-only** (preview/share/download), non una *scrittura runtime su storage* → ammissibile. Se interpretazione strict, disegnare direttamente sul `<canvas>` visibile e usare `toBlob` solo al momento dello share. Documentato in `ARCHITECTURE.md`. |
| **Perdita bozze localStorage** | Alto — vincolo 7 | `STORAGE_VERSION=1` + prefisso `lineup-${leagueId}` invariati (`persistence.js:15-23`); `migrate()` per bump futuri; test restore su snapshot reale. |
| **Flash tema / identità route** | Basso — UX | `window.__LINEUP_LEAGUE__` in shell statico + `ThemeProvider` sincrono pre-paint; `generate-route-pages.mjs` emette favicon/theme-color/title per lega (V2_PLAN §1.1 INV). |
| **`verify` gate rosso per doppia fonte (js/ + src/)** | Medio | Fase 2: tests vitest speculari ai CJS; `js/` Formazione rimosso solo in fase 8 dopo collaudo. |
| **CORS crest Kick-off** su canvas | Medio — story senza stemmi | Mantenere proxy same-origin `/api/crest` (`story.js:138`) e `crossOrigin="anonymous"`; fallback lettera. |

**Sintesi decisiva:** app React SPA unica, routing per lega + tab client-side; **tema centralizzato** in `theme/tokens.ts`; **bridge global→Context esplicito** con shim strangolatore; **Formazione portata fedele** riusando `build()`/`output`/`story` 1:1 con stato React dello stesso shape; dashboard/admin assorbiti come sezioni lazy che leggono il context condiviso (fine polling 300 ms). Backend, `vercel.json`, `generate-route-pages.mjs` e `tests/*.test.cjs` invariati.
