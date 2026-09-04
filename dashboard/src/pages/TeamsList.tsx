import { useEffect, useMemo, useState } from "react";
import { createLogger } from "../debug/logger";
import { UsersIcon } from "../icons";
import { TeamCard } from "../components/teams/TeamCard";
import { buildTeamSquads } from "../components/teams/buildSquads";
import type { TeamSquad } from "../components/teams/types";
import type { DashboardAsset } from "../types";
import { loadTeamProfiles, type TeamProfiles } from "../teamProfiles";
import { useSectionRefresh } from "../liveRefresh";
import { usePlayerMedia } from "../media";

const log = createLogger("teams");

type TeamsListProps = {
  assets: DashboardAsset[];
  leagueId: string;
  profilesUrl?: string;
};

export function TeamsList({ assets, leagueId, profilesUrl }: TeamsListProps) {
  const [profiles, setProfiles] = useState<TeamProfiles>({});
  const refreshToken = useSectionRefresh("rose");
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

  const teams = useMemo<TeamSquad[]>(() => buildTeamSquads(assets, profiles), [assets, profiles]);

  return (
    <div className="tw-px-2 tw-py-3 sm:tw-px-5 sm:tw-py-7 lg:tw-px-7">
      <section className="lf-dashboard-card tw-mx-auto tw-max-w-7xl">
        {teams.length > 0 ? (
          <div className="lf-teams-grid">
            {teams.map((team) => <TeamCard key={team.managerName} team={team} leagueId={leagueId} media={media} onLogoUpdated={(update) => setProfiles((current) => ({ ...current, [team.managerName]: { ...(current[team.managerName] || { credits: team.credits, logoUrl: "", displayName: "" }), ...update } }))} />)}
          </div>
        ) : (
          <div className="lf-teams-empty">
            <UsersIcon size={34} />
            <h2>Nessuna rosa disponibile</h2>
            <p>Nel CSV non risultano asset assegnati a un proprietario.</p>
          </div>
        )}
      </section>
    </div>
  );
}
