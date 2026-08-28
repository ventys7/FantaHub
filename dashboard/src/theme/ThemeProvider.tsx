import React, { createContext, useContext, useEffect } from "react";
import { leagueTheme, leagueThemeVars, LeagueTheme } from "./tokens";

export type ThemeContextValue = {
  leagueId: string;
  theme: LeagueTheme;
};

const ThemeContext = createContext<ThemeContextValue>({
  leagueId: "fp",
  theme: leagueTheme("fp"),
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

function resolveLeagueId(leagueId?: string): string {
  if (leagueId) return leagueId;
  if (typeof window !== "undefined" && window.LINEUP_FANTA?.league?.id) {
    return window.LINEUP_FANTA.league.id;
  }
  return "fp";
}

type ThemeProviderProps = {
  leagueId?: string;
  children: React.ReactNode;
};

// Applies the league theme CSS variables on documentElement (mirroring
// js/router.js) and exposes the tokens via useTheme(). Wrapping each mounted
// React root with this provider keeps theme application idempotent: all roots
// share the same document and the same league, so the last write wins with
// identical values.
export function ThemeProvider({ leagueId, children }: ThemeProviderProps): React.ReactElement {
  const id = resolveLeagueId(leagueId);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const vars = leagueThemeVars(id);
    const root = document.documentElement;
    (Object.keys(vars) as (keyof typeof vars)[]).forEach((name) => {
      const value = vars[name];
      if (value) root.style.setProperty(name, value);
    });
  }, [id]);

  const value: ThemeContextValue = { leagueId: id, theme: leagueTheme(id) };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
