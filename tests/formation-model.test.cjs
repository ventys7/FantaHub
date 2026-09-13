"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const FormationModel = require("../js/formation-model.js");
const { build } = FormationModel;

// 13-player team: 1 starter GK + 4 D + 3 C + 3 A + 1 second GK (block) + 1 spare D.
function makeTeam() {
  return [
    { r: "P", t: "GK1" },                                  // 0
    { r: "D", t: "D1" }, { r: "D", t: "D2" }, { r: "D", t: "D3" }, { r: "D", t: "D4" }, // 1-4
    { r: "C", t: "C1" }, { r: "C", t: "C2" }, { r: "C", t: "C3" }, // 5-7
    { r: "A", t: "A1" }, { r: "A", t: "A2" }, { r: "A", t: "A3" }, // 8-10
    { r: "P", t: "GK2", gkBlock: "B", isGkBlock: true },     // 11
    { r: "D", t: "D5" }                                      // 12
  ];
}

const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const FULL_TEAM = [
  { r: "P" }, { r: "P" }, { r: "P" },
  { r: "D" }, { r: "D" }, { r: "D" }, { r: "D" }, { r: "D" }, { r: "D" }, { r: "D" },
  { r: "C" }, { r: "C" }, { r: "C" }, { r: "C" }, { r: "C" }, { r: "C" },
  { r: "A" }, { r: "A" }, { r: "A" }, { r: "A" }, { r: "A" }, { r: "A" },
  { r: "D" }
];
const FULL_SELECTION = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

test("build: returns null without a team", () => {
  assert.equal(build({}), null);
});

test("build: defaults missing and invalid modules to 433 outside the browser", () => {
  const team = makeTeam();
  const missing = build({ team, selectedPlayers: ALL });
  const invalid = build({ team, module: "999", selectedPlayers: ALL });

  assert.deepEqual(
    [missing, invalid].map((model) => ({ module: model.moduleRaw, starters: model.starters.length })),
    [{ module: "433", starters: 11 }, { module: "433", starters: 11 }]
  );
});

test("unknown candidate roles are denied and labeled explicitly", () => {
  const team = [{ r: "X", t: "Unknown" }];
  const selection = FormationModel.canSelect?.({
    team,
    selectedPlayers: [],
    playerIndex: 0,
    module: "433",
    replacingIndex: null
  });

  assert.deepEqual(
    {
      allowed: selection?.allowed,
      roleLabel: FormationModel.getRoleName?.(team[0].r)
    },
    { allowed: false, roleLabel: "Ruolo sconosciuto" }
  );
});

test("canSelect: denies a 23rd selected player before role capacity", () => {
  assert.deepEqual(FormationModel.canSelect({
    team: FULL_TEAM,
    selectedPlayers: FULL_SELECTION,
    playerIndex: 22,
    module: "433",
    replacingIndex: null
  }), { allowed: false, reason: "max-selected" });
});

test("canSelect: denies an eighth defender in 433 below the total limit", () => {
  const team = [{ r: "D" }, { r: "D" }, { r: "D" }, { r: "D" }, { r: "D" }, { r: "D" }, { r: "D" }, { r: "D" }];

  assert.deepEqual(FormationModel.canSelect({
    team,
    selectedPlayers: [0, 1, 2, 3, 4, 5, 6],
    playerIndex: 7,
    module: "433",
    replacingIndex: null
  }), { allowed: false, reason: "role-capacity" });
});

test("canSelect: allows replacing a defender at capacity and total 22", () => {
  assert.deepEqual(FormationModel.canSelect({
    team: FULL_TEAM,
    selectedPlayers: FULL_SELECTION,
    playerIndex: 22,
    module: "433",
    replacingIndex: 3
  }), { allowed: true });
});

test("canSelect: denies replacing another role when defender capacity would be exceeded", () => {
  assert.deepEqual(FormationModel.canSelect({
    team: FULL_TEAM,
    selectedPlayers: FULL_SELECTION,
    playerIndex: 22,
    module: "433",
    replacingIndex: 10
  }), { allowed: false, reason: "role-capacity" });
});

test("canSelect: allows an already-selected valid player at all limits", () => {
  assert.deepEqual(FormationModel.canSelect({
    team: FULL_TEAM,
    selectedPlayers: FULL_SELECTION,
    playerIndex: 3,
    module: "433",
    replacingIndex: null
  }), { allowed: true });
});

test("build: 433 fills 11 starters by ROLE_ORDER", () => {
  const model = build({ team: makeTeam(), module: "433", selectedPlayers: ALL });

  assert.equal(model.moduleRaw, "433");
  assert.equal(model.module, "4-3-3");
  assert.equal(model.starters.length, 11);

  const roles = model.starters.map((entry) => entry.player.r);
  assert.deepEqual(roles, ["P", "D", "D", "D", "D", "C", "C", "C", "A", "A", "A"]);

  assert.equal(model.counts.selected, 13);
  assert.equal(model.counts.starters, 11);
});

test("build: remaining players go to bench; counts reflect visual bench", () => {
  const model = build({ team: makeTeam(), module: "433", selectedPlayers: ALL });

  // After 11 starters, unused selected are index 11 (P block) and 12 (D).
  assert.equal(model.bench.length, 2);
  const benchRoles = model.bench.map((entry) => entry.player.r).sort();
  assert.deepEqual(benchRoles, ["D", "P"]);

  // Starter GK has no gkBlock -> only its own label.
  assert.deepEqual(model.goalkeeperBenchLabels, ["GK1"]);
  assert.equal(model.counts.bench, 2);
});

test("build: GK block label appended when starter GK belongs to a block", () => {
  const team = makeTeam();
  team[0].gkBlock = "A";
  team[0].isGkBlock = true;
  const selected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]; // 11 (second GK) NOT selected

  const model = build({ team, module: "433", selectedPlayers: selected });

  assert.deepEqual(model.goalkeeperBenchLabels, ["GK1", "GK2"]);
});

test("build: manual slot assignment honoured when role matches", () => {
  const assignments = { "starter-D1": 2 }; // force D slot 1 to index 2 (D2)
  const model = build({ team: makeTeam(), module: "433", selectedPlayers: ALL, slotAssignments: assignments });

  const d1 = model.slots.starter.D1;
  assert.ok(d1);
  assert.equal(d1.player.t, "D2");
});

test("build: manual slot assignment cleaned when role mismatches", () => {
  const assignments = { "starter-D1": 5 }; // index 5 is a C -> invalid for D slot
  const model = build({ team: makeTeam(), module: "433", selectedPlayers: ALL, slotAssignments: assignments });

  assert.equal(model.changedAssignments, true);
  // D1 is refilled by the next available defender (index 1).
  assert.equal(model.slots.starter.D1.player.t, "D1");
});

test("reconcileAssignments: returns a new map containing only first valid assignments", () => {
  const slotAssignments = {
    "starter-D1": 2,
    "bench-D1": 2,
    "starter-D2": 5,
    "starter-D3": 12,
    "starter-D4": 99,
    "starter-D5": 1,
    unknown: 1
  };
  const original = { ...slotAssignments };

  const result = FormationModel.reconcileAssignments({
    team: makeTeam(),
    selectedPlayers: ALL.filter((index) => index !== 12),
    slotAssignments,
    module: "433"
  });

  assert.deepEqual(result, { assignments: { "starter-D1": 2 }, changed: true });
  assert.notStrictEqual(result.assignments, slotAssignments);
  assert.deepEqual(slotAssignments, original);
});

test("reconcileAssignments: reports unchanged valid assignments", () => {
  const slotAssignments = { "starter-GK1": 0, "starter-D1": 1 };
  const result = FormationModel.reconcileAssignments({
    team: makeTeam(),
    selectedPlayers: [0, 1],
    slotAssignments,
    module: "433"
  });

  assert.deepEqual(result, { assignments: slotAssignments, changed: false });
  assert.notStrictEqual(result.assignments, slotAssignments);
});
