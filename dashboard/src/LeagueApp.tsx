import React, { useEffect } from "react";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppShell } from "./layout/AppShell";
import { LeagueTabs } from "./sections/LeagueTabs";
import { useLeagueRoute } from "./theme/router";
import App from "./App";
import RoseApp from "./RoseApp";
import StandingsApp from "./StandingsApp";
import TradeApp from "./trade/TradeApp";

type LeagueInfo = {
  id: string;
  name: string;
  label?: string;
  identity?: { logo?: string; flag?: string; color?: string };
};

function leagueFromWindow(): LeagueInfo {
  const league =
    typeof window !== "undefined" ? window.LINEUP_FANTA?.league : undefined;
  return {
    id: league?.id ?? "fp",
    name: league?.name ?? "FantaHub",
    label: league?.label,
    identity: league?.identity,
  };
}

// Renders the React-owned section for the active route. formation and
// regolamento stay shell-managed vanilla views (toggled by activateSection),
// so the React tree only takes over the four data sections.
function ActiveSection(): React.ReactElement | null {
  const { section } = useLeagueRoute();
  switch (section) {
    case "listone":
      return <App />;
    case "rose":
      return <RoseApp />;
    case "scambi":
      return <TradeApp />;
    case "classifica":
      return <StandingsApp />;
    default:
      return null;
  }
}

// Top-level React application mounted into #league-react-root. Adds the
// lf-react-chrome body class so the shell's static header/tab-bar are hidden
// (formationControls stays visible). If React fails to mount, the class is
// never added and the shell keeps working as a fallback.
export function LeagueApp(): React.ReactElement {
  useEffect(() => {
    document.body.classList.add("lf-react-chrome");
    return () => {
      document.body.classList.remove("lf-react-chrome");
    };
  }, []);

  return (
    <ThemeProvider>
      <AppShell league={leagueFromWindow()}>
        <LeagueTabs />
        <div className="lf-league-section">
          <ActiveSection />
        </div>
      </AppShell>
    </ThemeProvider>
  );
}
