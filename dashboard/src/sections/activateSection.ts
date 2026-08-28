// Tab controller for the league section switcher.
//
// This mirrors the contract that js/league-dashboard.js implemented for the
// static shell: it toggles [data-league-tab] buttons and [data-league-view]
// panels, shows/hides the vanilla formation controls, records the active
// section on documentElement, and broadcasts lineup:league-section-change so
// the React router (useLeagueRoute) and any legacy listeners stay in sync.
//
// The fixed section set replaces the previous "any data-league-tab" assumption
// so React and the shell agree on the same sections.

export const ALL_SECTIONS = [
  "formation",
  "listone",
  "rose",
  "scambi",
  "classifica",
  "regolamento",
] as const;

export type SectionId = (typeof ALL_SECTIONS)[number];

const ALL_SECTIONS_SET = new Set<string>(ALL_SECTIONS);

export function activateSection(section: string): void {
  const next = ALL_SECTIONS_SET.has(section) ? section : "formation";
  const isFormation = next === "formation";

  document.querySelectorAll<HTMLElement>("[data-league-tab]").forEach((tab) => {
    const active = tab.dataset.leagueTab === next;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  document.querySelectorAll<HTMLElement>("[data-league-view]").forEach((view) => {
    view.hidden = view.dataset.leagueView !== next;
  });

  const formationControls = document.getElementById("formationControls");
  if (formationControls) formationControls.hidden = !isFormation;

  const fab = document.getElementById("fabCopy");
  if (fab) fab.hidden = !isFormation;

  document.documentElement.dataset.leagueSection = next;

  if (!isFormation && typeof (window as unknown as { setRosterOpen?: (v: boolean) => void }).setRosterOpen === "function") {
    (window as unknown as { setRosterOpen?: (v: boolean) => void }).setRosterOpen?.(false);
  }

  window.dispatchEvent(
    new CustomEvent("lineup:league-section-change", { detail: { section: next } })
  );
}
