# FantaHub V2 — Roadmap di Rebuild (React-first, step-by-step)

> **Working branch**: `plan/v2-rebuild` (da `main`).
> **Gate per ogni step**: `npm run verify` deve restare **VERDE**. Comando: `npm run verify` (= `test` + `test:ui` + `build` + `generate-route-pages.mjs` + `diagnose` + `check-static.sh`).
> **Vincoli fissi**: backend (`api/`, `lib/`, Neon) **intatto**; Tab Formazione **comportamento identico**; PD **graceful empty**; Scambi **preservati**.
> ⚠️ **Da confermare con l'utente (fuori step)**: `docs/V2_PLAN.md` cita il branch `redesign/v2`, ma il lavoro è su `plan/v2-rebuild`. Allineare il riferimento nel piano prima dello step 1.

## FASE A — Fondazione & Correzioni (risk basso, sblocca tutto il resto)

### Step 1 — Baseline e freeze del gate
- **Obiettivo**: partire da uno stato verde noto e blindare `V2_PLAN.md` come fonte di verità delle destinazioni (PURA/PORT/NEW/INV/DROP).
- **File previsti**: `plan/v2-rebuild` (checkout), nessun codice. Eventuale nota in `docs/V2_PLAN.md` per allineare il nome del branch.
- **Dipendenze**: nessuna.
- **Verifica**: `npm run verify` → verde. Criterio: nessun test fallito, build dashboard OK, `diagnose` senza errori critici.
- **Risk**: low. **Sblocca**: tutti.

### Step 2 — Unica sorgente palette/tema lega (foundation)
- **Obiettivo**: creare **una** definizione dei token di lega (FP viola / PD rosso) usata da canvas, slot, switch e CSS, eliminando le tabelle `roleColors` frammentate (`js/picker.js`, `js/slots-constants.js`, `js/switch-modals.js`) e il viola hard-coded.
- **File previsti**: nuovo `js/theme-tokens.js` (o `lib/theme-tokens.cjs` se serve lato Node testabile) + nuove CSS vars in `css/formation-clean.css` (`--primary`, `--primary-light`, per `[data-league="fp"]`/`[data-league="pd"]`). Refactor minimale dei 3 file `roleColors` per puntare ai token.
- **Dipendenze**: Step 1.
- **Verifica**: `npm run verify` verde. Criterio: nessun `#7c3aed`/`#a855f7` hard-coded residuo fuori dai token; i 3 file `roleColors` leggono dai token centrali (verificabile con grep + un test Node che asserisce i valori per lega).
- **Risk**: medium (tocca molti punti di lettura colore). **Sblocca**: Step 3, 4, 8, Fase C.

### Step 3 — Fix bug tema: gradient viola hard-coded (CSS)
- **Obiettivo**: il bottone "Esporta story" su PD mostra viola invece di rosso.
- **File previsti**: `css/formation-clean.css:1166` → `background: linear-gradient(135deg, var(--primary), var(--primary-light))` e `box-shadow` basato su `var(--primary)`.
- **Dipendenze**: Step 2 (token pronti).
- **Verifica**: `npm run verify` verde. Criterio: grep conferma che la riga non contiene più `#7c3aed`; controllo visivo/collaudo: su `?league=pd` il bottone è rosso, su `fp` viola.
- **Risk**: low.

### Step 4 — Fix bug tema: magliette canvas in `story.js`
- **Obiettivo**: `js/story.js:23` ha `theme: { primary: "#7c3aed", primaryLight: "#a855f7" }` hard-coded → su PD le magliette sono viola.
- **File previsti**: `js/story.js` → legge il primary dal token di lega (Step 2) invece di costante.
- **Dipendenze**: Step 2.
- **Verifica**: `npm run verify` verde. Criterio: disegno canvas su PD usa rosso; nessun `#7c3aed` hard-coded in `story.js`.
- **Risk**: low.

### Step 5 — Test mancanti: `switch-state.js`  ⚠️ **CHECKPOINT CONFERMA UTENTE**
- **Obiettivo**: aggiungere test prima di toccare la logica (regola TDD / "riusare ma senza test").
- **File previsti**: nuovo `tests/switch-state.test.cjs`.
- **Dipendenze**: Step 1.
- **⚠️ Conferma richiesta**: prima di scrivere i test, confermare con l'utente il **seam di test** (contratto pubblico della funzione: input/output, formato stato switch, casi limite attesi). Questo evita di codificare assunzioni sbagliate.
- **Verifica**: `npm run verify` verde + nuovo test passa. Criterio: copertura dei casi Base/Plus, toggle, persistenza stato.
- **Risk**: low/medium.

### Step 6 — Test mancanti: `formation-model.js`
- **File previsti**: nuovo `tests/formation-model.test.cjs`.
- **Dipendenze**: Step 1.
- **Verifica**: `npm run verify` verde + test passa (modello formazione: slot, ruoli, vincoli).
- **Risk**: low/medium.

### Step 7 — Test mancanti: `gk-blocks.js` + `csv-formation-db.js`
- **File previsti**: nuovi `tests/gk-blocks.test.cjs`, `tests/csv-formation-db.test.cjs`.
- **Dipendenze**: Step 1.
- **Verifica**: `npm run verify` verde + test passano (blocchi portiere; parsing/lookup DB formazione da CSV).
- **Risk**: low/medium. **Sblocca**: Fase B (ora i moduli "da riusare" hanno rete di sicurezza).

### Step 8 — Pulizia debito tecnico
- **Obiettivo**: ridurre il rischio prima del port React.
- **File previsti**:
  - `lib/player-media.cjs`: rimuovere alias "scheduled for removal" (`processFullSync`, `startMissingSync`, `searchProvider`…) dopo aver verificato che nulla li richiami.
  - `scripts/build-dashboard.sh`: rimuovere o collegare a `package.json` (oggi mai chiamato).
  - `dashboard/src/components/teams/TeamCard.tsx` vs `buildSquads.ts`: unificare `ROLE_TARGETS` in un'unica fonte (`types.ts` o `buildSquads.ts` esportato).
  - `js/switch-state.js` + persistenza: eliminare la doppia fonte di verità (globali + persistenza) a favore di un solo path.
- **Dipendenze**: Step 5,6,7 (i test proteggono i refactor).
- **Verifica**: `npm run verify` verde. Criterio: grep conferma rimozione alias; nessun riferimento orfano; `ROLE_TARGETS` definito una volta sola.
- **Risk**: medium.

## FASE B — Estrazione logica dominio in moduli puri testabili

### Step 9 — Moduli puri Formazione (stato + switch)
- **Obiettivo**: esporre `switch-state` e `formation-model` come **moduli puri importabili** (API stabile, zero dipendenze DOM) così React li consumerà senza reimplementarli.
- **File previsti**: refactor di `js/switch-state.js`, `js/formation-model.js` in moduli con export named chiari; mantenere i test di Step 5/6 validi. Eventuale wrapper `js/formation-domain.js`.
- **Dipendenze**: Step 5, 6, 8.
- **Verifica**: `npm run verify` verde + test esistenti ancora verdi. Criterio: i moduli sono importabili in un contesto non-DOM (asserito da un test Node).
- **Risk**: medium. **Sblocca**: Step 13 (Formazione React).

### Step 10 — Moduli puri canvas/story + slot
- **Obiettivo**: separare la logica di disegno (canvas 9:16, magliette, card Kick-off) e la logica slot dai listener DOM, in funzioni pure riceventi contesto/canvas come parametro.
- **File previsti**: refactor di `js/story.js`, `js/slots-logic.js`, `js/slots-render.js`, `js/mobile-slots.js` in funzioni pure; test aggiuntivi mirati su rendering puro.
- **Dipendenze**: Step 2 (token colore), Step 4, Step 7.
- **Verifica**: `npm run verify` verde. Criterio: disegno canvas testabile senza DOM reale; colori derivati dai token.
- **Risk**: medium. **Sblocca**: Step 13.

## FASE C — Unificazione React (shell + Formazione fedele + dashboard esistente)

> ⚠️ **Conferma utente prima di Step 11**: scegliere tra `react-router` o router custom e definire il contratto di `ThemeProvider` (props/context, valori FP/PD). Questo è lo "seam" architetturale della Fase C.

### Step 11 — ThemeProvider FP/PD + routing React base
- **Obiettivo**: un `ThemeProvider` che inietta i token di lega (da Step 2) e un router React per `/`, `/fp/`, `/pd/`.
- **File previsti**: `dashboard/src/theme/ThemeProvider.tsx`, `dashboard/src/theme/tokens.ts` (importa i valori di `js/theme-tokens`), `dashboard/src/router.tsx`.
- **Dipendenze**: Step 2, checkpoint architetturale.
- **Verifica**: `npm run verify` verde. Criterio: montando l'app su lega PD i token `--primary` risolvono a rosso; su FP a viola; route cambiano senza residui della shell lega.
- **Risk**: medium. **Sblocca**: Step 12, 13.

### Step 12 — Port shell lega + dashboard esistente in un unico albero React
- **Obiettivo**: unificare header sticky, tab (Formazione/Listone/Rose/Classifica/Admin), menu mobile e FAB dentro l'albero React, **riusando** i componenti dashboard attuali (Listone/Rose/Classifica/Scambi/Admin già funzionanti).
- **File previsti**: nuovi `dashboard/src/LeagueShell.tsx`, `dashboard/src/SectionTabs.tsx`; integrazione di `RoseApp.tsx`, `StandingsApp.tsx`, `Players.tsx`, `TradeApp.tsx`, Admin. Lazy-mount delle sezioni (pattern `mountSectionOnce` esistente).
- **Dipendenze**: Step 11.
- **Verifica**: `npm run verify` verde (inclusi i test `*.test.tsx` esistenti: `TradesView`, `TradeSummaryModal`, `PlayerMobileCard`, `GoalkeeperBlock`, `SquadRoleSection`, `Players`, `pressFeedback`). Criterio: tutte le sezioni esistenti raggiungibili e funzionanti come prima; nessun test regredito.
- **Risk**: medium/high. **Sblocca**: Step 13, 14.

### Step 13 — Port FEDELE Tab Formazione in React (comportamento identico)
- **Obiettivo**: ricreare in React gli **stessi 7 moduli**, switch Base/Plus, drag&drop, canvas 9:16, card Kick-off — usando i moduli puri di Fase B. Nessun cambio di comportamento ("non sminchiata").
- **File previsti**: `dashboard/src/formation/*` (es. `FormationApp.tsx`, `ModuleGrid.tsx`, `BasePlusSwitch.tsx`, `DragDropSlots.tsx`, `StoryCanvas.tsx`, `KickoffCard.tsx`) che wrappano i moduli di Step 9/10.
- **Dipendenze**: Step 9, 10, 12.
- **Verifica**: `npm run verify` verde + collaudo manuale specchiato su `js/` attuale. Criterio: gli 7 moduli, lo switch Base/Plus, il drag&drop, l'export canvas 9:16 e la card Kick-off producono output identico a prima.
- **Risk**: high. **Sblocca**: Step 14.

## FASE D — PD graceful empty, Scambi, verify finale

### Step 14 — PD graceful empty
- **Obiettivo**: Classifica/settings PD mostrano empty-state puliti, pronti per dati reali futuri. Nessun dato inventato.
- **File previsti**: `dashboard/src/pages/Standings.tsx` (o `StandingsApp.tsx`), `runtimeSettings.ts`, componenti settings → ramo empty-state quando la lega PD non ha dati.
- **Dipendenze**: Step 12.
- **Verifica**: `npm run verify` verde. Criterio: su `?league=pd` senza dati, niente "0" artefatti o placeholder falsi; messaggio empty-state chiaro; su FP tutto normale.
- **Risk**: low/medium.

### Step 15 — Documentare Scambi in V2_PLAN + verify finale end-to-end
- **Obiettivo**: registrare in `V2_PLAN.md` che Scambi è **feature preservata** (non rimossa) con le sue destinazioni; collaudo finale.
- **File previsti**: aggiornamento `docs/V2_PLAN.md` (voce Scambi marcata PURA/INV + note di preservazione); nessun codice nuovo.
- **Dipendenze**: Step 12 (Scambi già dentro l'albero React), Step 13, 14.
- **Verifica**: `npm run verify` verde + collaudo manuale completo (FP e PD): Formazione, Listone, Rose, Classifica, Scambi, Admin. Criterio: ogni riga di `V2_PLAN` è verificabile da test o collaudo; nessuna regressione; branch pronto per PR.
- **Risk**: low.

## Checkpoint di conferma utente (riassunto)
1. **Prima Step 1**: allineare nome branch `plan/v2-rebuild` vs `redesign/v2` in `V2_PLAN.md`.
2. **Prima Step 5**: confermare il **seam di test** di `switch-state.js` (contratto input/output) — regola TDD.
3. **Prima Step 11**: scegliere router (react-router vs custom) e contratto di `ThemeProvider` FP/PD.

## Note di sequenzialità
- Ogni step chiude con `npm run verify` verde: **non si passa al successivo se il gate è rosso**.
- Fase A è tutta `risk: low/medium` e non tocca la presentazione → può procedere anche se la Fase C è ancora da disegnare.
- Fase B rende "sicuro" il riuso: senza i test di A, B non parte.
- Fase C è la più rischiosa (Step 13 = high): i moduli puri di B sono la rete di sicurezza che permette il port fedele senza reimplementare la logica.
