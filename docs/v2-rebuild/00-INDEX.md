# FantaHub V2 — Piano di Rebuild (correzioni + React unificato)

**Branch**: `plan/v2-rebuild` (da `main`). Stato: **pianificazione, nessun codice implementato**.

## Decisioni confermate con l'utente
- Correzioni + rebuild React, **step-by-step** (passi piccoli; gate `npm run verify` verde a ogni step).
- **Tab Formazione RESTA IDENTICA** nel comportamento (port fedele in React: stessi 7 moduli 343/352/433/442/451/532/541, switch Base/Plus, drag&drop, canvas 9:16, card Kick-off). Non "sminchiata".
- **PD = graceful empty**: nessun dato inventato; Classifica/settings PD con empty-state puliti, pronti per dati reali futuri.
- **Scambi**: feature esistente che funziona, da **preservare** e documentare in V2_PLAN (non rimuovere).

## Vincoli fissi (da docs/V2_PLAN.md §2)
Ruolo solo dal CSV · FP/PD separati via `leagueId` · nessuna sync/scrittura media automatica nel browser · nessun Blob in produzione (Neon-only) · asset generati solo via build · palette FP viola `#7c3aed` / PD rosso `#b91c1c` obbligatoria in tutto il tema · `localStorage` formazione retrocompatibile · **backend (`api/`, `lib/`, Neon, `vercel.json`) INVARIATO** · `npm run verify` è il GATE.

## Documenti di piano
- `01-architecture.md` — blueprint architettura app React unificata (skill `code-architect` + `vercel-react-best-practices`).
- `02-test-strategy.md` — strategia TDD per la logica di dominio oggi senza test (skill `tdd`).
- `03-roadmap.md` — roadmap step-by-step ordinata (skill `feature-dev`).

## Sequenza proposta (riassunto)
- **FASE A — Fondazione & correzioni**: baseline gate · unica sorgente tema (elimina viola hard-coded) · fix bug tema (CSS + canvas) · test mancanti (switch/formation/gk/csv-db) · pulizia debito.
- **FASE B — Estrazione dominio**: moduli puri importabili (switch-state, formation-model, story/canvas, slot) — rete di sicurezza per il port.
- **FASE C — Unificazione React**: ThemeProvider FP/PD + router · shell+tab unificati riusando i componenti dashboard esistenti · **port fedele Formazione**.
- **FASE D — PD graceful + Scambi + verify finale**: empty-state PD · documentazione Scambi in V2_PLAN · collaudo end-to-end.

## Checkpoint di conferma richiesti (prima di certi step)
1. **Nome branch**: `plan/v2-rebuild` (usato ora) vs `redesign/v2` citato in V2_PLAN.md — allineare il riferimento.
2. **Prima di scrivere i test (Step 5)**: confermare il **seam** di `switch-state.js` (contratto input/output pubblico).
3. **Prima di Fase C (Step 11)**: scelta router (react-router vs custom) e contratto di `ThemeProvider` FP/PD.

## Primo step consigliato
Partire da **FASE A** con i passi a basso rischio: **Step 2 (unica sorgente tema lega) + Step 3/4 (fix bug viola su PD)**. Sono correzioni visibili e sicure, e sbloccano il resto. (Da confermare con l'utente prima di implementare — nessun codice scritto per il momento.)
