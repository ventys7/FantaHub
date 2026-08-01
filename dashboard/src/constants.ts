export const ROLE_OPTIONS = ["Tutti", "P", "D", "C", "A"] as const;

export const ROLE_LABELS: Record<string, string> = {
  P: "Portiere",
  D: "Difensore",
  C: "Centrocampista",
  A: "Attaccante",
  U: "Altro"
};

export const ROLE_SECTION_LABELS: Record<string, string> = {
  P: "Portieri",
  D: "Difensori",
  C: "Centrocampisti",
  A: "Attaccanti",
  U: "Altri"
};

export const ROLE_ORDER: Record<string, number> = {
  P: 1,
  D: 2,
  C: 3,
  A: 4,
  U: 5
};

export const ROLE_BADGE_CLASSES: Record<string, string> = {
  P: "lf-role-badge lf-role-badge--p",
  D: "lf-role-badge lf-role-badge--d",
  C: "lf-role-badge lf-role-badge--c",
  A: "lf-role-badge lf-role-badge--a",
  U: "lf-role-badge lf-role-badge--u"
};
