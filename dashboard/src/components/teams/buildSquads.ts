import type { TeamProfiles } from "../../teamProfiles";
import type { DashboardAsset } from "../../types";
import type { RoleKey, TeamSquad } from "./types";

export const TEAM_ROLE_TARGETS: Record<RoleKey, number> = { P: 2, D: 8, C: 8, A: 6 };

/**
 * Raggruppa gli asset assegnati a un proprietario in TeamSquad, con
 * conteggi per ruolo, stato completezza, crediti (CSV poi profili) e logo.
 * Ordina i manager: i nomi composti ("X - Y") dopo i singoli, poi locale it.
 */
export function buildTeamSquads(assets: DashboardAsset[], profiles: TeamProfiles): TeamSquad[] {
  const grouped = new Map<string, DashboardAsset[]>();

  assets.forEach((asset) => {
    if (asset.isFreeAgent || !asset.ownerTag) return;
    const owner = asset.ownerTag.trim();
    if (!owner) return;
    const current = grouped.get(owner) ?? [];
    current.push(asset);
    grouped.set(owner, current);
  });

  const result = [...grouped.entries()].map(([managerName, players]) => {
    const roleCounts: Record<RoleKey, number> = { P: 0, D: 0, C: 0, A: 0 };
    players.forEach((player) => {
      if (player.role in roleCounts) roleCounts[player.role as RoleKey] += 1;
    });
    const isComplete = (Object.keys(TEAM_ROLE_TARGETS) as RoleKey[]).every((role) => roleCounts[role] === TEAM_ROLE_TARGETS[role]);
    const profile = profiles[managerName];
    const csvCredits = players.find((player) => player.managerCredits !== null)?.managerCredits ?? null;

    return {
      managerName,
      credits: csvCredits ?? profile?.credits ?? null,
      logoUrl: profile?.logoUrl ?? "",
      displayName: profile?.displayName ?? "",
      players,
      isComplete,
      roleCounts,
      totalPlayers: players.length
    };
  });

  return result.sort((a, b) => {
    const aCompound = a.managerName.includes("-");
    const bCompound = b.managerName.includes("-");
    if (aCompound !== bCompound) return aCompound ? 1 : -1;
    return a.managerName.localeCompare(b.managerName, "it");
  });
}
