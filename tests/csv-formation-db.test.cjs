"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFormationDb } = require("../js/csv-formation-db.js");

const ASSETS = [
  { displayName: "Rossi", role: "D", realTeam: "INT", ownerTag: "Paolo", active: true, isFreeAgent: false, type: "standard" },
  { displayName: "Verdi", role: "A", realTeam: "JUV", ownerTag: "Paolo", active: true, isFreeAgent: false, type: "standard" },
  { displayName: "Blu", role: "C", realTeam: "MIL", ownerTag: "Luca", active: true, isFreeAgent: false, type: "standard" },
  { displayName: "Stopped", role: "D", realTeam: "ROM", ownerTag: "Paolo", active: false, isFreeAgent: false, type: "standard" },
  { displayName: "Free", role: "D", realTeam: "NAP", ownerTag: "Luca", active: true, isFreeAgent: true, type: "standard" },
  { displayName: "NoOwner", role: "D", realTeam: "LAZ", active: true, isFreeAgent: false, type: "standard" },
  { displayName: "GK A - GK B", role: "P", realTeam: "FIO", ownerTag: "Luca", active: true, isFreeAgent: false, type: "goalkeeper_block" }
];

test("buildFormationDb: keys teams by ownerTag, excluding inactive/free/no-owner", () => {
  const db = buildFormationDb(ASSETS);

  assert.deepEqual(Object.keys(db).sort(), ["Luca", "Paolo"]);
  assert.ok(!db.Luca.players.some((p) => p.n === "Free"));
  assert.ok(!db.Luca.players.some((p) => p.n === "NoOwner"));
  assert.ok(!db.Paolo.players.some((p) => p.n === "Stopped"));
});

test("buildFormationDb: outfield asset becomes a single player entry", () => {
  const db = buildFormationDb(ASSETS);

  const paolo = db.Paolo.players.map((p) => p.n).sort();
  assert.deepEqual(paolo, ["Rossi", "Verdi"]);
});

test("buildFormationDb: players sorted by ROLE_ORDER within a team", () => {
  const db = buildFormationDb(ASSETS);

  assert.deepEqual(db.Paolo.players.map((p) => p.r), ["D", "A"]); // D precedes A
  assert.deepEqual(db.Luca.players.map((p) => p.r), ["P", "P", "C"]); // P precedes C
});

test("buildFormationDb: goalkeeper_block expands into two linked GK entries", () => {
  const db = buildFormationDb(ASSETS);

  const gkEntries = db.Luca.players.filter((p) => p.r === "P");
  assert.equal(gkEntries.length, 2);
  assert.deepEqual(gkEntries.map((p) => p.n), ["GK A", "GK B"]);
  assert.equal(gkEntries[0].gkBlock, "GK A - GK B");
  assert.equal(gkEntries[0].isGkBlock, true);
  assert.equal(gkEntries[0].gkPartner, "GK B");
  assert.equal(gkEntries[1].gkPartner, "GK A");
});

test("buildFormationDb: single-name goalkeeper block yields one entry", () => {
  const db = buildFormationDb([
    { displayName: "Solo GK", role: "P", realTeam: "FIO", ownerTag: "Paolo", active: true, isFreeAgent: false, type: "goalkeeper_block" }
  ]);

  const entries = db.Paolo.players;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].n, "Solo GK");
  assert.equal(entries[0].gkPartner, "");
});
