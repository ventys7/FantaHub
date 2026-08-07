# V2 — Rebuild React-first: piano e inventario funzionale

Branch: `redesign/v2` (main resta intatta).
Livello scelto: **B — rebuild completo in React**, riuso della logica pura esistente,
presentazione riscritta da zero. Massimo sforzo, massimo rendimento.

**Regola d'oro**: ogni funzionalità dell'elenco sotto DEVE esistere in V2, verificabile
da un test o da un collaudo manuale. Se una voce non è marcata `riusata`, `portata` o
`invariata`, il rebuild non è finito.

---

## 1. Inventario funzionale (fonte della verità)

Legenda destino: **PURA** = logica riusata così com'è · **PORT** = porting adattato ·
**NEW** = riscritta in React · **INV** = backend invariato · **DROP** = rimosso volutamente

### 1.1 Landing e routing

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| Landing con scelta lega (card FP/PD) | `js/router.js` `renderLeaguePicker` + `css/landing.css` | **NEW** (React, nuova identità) |
| Route `/`, `/fp/`, `/pd/` + fallback `?league=` | `js/router.js` | **NEW** (react-router o router custom) |
| Tema per lega (token primari FP viola / PD rosso) | `js/config.js` `theme` + `router.js` | **NEW** (design token per lega, palette DIVERSE come oggi) |
| Identità statica route (favicon, apple-touch-icon, theme-color, title) | `scripts/generate-route-pages.mjs` → `fp/index.html`, `pd/index.html` | **INV** (script e pipeline restano) |
| Home non deve mostrare residui della shell lega | `landing.css` rule | **NEW** (garantito dall'architettura React) |

### 1.2 Shell lega

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| Header sticky con logo lega + titolo | `index.html` + `style.css` + `sticky-story-mobile.css` | **NEW** (React, nuovo chrome) |
| Tab Formazione / Listone / Rose / Classifica (desktop + mobile scroll) | `league-dashboard.js` + `league-dashboard.css` | **NEW** (React, stato sezione condiviso) |
| Tab persistente + lazy mount Rose/Classifica al primo accesso | `dashboard/src/main.tsx` `mountSectionOnce` | **NEW** (lazy React standard) |
| Menu sezione mobile (toggle hamburger) | `league-dashboard.js` `leagueMenuToggle` | **NEW** |
| Chrome sticky unico header+controlli (fix Safari/iOS) | `sticky-story-mobile.css` | **NEW** (stessa regola, unico sticky ancestor) |
| FAB mobile "Visualizza / Copia" | `index.html` `fabCopy` + `app-events.js` | **NEW** |

### 1.3 Formazione — dati e stato

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| Parser CSV lega (header, encoding, campi) | `js/csv-parser.js` | **PURA** (riuso in TS, già testato: `tests/csv-parser.test.cjs`) |
| Costruzione db formazione da CSV (manager, giocatori) | `js/csv-formation-db.js` | **PURA** (già testato) |
| Caricamento CSV + render iniziale | `js/csv.js` | **NEW** (hook React `useLeagueData`) |
| Stato condiviso: manager, selezione, slotAssignments | `js/state.js` | **NEW** (React state/store) |
| Persistenza localStorage scoped per lega (bozze, copiate) | `js/persistence.js` | **PORT** (stessa struttura dati, hook `usePersistedFormation`) |
| Selezione rosa (toggle max 22, vincoli) | `js/roster.js` | **NEW** |
| Contatori 11/11 e badge "X/Y" | `index.html` + `slots-render.js` | **NEW** |
| Reset formazione (desktop + mobile) | `resetBtn`, `resetBtnMobile` + `slots-logic.js` | **NEW** |
| Runtime settings (URL CSV/doc da admin con fallback statico) | `js/runtime-settings.js` + `api/settings.js` | **PORT** (fetch + fallback identici, hook `useRuntimeSettings`) |

### 1.4 Formazione — modello e regole (logica da non rompere)

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| Modello formazione: moduli 343/352/433/442/451/532/541, 22 giocatori, slot starter+bench, assegnazione, pulizia duplicati | `js/formation-model.js` | **PURA** (esportato come modulo TS, identico) |
| Ordine ruoli, capacità panchina per ruolo (P2 D3 C3 A3) | `formation-model.js` `ROLE_ORDER` `BENCH_CAPACITY` | **PURA** |
| Etichette panchina portiere (blocchi) | `formation-model.js` `getGoalkeeperBenchLabels` | **PURA** |
| Moduli ammessi + MAX_SELECTED | `js/formation-constants.js` | **PURA** |
| Blocco portiere: un GK logico per blocco, un selezionato | `js/gk-blocks.js` | **PURA** (testato via UI tests) |
| Drag & drop desktop (roster ↔ slot, slot ↔ slot) | `js/dragdrop.js` | **PORT** (dnd con HTML5 API, stessa semantica) |
| Click slot desktop → selezione | `slots-logic.js` `openSlotPicker` | **NEW** |
| Slot picker mobile con faccette, ruolo, "in campo" | `js/picker.js` `createPickerPhoto` + `slotPickerModal` | **NEW** (componente React, stesse classi visive nuove) |
| Blocco portiere → modal scelta portiere | `js/gk-modal.js` + `gkChoiceModal` | **NEW** |
| Selezione portiere in campo (GK1) | `slots-logic.js` | **NEW** |

### 1.5 Switch (funzionalità recente, da preservare 1:1)

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| Stato Switch Base/Plus, starter/bench index | `js/switch-state.js` (264 righe, testato) | **PURA** |
| Regole validità: Base stesso ruolo, Plus ruolo diverso, P esclusi | `switch-state.js` `isValidSwitch` | **PURA** |
| Candidati filtrati per modalità | `switch-modals.js` filtri | **PORT** (stessa logica, componente React) |
| Picker modal con faccette + card selezionato + **✕ clear** | `switch-modals.js` `renderSwitchPicker` (testato: `tests/switch-modals.test.cjs`) | **PORT** (componente React, stessi casi testati) |
| Toggle Base/Plus (desktop + mobile) | `switch-ui.js` + `switchPlusBtn*` | **NEW** |
| Render slot coppia titolare/panchinaro con faccette | `switch-ui.js` | **NEW** |
| Applicazione switch alla lineup (swap) | `switch-logic.js` | **PURA** |
| Clear switch (reset da modal) | `switch-state.js` `clear` | **PURA** |

### 1.6 Output e Story (condivisione)

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| Testo formazione unico (XI, PANCHINA, ruoli, manager, separi) | `js/output.js` `buildOutputText` + `buildLineupModel` | **PORT** (puro, identico, testato: `output-story-final-ui.test.cjs`) |
| Modal Visualizza/Copia con textarea + copia | `outputModal` + `app-events.js` | **NEW** |
| **Story 9:16**: canvas con maglie, facce, nomi, squadre, badge ruolo | `js/story.js` (686 righe) | **PORT** (canvas puro riusato in hook `useStoryCanvas`; disegno invariato — testato su struttura) |
| Share nativo e copia immagine (clipboard) | `story.js` | **PORT** |
| Preview in modal con stato "in generazione" | `storyModal` | **NEW** |
| Toast (mobile silenzia success) | `js/app.js` `showToast` | **NEW** (componente Toast) |

### 1.7 Card Kick-off (fixtures)

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| Card Kick-off: una richiesta cache-only per visita, manifest da kick-off API, refresh timer, club cache 24h | `js/fixtures.js` (413 righe) + `fixtures-card.css` | **PORT** (stessa logica: cache keys, refresh, KICKOFF_ORIGIN; rendering React) |
| Crest reali dal manifest Kick-off | `fixtures.js` | **PORT** |

### 1.8 Media giocatori (faccette)

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| `photo(player, team)` / `crest(team)` da manifest backend | `js/player-media.js` (147) | **PORT** (modulo TS puro, stessa API) |
| Facce: lazy loading, decoding async, fallback lettera | `picker.js` `createPickerPhoto` | **NEW** (componente `<PlayerFace>`) |
| Re-render dopo evento `lineup:player-media-ready` | `app.js` | **NEW** (React state/context media) |
| Proxy same-origin per canvas story | `api/player-photo.js` | **INV** |

### 1.9 Listone (React esistente → nuovo design system)

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| Righe desktop (faccetta, ruolo, quota, prezzo, proprietario) | `PlayerDesktopRow.tsx` | **NEW** (stesso comportamento, nuovo design) |
| Card mobile | `PlayerMobileCard.tsx` (testato) | **NEW** (test mantenuti/aggiornati) |
| Filtri: ricerca debounce 120ms, ruolo, squadra, proprietario, svincolati | `PlayerFilters.tsx` + `Players.tsx` | **NEW** (stessa logica) |
| Ordinamento: ruolo/sezioni, quotazione, prezzo | `Players.tsx` `sorts` + `PlayerListHeader.tsx` | **NEW** (stessa logica) |
| Blocchi portiere espandibili | `GoalkeeperBlock.tsx` (testato) | **NEW** (stessa logica) |
| Header di ruolo sticky sotto chrome (offset dinamico) | `Players.tsx` `useChromeOffset` | **NEW** (stesso pattern) |
| Stemmi proprietari (teamProfiles + evento upload) | `Players.tsx` + `teamProfiles.ts` | **NEW** |
| Board disciplinare | `DisciplineBoard.tsx` + `api/discipline.js` | **NEW** (API INV) |
| Rendering singolo desktop/mobile (metà nodi) | `Players.tsx` `isDesktop` | **NEW** (stesso pattern) |

### 1.10 Rose

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| Card fantasquadra con stemma, sezioni per ruolo | `TeamCard.tsx` + `SquadRoleSection.tsx` | **NEW** |
| Caricamento stemma via codice squadra (senza password) | `LogoEditorDialog.tsx` + `logoUpload.ts` + `api/team-logo.js` | **NEW** (API INV) |
| Evento `lineup:team-logo-updated` broadcast al listone | `logoUpload.ts` | **NEW** (stessa semantica) |
| Profili squadra da settings (credits, stemma) | `api/settings.js` + `teamProfiles.ts` | **NEW** |

### 1.11 Classifica

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| Tabella classifica (pos, squadra, giocate, punti…) | `StandingsApp.tsx` + `Standings.tsx` | **NEW** |
| Penalità inline accanto al nome (senza secondo riepilogo) | `Standings.tsx` + `standings.css` | **NEW** (stessa regola, testato) |
| Fonti: CSV lega / fallback statico | `config.js` `standingsCsvUrl` + `data/*/classifica.csv` | **NEW** (stessa priorità) |

### 1.12 Admin Links (presentazione)

| Funzionalità | Sorgente attuale | Destino V2 |
| --- | --- | --- |
| Login password + sessione | `js/admin-links.js` + `lib/admin-auth.cjs` | **NEW** (logica INV) |
| Upload CSV listone/classifica per lega | `admin-links.js` + `api/admin.js` | **NEW** (API INV) |
| Docs disciplina pubblicato | `admin-links.js` + `api/admin.js` | **NEW** |
| Codici stemma (genera/reset) | `admin-links.js` + `api/team-logo.js` | **NEW** |
| Matching BSD: ricalcolo, override ambigui su Neon | `admin-links.js` + `api/player-media.js` | **NEW** (API INV) |
| Migrazione legacy Blob→Neon (sola lettura) | `admin-links.js` + `lib/migrate-neon.cjs` | **NEW** |
| Pannelli separati per lega, stessa password | `fp/admin-links/` + `pd/admin-links/` | **NEW** (stessa struttura route) |

### 1.13 Backend (INVARIATO — non si tocca)

`api/settings.js`, `api/admin.js`, `api/team-logo.js`, `api/player-media.js`,
`api/player-photo.js`, `api/discipline.js` + `lib/*.cjs` + Neon + `vercel.json`
(funzioni maxDuration, header, rewrites) + `scripts/dev-server.mjs`,
`scripts/diagnose.mjs`, `scripts/hash-admin-password.mjs`, `check-static.sh`,
`generate-route-pages.mjs`. Eventuali aggiustamenti SOLO se servono al nuovo frontend
e sempre con verify verde.

### 1.14 Test (rete di sicurezza)

| Suite | Stato |
| --- | --- |
| `tests/*.test.cjs` (Node, 75+ test: parser, model, switch, output, api, media…) | **RESTANO IDENTICI** — la logica pura riusata deve continuare a passarli |
| `dashboard/src/**/*.test.tsx` (vitest) | **PORT** nel nuovo progetto (stessa copertura) |
| Nuovi test per componenti V2 (switch picker React, PlayerFace, filtro…) | **NEW** |
| `npm run verify` | Resta la porta d'ingresso: deve passare a ogni fase |

---

## 2. Vincoli invarianti (dal prodotto, non negoziabili)

1. Il ruolo fantacalcistico arriva esclusivamente dal CSV.
2. FP e PD non condividono dati runtime.
3. Il browser non avvia sincronizzazioni o scritture media automatiche.
4. Nessuna scrittura runtime ripiega sul Blob in produzione.
5. Gli asset generati si aggiornano soltanto tramite build.
6. Le palette per lega restano DIVERSE (FP viola, PD rosso) in tutto il tema.
7. `localStorage` della formazione: compatibile con l'esistente (nessuna perdita bozze).

## 3. Fasi (ognuna con checkpoint: verify verde + collaudo su preview)

1. Direzione di design (mockup) → **scelta dell'utente**
2. Design system (token, tipografia, colori ruolo UNIFICATI, componenti base)
3. Scaffold V2: app React unica, router, shell lega, tema per lega
4. Landing + identità
5. Dati: hook useLeagueData (parser/formation-db riusati) + persistenza
6. Formazione: campo, roster, picker, drag&drop, gk, switch, output, story
7. Listone / Rose / Classifica nel design system
8. Modali, toast, FAB, dettagli mobile
9. Admin Links
10. Test end-to-end manuale completo (matrice funzionalità), verify, deploy preview, merge
