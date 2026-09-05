import React from "react";
import { useLeagueRoute } from "../theme/router";
import { activateSection, ALL_SECTIONS, type SectionId } from "./activateSection";

const SECTION_LABELS: Record<SectionId, string> = {
  formation: "Formazione",
  listone: "Listone",
  rose: "Rose",
  scambi: "Scambi",
  calendario: "Calendario",
  classifica: "Classifica",
  regolamento: "Regolamento",
};

// React-owned tab bar. Replaces the static #leagueSectionMenu from the shell:
// it reflects the current route (driven by useLeagueRoute) and dispatches the
// same lineup:league-section-change event the shell used to, so the vanilla
// formation/regolamento views and legacy listeners keep working.
export function LeagueTabs(): React.ReactElement {
  const { section } = useLeagueRoute();
  const active = section ?? "formation";

  return (
    <nav className="lf-league-tabs" aria-label="Sezioni della lega">
      <div className="lf-league-tabs__inner" role="tablist">
        {ALL_SECTIONS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            data-league-tab={id}
            aria-selected={id === active}
            aria-controls={`${id}View`}
            className={`lf-league-tab${id === active ? " is-active" : ""}`}
            tabIndex={id === active ? 0 : -1}
            onClick={() => activateSection(id)}
          >
            {SECTION_LABELS[id]}
          </button>
        ))}
      </div>
    </nav>
  );
}
