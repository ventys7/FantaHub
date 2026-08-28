import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { useLeagueRoute } from "../theme/router";
import { ThemeProvider } from "../theme/ThemeProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";
import RoseApp from "../RoseApp";
import StandingsApp from "../StandingsApp";
import TradeApp from "../trade/TradeApp";
import { SECTION_ROOTS } from "./sections";

const RENDER: Record<string, () => React.ReactNode> = {
  rose: () => <RoseApp />,
  scambi: () => <TradeApp />,
  classifica: () => <StandingsApp />,
};

// Tracks sections already mounted so each is created exactly once, regardless
// of how many times the route changes. Module-level on purpose: the manager is
// mounted a single time for the dashboard lifetime.
const mounted = new Set<string>();

// Replaces the old raw window "lineup:league-section-change" listener. The
// route state now flows through the React router (useLeagueRoute), which still
// observes that same event under the hood, so the shell bridge is unchanged.
export function SectionManager(): React.ReactElement {
  const { section } = useLeagueRoute();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (!section || section === prev.current) return;
    prev.current = section;

    const def = SECTION_ROOTS[section];
    const render = RENDER[section];
    if (!def || !render || mounted.has(section)) return;

    const root = document.getElementById(def.rootId);
    if (!root) return;

    mounted.add(section);
    ReactDOM.createRoot(root).render(
      <ErrorBoundary name={def.name}>
        <ThemeProvider>{render()}</ThemeProvider>
      </ErrorBoundary>
    );
  }, [section]);

  return <></>;
}
