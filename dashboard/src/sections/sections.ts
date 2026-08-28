// Data-only mapping of league section -> target DOM root. Kept free of React
// imports so it can be unit-tested without rendering. The render functions for
// each section live in SectionManager.tsx (to avoid a circular import via the
// app components).

export type SectionDef = {
  rootId: string;
  name: string;
};

export const SECTION_ROOTS: Record<string, SectionDef> = {
  rose: { rootId: "league-rose-root", name: "Rose" },
  scambi: { rootId: "league-trades-root", name: "Scambi" },
  classifica: { rootId: "league-standings-root", name: "Classifica" },
};

export function getSectionRoot(section: string | null | undefined): SectionDef | null {
  if (!section) return null;
  return SECTION_ROOTS[section] ?? null;
}
