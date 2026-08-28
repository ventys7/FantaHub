"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolve, getGroups } = require("../js/gk-blocks.js");

// Goalkeepers across three "blocks": A (idx 0), B (idx 2), and an unblocked single (idx 3).
function makeTeam() {
  return [
    { r: "P", t: "GK1", gkBlock: "A" }, // 0
    { r: "D", t: "D1" },                 // 1
    { r: "P", t: "GK2", gkBlock: "B" }, // 2
    { r: "P", t: "GK3" }                // 3 (no block -> single)
  ];
}

test("getGroups: groups goalkeepers by block, unblocked become single:<index>", () => {
  const groups = getGroups(makeTeam());
  const keys = groups.map((group) => group.key).sort();

  assert.deepEqual(keys, ["A", "B", "single:3"]);
  const blockA = groups.find((g) => g.key === "A");
  assert.equal(blockA.blockName, "A");
  assert.equal(blockA.players.length, 1);
  assert.equal(blockA.players[0].index, 0);
});

test("resolve: no selection -> no disabled blocks", () => {
  const result = resolve(makeTeam(), []);

  assert.equal(result.selectedIndex, null);
  assert.equal(result.selectedBlock, null);
  assert.deepEqual(result.disabledBlocks, []);
});

test("resolve: selecting a single (unblocked) GK disables nothing", () => {
  const result = resolve(makeTeam(), [3]);

  assert.equal(result.selectedIndex, 3);
  assert.equal(result.selectedBlock, null);
  assert.deepEqual(result.disabledBlocks, []);
});

test("resolve: selecting block A disables every other named block (not singles)", () => {
  const result = resolve(makeTeam(), [0]);

  assert.equal(result.selectedIndex, 0);
  assert.equal(result.selectedBlock, "A");
  assert.deepEqual(result.disabledBlocks, ["B"]);
});

test("resolve: selecting block B disables block A", () => {
  const result = resolve(makeTeam(), [2]);

  assert.equal(result.selectedIndex, 2);
  assert.equal(result.selectedBlock, "B");
  assert.deepEqual(result.disabledBlocks, ["A"]);
});
