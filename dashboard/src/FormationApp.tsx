import { useEffect } from "react";

/**
 * FormationApp — 1:1 vanilla delegation (v2.1)
 *
 * The dashboard's root `index.html` already ships the COMPLETE vanilla
 * formation shell (controls, desktop/mobile grids, switch, roster drawer, all
 * modals, fab, toast) together with every vanilla script
 * (app-events, output, switch, picker, slots-render, mobile-slots, roster,
 * csv…). Those scripts wire the controls themselves and attach the
 * slot/picker/GK handlers during render, so this React component intentionally
 * renders NOTHING into `#league-formation-root` and simply drives the vanilla
 * engine that is already on the page:
 *
 *   1. wait for the league assets to be ready (window.LineupDb),
 *   2. populate `#managerSelect` if vanilla csv.js didn't already,
 *   3. delegate the initial render to the vanilla `loadTeam()` (which sets the
 *      current manager, clears the selection and calls renderFormation /
 *      renderMobileSlots / renderRoster / updateSwitchUI).
 *
 * We do NOT set `window.__REACT_FORMATION_OWNED__` — that flag would make the
 * vanilla render functions bail out early, defeating the delegation.
 *
 * All further interactions (slot picker, GK blocks, switch, output/copy, reset,
 * roster drawer, viewport switching) are handled 1:1 by the vanilla code, exact
 * to the original fp/index.html behaviour.
 */

export default function FormationApp() {
  useEffect(() => {
    const w = window as unknown as {
      LineupDb?: { get?: () => Record<string, unknown> };
      loadTeam?: () => void;
      __REACT_FORMATION_OWNED__?: boolean;
    };

    // The host page (index.html) sets `data-react-formation="1"` and
    // `window.__REACT_FORMATION_OWNED__ = true` to hand the formation UI over to
    // a React implementation. Because this component delegates 1:1 to the
    // existing vanilla engine, we must RELEASE those flags:
    //   - removing the attribute un-hides the vanilla shell (#formationControls,
    //     .content-wrapper, #rosterDrawer, #mobileLayout) that the attribute's
    //     CSS rules hide;
    //   - clearing the boolean lets renderFormation / renderMobileSlots /
    //     renderRoster actually paint instead of early-returning.
    document.documentElement.removeAttribute("data-react-formation");
    w.__REACT_FORMATION_OWNED__ = false;

    let raf = 0;

    const tick = () => {
      const db = w.LineupDb?.get?.();
      const managers = db ? Object.keys(db) : [];
      const ms = document.getElementById("managerSelect") as HTMLSelectElement | null;
      if (!ms || managers.length === 0) {
        raf = window.requestAnimationFrame(tick);
        return;
      }

      // Populate #managerSelect only if vanilla csv.js left it empty/placeholder.
      const needsPopulation =
        ms.options.length <= 1 ||
        ms.value === "" ||
        ms.value === "Caricamento…";
      if (needsPopulation) {
        ms.innerHTML = "";
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Seleziona squadra…";
        ms.appendChild(placeholder);
        for (const name of managers) {
          const opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          ms.appendChild(opt);
        }
      }

      // Wire the change handler (idempotent single-handler assignment; matches
      // vanilla csv.js behaviour of delegating to loadTeam).
      ms.onchange = () => w.loadTeam?.();

      if (!ms.value || ms.value === "Seleziona squadra…") {
        ms.value = managers[0];
      }

      // Initial render via the vanilla engine (idempotent).
      w.loadTeam?.();
    };

    tick();
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return null;
}
