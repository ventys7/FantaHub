import { normalizeTeamName, type TeamProfiles } from "../../teamProfiles";
import type { DashboardAsset } from "../../types";
import type { RoleKey, TeamSquad } from "./types";

export const TEAM_ROLE_TARGETS: Record<RoleKey, number> = { P: 2, D: 8, C: 8, A: 6 };

/**
 * Raggruppa gli asset assegnati a un proprietario in TeamSquad, con
 * conteggi per ruolo, stato completezza, crediti (CSV poi profili) e logo.
 * Ordina i manager: i nomi composti ("X - Y") dopo i singoli, poi locale it.
 */
export function buildTeamSquads(assets: DashboardAsset[], profiles: TeamProfiles): TeamSquad[] {
  const grouped = new Map<string, { managerName: string; players: DashboardAsset[] }>();
  const profilesByKey = new Map(
    Object.entries(profiles).map(([managerName, profile]) => [normalizeTeamName(managerName), profile])
  );

  assets.forEach((asset) => {
    const owner = asset.ownerTag?.trim();
    if (asset.isFreeAgent || !owner) return;
    const ownerKey = normalizeTeamName(owner);
    if (!ownerKey) return;
    const current = grouped.get(ownerKey) ?? { managerName: owner, players: [] };
    current.players.push(asset);
    grouped.set(ownerKey, current);
  });

  const result = [...grouped.entries()].map(([ownerKey, { managerName, players }]) => {
    const roleCounts: Record<RoleKey, number> = { P: 0, D: 0, C: 0, A: 0 };
    players.forEach((player) => {
      if (player.role in roleCounts) roleCounts[player.role as RoleKey] += 1;
    });
    const isComplete = (Object.keys(TEAM_ROLE_TARGETS) as RoleKey[]).every((role) => roleCounts[role] === TEAM_ROLE_TARGETS[role]);
    const profile = profilesByKey.get(ownerKey);
    const csvCredits = [...new Set(players
      .map((player) => player.managerCredits)
      .filter((credits): credits is number => typeof credits === "number" && Number.isFinite(credits)))];
    const credits = csvCredits.length > 1
      ? null
      : csvCredits[0] ?? profile?.credits ?? null;

    return {
      managerName,
      credits,
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
