import { describe, it, expect } from "vitest";
import { assignToSlot, removeFromSlot, selectedGkBlock } from "./formationLogic";
import type { FormationPlayer, SlotDefinition } from "./formationTypes";

const team: FormationPlayer[] = [
  { n: "Rossi", r: "P", gkBlock: "A" },
  { n: "Bianchi", r: "P", gkBlock: "B" },
  { n: "Verdi", r: "D" },
  { n: "Neri", r: "C" },
  { n: "Gialli", r: "A" }
];

const starterDefs: SlotDefinition[] = [
  { key: "P-1", id: "P-1", role: "P" },
  { key: "D-1", id: "D-1", role: "D" },
  { key: "D-2", id: "D-2", role: "D" },
  { key: "C-1", id: "C-1", role: "C" },
  { key: "A-1", id: "A-1", role: "A" }
];

const baseState = { module: "433", selectedPlayers: [] as number[], slotAssignments: {} as Record<string, number> };

describe("assignToSlot", () => {
  it("rejects a role mismatch", () => {
    const next = assignToSlot(baseState, "P-1", 2 /* Verdi (D) */, starterDefs, team);
    expect(next).toBe(baseState); // unchanged reference => ignored
  });

  it("assigns a matching-role player and marks it selected", () => {
    const next = assignToSlot(baseState, "D-1", 2 /* Verdi (D) */, starterDefs, team);
    expect(next).not.toBe(baseState);
    expect(next.slotAssignments["D-1"]).toBe(2);
    expect(next.selectedPlayers).toContain(2);
  });

  it("rejects a second goalkeeper from a different block", () => {
    const afterFirst = assignToSlot(baseState, "P-1", 0 /* Rossi, block A */, starterDefs, team);
    expect(afterFirst.slotAssignments["P-1"]).toBe(0);
    const afterSecond = assignToSlot(afterFirst, "P-1", 1 /* Bianchi, block B */, starterDefs, team);
    expect(afterSecond).toBe(afterFirst); // conflict => ignored
  });

  it("moves a player out of a previous slot of the same role", () => {
    const s1 = assignToSlot(baseState, "D-1", 2 /* Verdi (D) */, starterDefs, team);
    const s2 = assignToSlot(s1, "D-2", 2, starterDefs, team);
    expect(s2.slotAssignments["D-1"]).toBeUndefined();
    expect(s2.slotAssignments["D-2"]).toBe(2);
    expect(s2.selectedPlayers.filter((i) => i === 2)).toHaveLength(1);
  });
});

describe("removeFromSlot", () => {
  it("clears the assignment and the selected flag", () => {
    const s1 = assignToSlot(baseState, "A-1", 4, starterDefs, team);
    const s2 = removeFromSlot(s1, "A-1");
    expect(s2.slotAssignments["A-1"]).toBeUndefined();
    expect(s2.selectedPlayers).not.toContain(4);
  });
});

describe("selectedGkBlock", () => {
  it("returns null when no goalkeeper is selected", () => {
    expect(selectedGkBlock(team, [])).toBeNull();
  });

  it("returns the block of the selected goalkeeper", () => {
    expect(selectedGkBlock(team, [0])).toBe("A");
  });
});
