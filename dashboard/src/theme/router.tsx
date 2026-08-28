import { useEffect, useState } from "react";

export type LeagueRoute = {
  leagueId: string;
  section: string | null;
};

// Custom, dependency-free React router. The shell still owns URL routing via
// static fp/index.html + pd/index.html and the pre-hydration inline script
// (lineup-prepaint-router) in index.html, which sets window.LINEUP_FANTA.league
// and document.documentElement.dataset.leagueSection. This hook is the
// React-side read of that same state, so the dashboard does not need
// react-router-dom and stays in sync with the vanilla bridge.
export function readRoute(): LeagueRoute {
  if (typeof window === "undefined") return { leagueId: "fp", section: null };
  const leagueId = window.LINEUP_FANTA?.league?.id ?? "fp";
  const section = document.documentElement.dataset.leagueSection ?? null;
  return { leagueId, section };
}

export function useLeagueRoute(): LeagueRoute {
  const [route, setRoute] = useState<LeagueRoute>(readRoute);

  useEffect(() => {
    const onSection = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      setRoute((prev) => ({ ...prev, section: detail?.section ?? prev.section }));
    };
    window.addEventListener("lineup:league-section-change", onSection as EventListener);
    return () => {
      window.removeEventListener("lineup:league-section-change", onSection as EventListener);
    };
  }, []);

  return route;
}
