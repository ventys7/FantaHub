import { useEffect, useMemo, useState } from "react";
import { readLeagueStore, type DashboardStoreState } from "./store";
import type { DashboardAsset } from "./types";

export function useLeagueAssets() {
  const initial = useMemo(readLeagueStore, []);
  const [state, setState] = useState<DashboardStoreState>(initial.state);
  const [assets, setAssets] = useState<DashboardAsset[]>(initial.assets);
  const league = window.LINEUP_FANTA?.league;

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const sync = () => {
      if (cancelled) return;
      const snapshot = readLeagueStore();
      setState(snapshot.state);
      setAssets(snapshot.assets);
      attempts += 1;
      if (snapshot.state.status !== "ready" && attempts < 20) {
        window.setTimeout(sync, 300);
      }
    };

    const handleReady = (event: DocumentEventMap["lineup:league-assets-ready"]) => {
      if (event.detail.leagueId !== league?.id) return;
      const snapshot = readLeagueStore();
      setState(snapshot.state);
      setAssets(snapshot.assets);
    };

    document.addEventListener("lineup:league-assets-ready", handleReady);
    sync();

    return () => {
      cancelled = true;
      document.removeEventListener("lineup:league-assets-ready", handleReady);
    };
  }, [league?.id]);

  return { state, assets, league };
}
