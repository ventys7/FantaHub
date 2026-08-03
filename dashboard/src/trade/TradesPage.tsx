import { useEffect, useMemo, useState } from "react";
import { createLogger } from "../debug/logger";
import { usePlayerMedia } from "../media";
import { useSectionRefresh } from "../liveRefresh";
import { loadTeamProfiles, type TeamProfiles } from "../teamProfiles";
import { buildTeamSquads } from "../components/teams/buildSquads";
import type { TeamSquad } from "../components/teams/types";
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

  const { managers, squadsByManager } = useMemo(() => {
    const squads = buildTeamSquads(assets, profiles);
    const byManager: Record<string, TeamSquad> = {};
    squads.forEach((squad) => { byManager[squad.managerName] = squad; });
    return { managers: squads.map((squad) => squad.managerName), squadsByManager: byManager };
  }, [assets, profiles]);

  return <TradesView managers={managers} squadsByManager={squadsByManager} media={media} leagueId={leagueId} />;
}
