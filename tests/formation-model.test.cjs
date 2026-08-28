"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { build } = require("../js/formation-model.js");

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

test("build: returns null without a team", () => {
  assert.equal(build({}), null);
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
