# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Gruppo chiuso di amici che giocano a fantacalcio privato (2 leghe). Utente tipico: fantallenatore con rosa da gestire, che prepara la formazione ogni settimana. L'uso è prevalentemente da telefono, al volo (metropolitana, pausa pranzo, tribuna prima del kick-off); ogni tanto 5 minuti da PC durante il lavoro. Nessun pubblico esterno: la landing è una porta d'ingresso per il gruppo, non una pagina di vendita.

## Product Purpose

Permettere a ogni fantallenatore di preparare la formazione della giornata (11 titolari + panchina, moduli vincolati, switch titolare/panchinaro), consultare listone, rose e classifica della lega, e produrre un output pronto da copiare/condividere (testo o immagine) per il gruppo. Il successo è: formazione pronta in pochi tocchi, dati sempre aggiornati, zero attriti sul telefono.

## Positioning

Strumento di gruppo, non prodotto di mercato. Il meccanismo distintivo: composizione guidata — il modello di formazione vincola ruolo/panchina (P2 D3 C3 A3, moduli 343/352/433/442/451/532/541, max 22), lo switch sposta giocatori con una validazione istantanea, e l'output (testo/immagine) si genera con un tocco, foto reali dei giocatori incluse.

## Operating Context

- Uso principale: telefono, sessioni brevi e frequenti (30s–3 min), luce ambiente variabile (fuori casa, di giorno e di sera).
- Uso secondario: desktop al lavoro, 5 minuti, più immersivo e dettagliato (tabellone, tabelle, confronti).
- Il rebrand deve quindi produrre due esperienze della stessa superficie: mobile veloce e comoda, desktop immersiva e dettagliata.
- Giornate con kick-off multipli; l'utente controlla le partite della giornata prima di chiudere la formazione.
- Deploy su Vercel con preview; i dati di lega vivono in CSV gestiti fuori dall'app e rigenerati via build; API backend per lista e file.
- Nessuna autenticazione: il gruppo accede direttamente, la scelta della lega avviene all'ingresso.

## Capabilities and Constraints

- Formazione: 7 moduli (3-4-3, 3-5-2, 4-2-3-1, 4-3-3, 4-4-2, 5-3-2, 3-4-2-1), 11 titolari + 7 panchina (P2 D3 C3 A3), rosa 22 max, portieri bloccati nel modello, validazione automatica, switch Base/Plus, reset, visualizza/copia output.
- Listone: tabella con nome, squadra, ruolo, quotazione, prezzo, proprietario; filtri per ruolo, ricerca per nome, ordinamenti.
- Rose: rosa per squadra del gruppo; Classifica: punti della lega per giornata.
- Kick-off multipli per giornata con link all'esterno (KICKOFF_ORIGIN).
- Immagini giocatori da URL esterni (sports.bzzoiro.com); nessuna scrittura su media in browser, nessun Blob runtime, asset generati solo via build.
- Persistenza: localStorage per la formazione, formato compatibile con la versione corrente (niente perdita bozze).
- Palette per lega DIVERSE e obbligatorie: FP = viola (#7c3aed), PD = rosso (#b91c1c).
- Il rebuild (V2) deve preservare ogni funzionalità esistente: inventario completo in docs/V2_PLAN.md; logica di dominio da riusare (formation-model, switch-state, csv-parser, csv-formation-db, gk-blocks, output, story/canvas, player-media).
- `npm run verify` (test + build + diagnosi statiche) è la porta di ingresso di ogni fase.

## Brand Commitments

- Nomi leghe: FP = "PianginaCUP" (label "Fanta Premier", 🏴󠁧󠁢󠁥󠁮󠁧󠁿), PD = "LaLigaCUP" (label "Fanta Liga", 🇪🇸).
- Palette per lega vincolanti: FP viola, PD rosso. Le leghe devono restare distinguibili a colpo d'occhio.
- Nessun altro asset o logo vincolante; il resto della identità visiva è libero (direzione da scegliere con l'utente).

## Evidence on Hand

- docs/V2_PLAN.md: inventario funzionale completo (~90 funzionalità) con destino di ciascuna nel rebuild — fonte della verità per il lavoro.
- docs/ARCHITECTURE.md, README.md: architettura attuale e istruzioni.
- tests/switch-modals.test.cjs + suite Node/vitest: comportamento attuale da preservare.
- js/ (vanilla) e dashboard/src (React esistente per listone/rose/classifica): incumbent visual system come evidenza, non come autorità.
- CSV demo con dati reali delle leghe (giocatori, quotazioni, rose, giornate).
- Mockup esplorativi precedenti in docs/v2-mockups/ (scartati dall'utente): referenza di cosa evitare, non candidati.

## Product Principles

1. Mobile-first veloce, desktop immersivo: stessa superficie, due calibrazioni — il telefono deve completare la formazione in pochi tocchi, il desktop deve invitare all'esplorazione dei dettagli.
2. Zero perdite nel rebuild: ogni funzionalità dell'inventario V2_PLAN deve esistere nel risultato, con la stessa semantica di dati e comportamento.
3. La verità è nei dati: ruoli, quotazioni, proprietari e partite arrivano solo dal CSV/backend; la UI non inventa nulla.
4. Le leghe sono identità distinte: FP viola e PD rosso devono restare distinguibili in ogni tema e schermata.
5. La logica di dominio è riusata, non riscritta: moduli, validazioni, parser e output si portano nel nuovo mondo visivo senza reimplementazione.
6. La porta di ingresso è `npm run verify`: nessuna fase si chiude senza suite verdi e build pulita.

## Accessibility & Inclusion

Non sono stati stabiliti requisiti specifici dal gruppo. Il lavoro usa come base le soglie WCAG 2.2 AA (contrasto, focus visibile, riduzione del movimento, riordino a 320px) del processo di design in corso.
