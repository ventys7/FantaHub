# Strategia di test TDD — Logica di dominio FantaHub (Formazione)

Documento di piano. **Nessun file viene creato o modificato**: qui sotto propono seam, valori attesi e ordine di implementazione. L'utente conferma prima che scriva i test.

## 0. Premessa metodologica

I quattro moduli hanno oggi dipendenze globali (`currentManager`, `db`, `selectedPlayers`, `slotAssignments`, `disabledBlocks`, `document`, `showToast`, …) e sono esposti come singleton su `window`. I test attuali (`csv-parser`, `switch-modals`, `output-story-final-ui`) seguono due pattern: **(A)** caricare il sorgente via `vm` in un contesto con stub minimi e chiamare la funzione pubblica (vedi `csv-parser.test.cjs`); **(B)** leggere il sorgente come testo e fare `assert.match` su pattern (vedi `output-story-final-ui`, `client-photo-fallback`, `switch-modals` che carica `switch-modals.js` in `vm`).

Per la logica di dominio useremo il **pattern A** (chiamata reale della funzione pubblica, nessun mock di collaboratori interni). Dove un modulo legge globali, il primo passo TDD è un **refactor di esposizione** (senza cambiare comportamento) che rende la funzione pura/richiamabile in Node. I valori attesi sono **calcolati a mano dalle regole** in `V2_PLAN.md` / `PRODUCT.md`, mai ricalcolati dal codice.

Ordine vertical-slice: **Switch validation → Formation build → GK blocks → CSV db**. Ogni slice = 1 test (valore atteso indipendente) → minima implementazione/refactor → verde → slice successiva. NON scrivere prima tutti i test.

## 1. Seam proposti per modulo

### 1.1 `js/switch-state.js` → `LineupSwitch`
- **Seam di test principale (già quasi puro):** `LineupSwitch.isPairValid(starterIndex, benchIndex, plus, lineup)` dove `lineup = { team, starters, bench }`.
  - `isPairValid` è l'unica funzione che già accetta `lineup` come parametro → è il confine pubblico ideale, non serve refactor per testarla.
- **Seam di stato (per slice successive):** `setStarter/setBench/setPlus/togglePlus/clear/reconcile/getPairForModel/getState/getCandidates`.
- **Refactor richiesto:** oggi espone solo `window.LineupSwitch` e le chiamate setter invocano `showToast`/`updateSwitchUI`/`window.LineupPersistence?.queueDraftSave?.()` e leggono `currentManager`/`db`. Per testare gli setter in Node serve estrarre un **core puro** `createSwitchState({ getTeam, notify })` → restituisce un oggetto con gli stessi metodi ma con dipendenze iniettate; il singleton esistente delega al core (comportamento invariato per il browser). Il seam di test diventa: `const sw = createSwitchState({ getTeam: () => team, notify: () => {} }); sw.setStarter(3); sw.getState()`.
- **NON testare:** `notify`, `messageForInvalidPair` (privato di fatto), `uniqueEntries`/`hasCandidate` (helper interni).

### 1.2 `js/formation-model.js` → `FormationModel`
- **Seam di test principale:** `FormationModel.build(team, selectedPlayers, slotAssignments, moduleRaw)` → `{ module, starters, bench, goalkeeperBenchLabels, definitions, slots, counts, selectedIndices }`.
- **Seam accessori (già puri, ma oggi con default che leggono `document`):** `getSlotDefinitions(moduleRaw)`, `getRoleName(role)`, `getGoalkeeperBenchLabels(team, starters, selectedSet)`, `getBenchDisplayEntry(model, definition)`, `roleOrder` (espongo `ROLE_ORDER`), `BENCH_CAPACITY`.
- **Refactor richiesto:** oggi `build()` legge `currentManager`/`db`/`selectedPlayers`/`slotAssignments`/`document.getElementById("moduleSelect")`. Estrazione: `build(team, selectedPlayers, slotAssignments, moduleRaw)` — tutti gli input espliciti; `getModuleValue()` resta solo nel wrapper browser che passa il valore a `build`; esporre `ROLE_ORDER` e `BENCH_CAPACITY` come export. Il seam di test: `const model = FormationModel.build(team, selected, assignments, "433")`.
- **NON testare:** `getSlotEntry` (wrapper banale), `didCleanAssignments` (dettaglio interno — testiamo solo via `counts`/`slots`).

### 1.3 `js/gk-blocks.js` → `GkBlocks`
- **Seam di test principale:** `GkBlocks.resolve(state)` dove `state = { team, selectedPlayers, slotAssignments, disabledBlocks }` → `{ groups, selectedIndex, selectedPlayer, goalkeeperIndices, disabledBlockNames }`.
- **Seam mutatori (con stato iniettato):** `select(state, index, {slotKey, allowReplace})`, `remove(state, index?)`, `reset(state)`, `syncDisabledBlocks(state)`, `getGroups(state)`, `getGroup(state, name)`, `isBlockDisabled(state, name)`, `isGoalkeeperSlot(slotKey)` (già pura), `getSelectedIndexForBlock(state, name)`.
- **Refactor richiesto:** oggi tutte le funzioni leggono `currentManager`/`db`/`selectedPlayers`/`slotAssignments`/`disabledBlocks`/`MAX_SELECTED` come global. Estrazione: accettare `state` come primo argomento (o `createGkBlocks(state)`); `MAX_SELECTED` va passato/iniettato. Il seam di test: `const res = GkBlocks.resolve({ team, selectedPlayers:[0], slotAssignments:{}, disabledBlocks:new Set() })`.
- **NON testare:** `clearGoalkeeperAssignments` (helper interno), `getTeam`/`getGoalkeeperIndices` (leggono globali — dopo refactor scompaiono).

### 1.4 `js/csv-formation-db.js` → `LineupFormationDb`
- **Seam di test principale:** `buildFormationDb(assets)` → `db[ownerTag].players` (array ordinato per ruolo).
- **Già quasi puro:** `goalkeeperEntries(asset)` (split su `" - "`) è la logica critica da isolare e testare direttamente.
- **Refactor richiesto:** oggi `(function exposeFormationDb(global){ … })(window)` → in Node `window` è `undefined` e `global.LineupFormationDb = …` lancia. Adottare lo stesso pattern di `csv-parser.js`:
  ```js
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.LineupFormationDb = api;
  ```
  così il test lo `require()` direttamente.
- **NON testare:** l'ordinamento interno `ROLE_ORDER` (dettaglio) — testiamo solo l'ordine *osservabile* dei ruoli nel risultato.

## 2. Cosa verificare + valori attesi da fonte indipendente

Ogni valore atteso è derivato dalle regole di `V2_PLAN.md` §1.4 e `PRODUCT.md`, non dal codice sorgente.

### 2.1 Switch validation (`isPairValid`)
**Regola (indipendente):** Base = stesso ruolo, Plus = ruolo diverso, portieri sempre esclusi, index non intero o uguali → invalidi.

```
team = [
 {n:"Mario", r:"P", t:"Inter"},            // 0
 {n:"Luigi", r:"D", t:"Juve"},             // 3
 {n:"Theo",  r:"D", t:"Milan"},            // 4
 {n:"Barella", r:"C", t:"Inter"},          // 10
 {n:"Dumfries", r:"D", t:"Inter"},         // 7
 {n:"Lautaro", r:"A", t:"Inter"}           // 17
]
lineup = {
  team,
  starters: [{index:3,player:team[3]},{index:4,player:team[4]},{index:10,player:team[10]}],
  bench:    [{index:7,player:team[7]},{index:17,player:team[17]}]
}
```
| Caso | Chiamata | Atteso |
| --- | --- | --- |
| Base stesso ruolo (D–D) | `isPairValid(3,4,false,lineup)` | `true` |
| Plus stesso ruolo (D–D) | `isPairValid(3,4,true,lineup)` | `false` |
| Base ruolo diverso (D–A) | `isPairValid(3,17,false,lineup)` | `false` |
| Plus ruolo diverso (D–A) | `isPairValid(3,17,true,lineup)` | `true` |
| Portiere escluso (P–D) | `isPairValid(0,3,false,lineup)` | `false` |
| Portiere escluso Plus (P–D) | `isPairValid(0,3,true,lineup)` | `false` |
| Index uguali | `isPairValid(3,3,false,lineup)` | `false` |
| Index non intero | `isPairValid("3",4,false,lineup)` | `false` |
| Candidato non presente tra i titolari | `isPairValid(3,99,false,lineup)` | `false` |

### 2.2 Formation build (`getSlotDefinitions` + `build`)
**Regola (indipendente):** 7 moduli → 11 titolari (1P+ modulo); panchina fissa P2 D3 C3 A3 = 11 slot; `ROLE_ORDER` P<D<C<A; `MAX_SELECTED` 22.

Test `getSlotDefinitions` (valore atteso dalla capacità dichiarata):
- `getSlotDefinitions("433")` → `starter.length === 11` (1+4+3+3), `bench.length === 11` (2+3+3+3).
- `getSlotDefinitions("343")` → starter = 1+3+4+3 = 11.
- `getSlotDefinitions("532")` → starter = 1+5+3+2 = 11.
- `getSlotDefinitions("451")` → starter = 1+4+5+1 = 11.
- Ogni `starter[i].role` nell'ordine `P, D, D, D, D, C, C, C, A, A, A` per il 433.

Test `build` su rosa di **22 giocatori esatti** (calcolata a mano, modulo 433):
```
team (indici 0..21):
 0 P Mario/Inter   1 P Gigi/Juve      2 P Sami/Milan
 3 D Luigi/Juve    4 D Theo/Milan     5 D Bastoni/Inter  6 D DiLorenzo/Napoli
 7 D Dumfries/Inter 8 D Gosens/Atalanta 9 D Walker/ManCity
 10 C Barella/Inter … 16 C Wijnaldum/AlEttifaq   (7 C: 10..16)
 17 A Lautaro/Inter … 21 A Kean/Fiorentina        (5 A: 17..21)
selectedPlayers = [0..21]   slotAssignments = {}   moduleRaw = "433"
```
Atteso (derivato dalle regole di fill per ruolo in ordine):
- `model.counts.starters === 11`
- `model.counts.bench === 11` (tutti gli 11 slot panchina riempiti: P→1,2; D→7,8,9; C→13,14,15; A→20,21)
- `model.counts.selected === 22`
- `model.starters[0].player.n === "Mario"` (il P va in GK1)
- `model.starters.filter(s=>s.player.r==="D").length === 4`, `=== "C"` → 3, `=== "A"` → 3
- `model.bench.filter(b=>b.player.r==="P").length === 2`, `=== "D"` → 3, `=== "C"` → 3, `=== "A"` → 3
- `model.goalkeeperBenchLabels` → `["Inter"]` (starter GK senza `gkBlock` ⇒ solo la sua squadra)

Caso aggiuntivo (duplicato/ruolo sbagliato): `slotAssignments = { "starter-C1": 3 }` (indice 3 è D, non C) → `build` deve ignorare l'assegnazione manuale e riempire C1 con il primo C disponibile; `model.slots.starter["C1"].player.r === "C"`.

### 2.3 GK blocks (`resolve` / `select` / `syncDisabledBlocks`)
**Regola (indipendente):** un blocco = portieri con stesso `gkBlock`; un solo portiere selezionato; gli altri blocchi disabilitati; slot GK = `starter-GK1`, `bench-P1`, `bench-P2`.

Test A — blocchi singoli (nessun `gkBlock`):
```
team = [ {n:"Mario",r:"P",t:"Inter"}, {n:"Gigi",r:"P",t:"Juve"}, {n:"Sami",r:"P",t:"Milan"} ]
state = { team, selectedPlayers:[0], slotAssignments:{}, disabledBlocks:new Set() }
```
Atteso: `resolve(state).groups.length === 3` (tre gruppi `single:0/1/2`); `selectedIndex === 0`; `selectedPlayer.n === "Mario"`; nessun `isBlockDisabled` vero.

Test B — due blocchi, disabilitazione:
```
team = [
 {n:"Donna", r:"P", t:"", gkBlock:"BA", isGkBlock:true},
 {n:"Sport", r:"P", t:"", gkBlock:"BA", isGkBlock:true},
 {n:"Perin", r:"P", t:"", gkBlock:"BB", isGkBlock:true}
]
state = { team, selectedPlayers:[0], slotAssignments:{}, disabledBlocks:new Set() }
```
- `resolve(state).groups.length === 2` (BA con 2 player, BB con 1).
- dopo `syncDisabledBlocks(state)` → `disabledBlocks` contiene `"BB"`, NON `"BA"`; `isBlockDisabled(state,"BB") === true`.
- `select(state, 2, {allowReplace:true})` sposta la selezione su Perin (BB); `selectedIndex === 2`.

Test C — `isGoalkeeperSlot` (pura): `true` per `"starter-GK1"`, `"bench-P1"`, `"bench-P2"`; `false` per `"starter-D1"`, `"bench-D1"`.

### 2.4 CSV formation db (`buildFormationDb`)
**Regola (indipendente):** un asset normale → 1 player; un `goalkeeper_block` con `"Nome - Partner"` → 2 player (split su `" - "`), entrambi `isGkBlock:true`, `gkBlock` = displayName originale; inattivi/free-agent/ senza `ownerTag` scartati; ordinamento per `ROLE_ORDER` (P<D<C<A).

```
assets = [
 {active:true,  isFreeAgent:false, ownerTag:"Paolo", role:"P", displayName:"Donnarumma - Sportiello", realTeam:"", type:"goalkeeper_block"},
 {active:true,  isFreeAgent:false, ownerTag:"Paolo", role:"C", displayName:"Tielemans", realTeam:"Aston Villa", type:"player"},
 {active:false, isFreeAgent:false, ownerTag:"Paolo", role:"D", displayName:"Mukiele", realTeam:"", type:"player"},   // scartato
 {active:true,  isFreeAgent:true,  ownerTag:"",      role:"A", displayName:"Svincolato", realTeam:"", type:"player"}  // scartato
]
```
Atteso:
- `db["Paolo"].players.length === 3`
- `db["Paolo"].players[0].n === "Donnarumma"`, `.r === "P"`, `.gkBlock === "Donnarumma - Sportiello"`, `.gkPartner === "Sportiello"`, `.isGkBlock === true`
- `db["Paolo"].players[1].n === "Sportiello"`, `.gkPartner === "Donnarumma"`
- `db["Paolo"].players[2].n === "Tielemans"`, `.r === "C"`, `.t === "Aston Villa"` (i P stanno prima dei C ⇒ ordinamento corretto)
- nessun player con `n === "Mukiele"` né `"Svincolato"`

Test unitario mirato su `goalkeeperEntries`: `goalkeeperEntries({displayName:"A - B", role:"P", realTeam:""})` → array di 2 con `n` "A"/"B" e `gkPartner` incrociati. `goalkeeperEntries({displayName:"Solo", role:"P"})` → array di 1 (niente `gkPartner`).

## 3. Ordine vertical-slice (critico per primo)

1. **Slice 1 — Switch validation** (`tests/switch-state.test.cjs`, solo `isPairValid`). È il confine già puro: si scrive il test con la tabella §2.1, si rende il modulo `require`-abile, si ottiene verde. *Perché primo:* regola 1:1 Base/Plus + esclusione P è il vincolo più facile da rompere nel port e ha zero dipendenze di stato.
2. **Slice 2 — Formation build** (`tests/formation-model.test.cjs`). Prima `getSlotDefinitions` (7 moduli, capacità panchina), poi `build` su rosa da 22 (§2.2). Refactor: `build(team, selectedPlayers, slotAssignments, moduleRaw)` + esposizione `ROLE_ORDER`/`BENCH_CAPACITY`.
3. **Slice 3 — GK blocks** (`tests/gk-blocks.test.cjs`). `resolve` + `syncDisabledBlocks` + `select`/`remove` con stato iniettato (§2.3).
4. **Slice 4 — CSV formation db** (`tests/csv-formation-db.test.cjs`). Refactor di esposizione (pattern `module.exports` di `csv-parser.js`), poi `buildFormationDb` + `goalkeeperEntries` (§2.4).

Ogni slice è indipendente: i test di una slice non dipendono dalle altre. Solo dopo lo slice 4 (e verde completo) si procede al port React.

## 4. Test del port React (cosa deve restare verde)

Il port React riusa i moduli puri refattorizzati: gli stessi `FormationModel.build`, `SwitchState` core, `GkBlocks`, `buildFormationDb` diventano moduli TS importati dall'UI. I test Node §1–3 **restano la rete di sicurezza**.

Comportamenti Formazione da congelare come invariante nel port:
- **Output/Story** — riuso di `buildOutputText` e canvas 9:16. Già coperto da `tests/output-story-final-ui.test.cjs` (separatori `━━━`, `XI TITOLARE`/`PANCHINA`, badge `🟨 P|🟦 D|🟩 C|🟥 A`, nessuna anteprima WhatsApp/Docs, ordine ruolo→ritratto→nome→squadra nello story). Nel port React i nuovi test `dashboard/src/formation/OutputText.test.tsx` devono assertare sugli stessi pattern.
- **Switch picker UI** — già coperto da `tests/switch-modals.test.cjs` (card selezionato con ✕ che fa `clear`, riga con ✓, ruolo sconosciuto → fallback rosso). Il port React (`<SwitchPicker>`) deve mantenere: card ✕ → `onClear`, riga → `onSelect(index)`, classe `selected` + `✓`.
- **Switch regole** — il port non deve ricalcolare validità: chiama il core puro testato in §3 slice 1. Test React minimo: `<SwitchToggle>` con coppia D–D in Plus mostra messaggio di invalidità.
- **Contatori 11/11 + MAX_SELECTED 22** — test React su `useLeagueData`/`usePersistedFormation`: con 22 selezionati il badge è "22/22" e `build` restituisce `counts.starters===11`.
- **localStorage retrocompatibile** — snapshot id-based `ruolo|nome|squadra|gkBlock`. Test di port: `usePersistedFormation` legge uno snapshot legacy e produce lo stesso `model` di `build`.
- **GK blocks** — il port `<GkChoiceModal>` disabilita i blocchi non selezionati (`isBlockDisabled`); test React su `resolve`+`syncDisabledBlocks` già in slice 3.

## 5. Nomi file proposti e integrazione in `npm run verify`

Nuovi test Node (suite CJS, già coperta da `node --test tests/*.test.cjs`):
- `tests/formation-model.test.cjs`
- `tests/switch-state.test.cjs`
- `tests/gk-blocks.test.cjs`
- `tests/csv-formation-db.test.cjs`

Nuovi test React (Vitest, in `dashboard/src`, coperti da `npm --prefix dashboard run test:ui`):
- `dashboard/src/formation/FormationModel.test.ts` (specchio di §2.2)
- `dashboard/src/switch/SwitchState.test.ts` (core puro) + `dashboard/src/switch/SwitchPicker.test.tsx` (UI, specchio di `switch-modals`)
- `dashboard/src/gk/GkBlocks.test.ts` (specchio di §2.3)
- `dashboard/src/formation/OutputText.test.tsx` (specchio di `output-story-final-ui`)

**Integrazione:** `npm run verify` esegue già `node --test tests/*.test.cjs` (i 4 file sopra vengono inclusi automaticamente per glob) **+** `npm --prefix dashboard run test:ui`. Nessuna modifica allo script `verify`: basta aggiungere i file. I test React sui moduli puri importano lo stesso codice refattorizzato, quindi una regressione nel port fallisce in **una** delle due suite.

## 6. Come questi test abilitano il refactor sicuro (prima di estrarre dai globali `window`)

1. **Caratterizzazione prima del cambiamento.** I test §2 fissano il comportamento *osservabile* (con valori attesi indipendenti) mentre il codice è ancora aggrappato ai globali. Se il refactor di esposizione rompesse qualcosa, i test diventano rossi **prima** del port React.
2. **Confine pubblico = unica superficie di accordo.** Non testiamo helper privati: i test proteggono il *contratto*, non l'implementazione.
3. **Estrazione progressiva, slice per slice.** Ogni slice rende un modulo `require`-abile/Node-testabile *senza* toccare il browser. A fine slice 4 abbiamo 4 moduli puri e 4 suite verdi.
4. **Blocco dei regression-risk noti.** Le due regole più delicate — esclusione portieri dallo switch e disabilitazione blocchi GK — hanno test dedicati.
5. **Retrocompatibilità localStorage verificabile.** Il test di `usePersistedFormation` legge uno snapshot legacy e confronta con `build`, garantendo l'invariante §2.7 senza perdita bozze.

**Prossimo passo proposto (in attesa di conferma):** apro la Slice 1 — scrivo `tests/switch-state.test.cjs` con la tabella §2.1 e rendo `switch-state.js` `require`-abile in Node (esposizione del core `isPairValid`/`createSwitchState`), poi eseguo `node --test tests/switch-state.test.cjs` per chiudere la slice.
