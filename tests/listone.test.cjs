"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { teamNamesFromAssets } = require("../lib/listone.cjs");

test("teamNamesFromAssets extracts unique sorted team names from assets", () => {
  const assets = [
    { ownerTag: "Paolo" },
    { ownerTag: "Luca" },
    { ownerTag: "Marco" },
    { ownerTag: "paolo" }
  ];
  const names = teamNamesFromAssets(assets);
  // The function does not normalize case, so "Paolo" and "paolo" are distinct
  assert.deepEqual(names, ["Luca", "Marco", "Paolo", "paolo"]);
});

test("teamNamesFromAssets returns empty array for empty assets", () => {
  assert.deepEqual(teamNamesFromAssets([]), []);
});

test("teamNamesFromAssets filters blank owner tags", () => {
  const assets = [
    { ownerTag: "Paolo" },
    { ownerTag: "" },
    { ownerTag: "  " },
    { ownerTag: null }
  ];
  const names = teamNamesFromAssets(assets);
  assert.deepEqual(names, ["Paolo"]);
});

test("teamNamesFromAssets uses Italian locale for sorting", () => {
  const assets = [
    { ownerTag: "Àngela" },
    { ownerTag: "Zorro" },
    { ownerTag: "Andrea" }
  ];
  const names = teamNamesFromAssets(assets);
  assert.deepEqual(names, ["Andrea", "Àngela", "Zorro"]);
});

test("loadLeagueAssets requires valid league ID", async () => {
  const { loadLeagueAssets } = require("../lib/listone.cjs");
  await assert.rejects(
    () => loadLeagueAssets("invalid"),
    /Lega non valida/
  );
});
