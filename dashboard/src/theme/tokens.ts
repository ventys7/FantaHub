// Single source of truth for league theme tokens on the React side.
// Mirrors the FP/PD palettes defined in js/config.js (league.theme) so the
// React tree can apply the same CSS custom properties that js/router.js
// injects on documentElement. Kept in sync with config.js until phase 8, when
// js/router.js will consume this module as the unique source.

export type LeagueId = "fp" | "pd";

export type LeagueTheme = {
  primary: string;
  primaryLight: string;
  primaryBg: string;
  primaryBorder: string;
  background: string;
};

export const LEAGUE_THEME: Record<LeagueId, LeagueTheme> = {
  fp: {
    primary: "#7c3aed",
    primaryLight: "#a855f7",
    primaryBg: "#f5f0ff",
    primaryBorder: "#ede9fe",
    background: "#f8f7ff",
  },
  pd: {
    primary: "#b91c1c",
    primaryLight: "#ef4444",
    primaryBg: "#fff1f2",
    primaryBorder: "#fecdd3",
    background: "#fffafa",
  },
};

// The four custom properties js/router.js sets on documentElement. The React
// ThemeProvider writes the same names so the two stay visually identical.
export const THEME_CSS_VARS = [
  "--primary",
  "--primary-light",
  "--primary-bg",
  "--primary-border",
] as const;

export type ThemeVars = Partial<Record<(typeof THEME_CSS_VARS)[number], string>>;

export function isLeagueId(value: string): value is LeagueId {
  return value === "fp" || value === "pd";
}

export function leagueThemeVars(leagueId: string): ThemeVars {
  const theme = isLeagueId(leagueId) ? LEAGUE_THEME[leagueId] : LEAGUE_THEME.fp;
  return {
    "--primary": theme.primary,
    "--primary-light": theme.primaryLight,
    "--primary-bg": theme.primaryBg,
    "--primary-border": theme.primaryBorder,
  };
}

export function leagueTheme(leagueId: string): LeagueTheme {
  return isLeagueId(leagueId) ? LEAGUE_THEME[leagueId] : LEAGUE_THEME.fp;
}
