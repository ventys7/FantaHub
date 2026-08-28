import React from "react";
import { LeagueHeader, LeagueHeaderLeague } from "./LeagueHeader";

type AppShellProps = {
  league: LeagueHeaderLeague;
  children: React.ReactNode;
  onMenuToggle?: () => void;
};

// Shared layout wrapper: header + main content area. Reusable by every league
// section so the React app has one consistent chrome (Step 13 building block
// for the Step 15 full-React scaffold).
export function AppShell({ league, children, onMenuToggle }: AppShellProps): React.ReactElement {
  return (
    <div className="lf-app-shell" data-league={league.id}>
      <LeagueHeader league={league} onMenuToggle={onMenuToggle} />
      <main className="lf-app-shell__main">{children}</main>
    </div>
  );
}
