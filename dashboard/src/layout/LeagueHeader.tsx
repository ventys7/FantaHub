import React from "react";
import { useTheme } from "../theme/ThemeProvider";

export type LeagueHeaderLeague = {
  id: string;
  name: string;
  label?: string;
  identity?: { logo?: string };
};

type LeagueHeaderProps = {
  league: LeagueHeaderLeague;
  onMenuToggle?: () => void;
};

// Presentational league chrome. Intended to replace the shell's vanilla
// <header> once the fp/pd scaffold is owned by React (Step 15). It is
// theme-aware via useTheme() so the accent colour tracks FP/PD automatically.
export function LeagueHeader({ league, onMenuToggle }: LeagueHeaderProps): React.ReactElement {
  const { theme } = useTheme();
  return (
    <header className="lf-app-header" data-league={league.id}>
      <img
        className="lf-app-header__logo"
        src={league.identity?.logo}
        alt={`Logo ${league.name}`}
      />
      <h1 className="lf-app-header__title">{league.name}</h1>
      {onMenuToggle && (
        <button
          type="button"
          className="lf-app-header__menu"
          aria-label="Apri il menu delle sezioni"
          aria-expanded={false}
          onClick={onMenuToggle}
          style={{ borderColor: theme.primary }}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      )}
    </header>
  );
}
