import { describe, expect, it } from "vitest";
import type { TeamProfiles } from "../../teamProfiles";
import type { DashboardAsset } from "../../types";
import { buildTeamSquads } from "./buildSquads";

function makeAsset(overrides: Partial<DashboardAsset> = {}): DashboardAsset {
  return {
    assetCode: "p1",
    displayName: "Giocatore",
    docsName: "Giocatore",
    role: "A",
    realTeam: "Squadra",
    quotation: 100,
    purchasePrice: 50,
    ownerTag: "Casa",
    managerCredits: null,
    type: "player",
    active: true,
    isFreeAgent: false,
    ...overrides
  };
}

const profile = (credits: number | null): TeamProfiles[string] => ({
  credits,
  logoUrl: "/logo.png",
  displayName: "Nome squadra"
});

describe("buildTeamSquads", () => {
  it("unisce proprietari equivalenti e trova il profilo con una chiave normalizzata", () => {
    const squads = buildTeamSquads(
      [
        makeAsset({ assetCode: "p1", ownerTag: "Nicolò - Gabriele" }),
        makeAsset({ assetCode: "p2", ownerTag: "  nicolo.gabriele  " })
      ],
      { "NICOLÒ/GABRIELE": profile(12) }
    );

    expect(squads).toHaveLength(1);
    expect(squads[0]).toMatchObject({
      managerName: "Nicolò - Gabriele",
      credits: 12,
      logoUrl: "/logo.png",
      displayName: "Nome squadra",
      totalPlayers: 2
    });
  });

  it("salta proprietari vuoti", () => {
    expect(buildTeamSquads([
      makeAsset({ assetCode: "p1", ownerTag: "" }),
      makeAsset({ assetCode: "p2", ownerTag: "  " })
    ], {})).toEqual([]);
  });

  it("mantiene un unico valore CSV coerente, incluso zero", () => {
    const squads = buildTeamSquads([
      makeAsset({ assetCode: "p1", managerCredits: 0 }),
      makeAsset({ assetCode: "p2", managerCredits: 0 })
    ], { Casa: profile(20) });

    expect(squads[0].credits).toBe(0);
  });

  it("rende sconosciuti i crediti CSV discordanti senza usare il profilo", () => {
    const squads = buildTeamSquads([
      makeAsset({ assetCode: "p1", managerCredits: 7 }),
      makeAsset({ assetCode: "p2", managerCredits: 8 })
    ], { Casa: profile(20) });

    expect(squads[0].credits).toBeNull();
  });

  it("usa i crediti profilo solo quando il CSV non ha valori finiti", () => {
    const squads = buildTeamSquads([
      makeAsset({ assetCode: "p1", managerCredits: null }),
      makeAsset({ assetCode: "p2", managerCredits: Number.NaN })
    ], { Casa: profile(20) });

    expect(squads[0].credits).toBe(20);
  });
});
