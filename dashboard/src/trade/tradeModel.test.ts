import { describe, expect, it } from "vitest";
import type { DashboardAsset } from "../types";
import {
  buildTradeText,
  countRoles,
  creditsValid,
  isGoalkeeperBlock,
  isRoleBalanced,
  roleBalanceSummary,
} from "./tradeModel";

function makeAsset(overrides: Partial<DashboardAsset>): DashboardAsset {
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

describe("isGoalkeeperBlock", () => {
  it("riconosce un blocco portieri dal type", () => {
    expect(isGoalkeeperBlock(makeAsset({ type: "goalkeeper_block", role: "P" }))).toBe(true);
  });

  it("riconosce un blocco portieri dal nome composto (tipo portiere doppio)", () => {
    expect(isGoalkeeperBlock(makeAsset({ role: "P", displayName: "Due - Tre" }))).toBe(true);
  });

  it("non riconosce un portiere singolo", () => {
    expect(isGoalkeeperBlock(makeAsset({ role: "P", displayName: "Portiere Uno" }))).toBe(false);
  });

  it("non riconosce un giocatore di movimento", () => {
    expect(isGoalkeeperBlock(makeAsset({ role: "D", displayName: "Difensore - Strano" }))).toBe(false);
  });
});

describe("countRoles", () => {
  it("conta i giocatori per ruolo, un blocco P conta come un P", () => {
    const assets = [
      makeAsset({ role: "P", displayName: "Due - Tre" }),
      makeAsset({ role: "D" }),
      makeAsset({ role: "D" }),
      makeAsset({ role: "C" }),
      makeAsset({ role: "A" })
    ];
    expect(countRoles(assets)).toEqual({ P: 1, D: 2, C: 1, A: 1 });
  });

  it("ritorna conteggi a zero per selezione vuota", () => {
    expect(countRoles([])).toEqual({ P: 0, D: 0, C: 0, A: 0 });
  });
});

describe("isRoleBalanced / roleBalanceSummary", () => {
  it("bilanciato quando D, C, A e blocchi P coincidono", () => {
    const a = [
      makeAsset({ role: "P", displayName: "Due - Tre" }),
      makeAsset({ role: "D" }),
      makeAsset({ role: "C" }),
      makeAsset({ role: "A" })
    ];
    const b = [
      makeAsset({ role: "P", type: "goalkeeper_block" }),
      makeAsset({ role: "D" }),
      makeAsset({ role: "C" }),
      makeAsset({ role: "A" })
    ];
    expect(isRoleBalanced(a, b)).toBe(true);
    expect(roleBalanceSummary(a, b)).toEqual([]);
  });

  it("sbilanciato su ruoli di movimento", () => {
    const a = [makeAsset({ role: "D" }), makeAsset({ role: "C" }), makeAsset({ role: "A" })];
    const b = [makeAsset({ role: "D" }), makeAsset({ role: "A" })];
    expect(isRoleBalanced(a, b)).toBe(false);
    expect(roleBalanceSummary(a, b)).toEqual(["C (1 ↔ 0)"]);
  });

  it("sbilanciato sui blocchi portieri", () => {
    const a = [makeAsset({ role: "P", displayName: "Due - Tre" })];
    const b: DashboardAsset[] = [];
    expect(isRoleBalanced(a, b)).toBe(false);
    expect(roleBalanceSummary(a, b)).toEqual(["P (1 ↔ 0)"]);
  });
});

describe("creditsValid", () => {
  it("true senza crediti", () => {
    expect(creditsValid(0, 10, 10)).toBe(true);
  });

  it("chi offre deve avere abbastanza crediti", () => {
    expect(creditsValid(5, 10, 10)).toBe(true);
    expect(creditsValid(5, 3, 10)).toBe(false);
  });

  it("chi richiede deve avere abbastanza crediti", () => {
    expect(creditsValid(-4, 10, 6)).toBe(true);
    expect(creditsValid(-4, 10, 2)).toBe(false);
  });
});

describe("buildTradeText", () => {
  const aGives = [
    makeAsset({ role: "P", displayName: "Due - Tre", realTeam: "Athletic" }),
    makeAsset({ role: "D", displayName: "Difensore Uno" }),
    makeAsset({ role: "A", displayName: "Attaccante Uno" })
  ];
  const bGives = [
    makeAsset({ role: "P", type: "goalkeeper_block", realTeam: "Inter" }),
    makeAsset({ role: "C", displayName: "Centrocampista Uno" }),
    makeAsset({ role: "A", displayName: "Attaccante Due" })
  ];

  it("genera il messaggio in formato Formazione senza inviti a rispondere", () => {
    const text = buildTradeText({
      managerA: "Nicolò - Gabriele",
      managerB: "Casa",
      aGives,
      bGives,
      credits: 0
    });

    expect(text).toContain("🔄 SCAMBIO · Nicolò - Gabriele ↔ Casa");
    expect(text).toContain("━━━━━━━━━━━━━━━━━━━━");
    expect(text).toContain("NICOLÒ - GABRIELE OFFRE");
    expect(text).toContain("RICEVE DA CASA");
    expect(text).toContain("🟨 P  Blocco Athletic");
    expect(text).toContain("🟦 D  Difensore Uno");
    expect(text).toContain("🟥 A  Attaccante Uno");
    expect(text).toContain("🟨 P  Blocco Inter");
    expect(text).toContain("🟩 C  Centrocampista Uno");
    expect(text).toContain("🟥 A  Attaccante Due");
    expect(text).not.toContain("Rispondi");
    expect(text).not.toContain("✅");
  });

  it("include i crediti offerti verso il ricevente", () => {
    const text = buildTradeText({
      managerA: "Casa",
      managerB: "Villa",
      aGives: [makeAsset({ role: "D", displayName: "Difensore" })],
      bGives: [makeAsset({ role: "D", displayName: "Terzino" })],
      credits: 3
    });
    expect(text).toContain("CREDITI");
    expect(text).toContain("3 crediti da Casa a Villa");
  });

  it("include i crediti richiesti da B verso A senza importi negativi", () => {
    const text = buildTradeText({
      managerA: "Casa",
      managerB: "Villa",
      aGives: [makeAsset({ role: "D", displayName: "Difensore" })],
      bGives: [makeAsset({ role: "D", displayName: "Terzino" })],
      credits: -2
    });
    expect(text).toContain("2 crediti da Villa a Casa");
    expect(text).not.toContain("-2");
  });

  it("omette la sezione crediti se zero", () => {
    const text = buildTradeText({
      managerA: "Casa",
      managerB: "Villa",
      aGives: [makeAsset({ role: "D", displayName: "Difensore" })],
      bGives: [makeAsset({ role: "D", displayName: "Terzino" })],
      credits: 0
    });
    expect(text).not.toContain("CREDITI");
  });

  it("usa il nome giocatore per le righe di movimento", () => {
    const text = buildTradeText({
      managerA: "Casa",
      managerB: "Villa",
      aGives: [makeAsset({ role: "D", displayName: "Difensore Uno", realTeam: "Inter" })],
      bGives: [makeAsset({ role: "D", displayName: "Difensore Due", realTeam: "Milan" })],
      credits: 0
    });
    expect(text).toContain("🟦 D  Difensore Uno");
    expect(text).toContain("🟦 D  Difensore Due");
  });
});
