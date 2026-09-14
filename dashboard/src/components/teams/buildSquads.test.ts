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

  it("keeps Extra assets out of normal totals and resolves fixed D/C/A slots", () => {
    const normal = [
      ...Array.from({ length: 2 }, (_, index) => makeAsset({ assetCode: `p-${index}`, role: "P" })),
      ...Array.from({ length: 8 }, (_, index) => makeAsset({ assetCode: `d-${index}`, role: "D" })),
      ...Array.from({ length: 8 }, (_, index) => makeAsset({ assetCode: `c-${index}`, role: "C" })),
      ...Array.from({ length: 6 }, (_, index) => makeAsset({ assetCode: `a-${index}`, role: "A" }))
    ];
    const extraD = makeAsset({ assetCode: "extra-d", displayName: "Extra D", role: "D", isExtra: true });
    const extraC = makeAsset({ assetCode: "extra-c", displayName: "Extra C", role: "C", isExtra: true });
    const extraA = makeAsset({ assetCode: "extra-a", displayName: "Extra A", role: "A", isExtra: true });

    const [squad] = buildTeamSquads([...normal, extraD, extraC, extraA], {});

    expect(squad.players).toEqual(normal);
    expect(squad.roleCounts).toEqual({ P: 2, D: 8, C: 8, A: 6 });
    expect(squad.totalPlayers).toBe(24);
    expect(squad.isComplete).toBe(true);
    expect(squad.extraSlots).toEqual({ D: extraD, C: extraC, A: extraA });
  });

  it("leaves zero and duplicate Extra candidates unresolved", () => {
    const extraD1 = makeAsset({ assetCode: "extra-d-1", role: "D", isExtra: true });
    const extraD2 = makeAsset({ assetCode: "extra-d-2", role: "D", isExtra: true });
    const extraC = makeAsset({ assetCode: "extra-c", role: "C", isExtra: true });

    const [squad] = buildTeamSquads([extraD1, extraD2, extraC], {});

    expect(squad.players).toEqual([]);
    expect(squad.totalPlayers).toBe(0);
    expect(squad.extraSlots).toEqual({ D: null, C: extraC, A: null });
  });
});
