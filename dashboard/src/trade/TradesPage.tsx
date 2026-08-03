import { useEffect, useMemo, useState } from "react";
import { createLogger } from "../debug/logger";
import { usePlayerMedia } from "../media";
import { useSectionRefresh } from "../liveRefresh";
import { loadTeamProfiles, type TeamProfiles } from "../teamProfiles";
import type { DashboardAsset } from "../types";
import { TradesView } from "./TradesView";

const log = createLogger("trades");

type TradesPageProps = {
  assets: DashboardAsset[];
  leagueId: string;
  profilesUrl?: string;
};

export function TradesPage({ assets, leagueId, profilesUrl }: TradesPageProps) {
  const [profiles, setProfiles] = useState<TeamProfiles>({});
  const refreshToken = useSectionRefresh("scambi");
  const media = usePlayerMedia(assets, leagueId);

  useEffect(() => {
    let cancelled = false;

    loadTeamProfiles(leagueId, profilesUrl)
      .then((loadedProfiles) => {
        if (!cancelled) setProfiles(loadedProfiles);
      })
      .catch((error) => {
        log.warn("profiles load failed", error);
        if (!cancelled) setProfiles({});
      });

    return () => {
      cancelled = true;
    };
  }, [leagueId, profilesUrl, refreshToken]);

  const { managers, assetsByManager, creditsByManager } = useMemo(() => {
    const grouped = new Map<string, DashboardAsset[]>();

    assets.forEach((asset) => {
      if (asset.isFreeAgent || !asset.ownerTag) return;
      const owner = asset.ownerTag.trim();
      if (!owner) return;
      const current = grouped.get(owner) ?? [];
      current.push(asset);
      grouped.set(owner, current);
    });

    const managers = [...grouped.keys()].sort((a, b) => a.localeCompare(b, "it"));
    const assetsByManager: Record<string, readonly DashboardAsset[]> = Object.fromEntries(grouped);
    const creditsByManager: Record<string, number | null> = {};
    managers.forEach((manager) => {
      creditsByManager[manager] = profiles[manager]?.credits ?? null;
    });

    return { managers, assetsByManager, creditsByManager };
  }, [assets, profiles]);

  return <TradesView managers={managers} assetsByManager={assetsByManager} creditsByManager={creditsByManager} media={media} />;
}
