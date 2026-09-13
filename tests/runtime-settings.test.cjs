"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadSettings(fetch) {
  const source = fs.readFileSync(path.join(__dirname, "../js/runtime-settings.js"), "utf8");
  const window = {
    LINEUP_FANTA: { leagueId: "fp" },
    LINEUP_LEAGUES: { fp: { csvUrl: "fallback.csv", leagueData: {} } }
  };
  const context = { Date, encodeURIComponent, fetch, Map, window };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "runtime-settings.js" });
  return window.LineupRuntimeSettings;
}

test("runtime settings retries after a transient API failure", async () => {
  let requests = 0;
  const settings = loadSettings(async () => {
    requests += 1;
    if (requests === 1) throw new Error("temporary outage");
    return {
      ok: true,
      json: async () => ({ leagueId: "fp", listoneCsvUrl: "live.csv", teams: {} })
    };
  });

  const fallback = await settings.get("fp");
  const live = await settings.get("fp");
  const cached = await settings.get("fp");

  assert.equal(fallback.listoneCsvUrl, "fallback.csv");
  assert.equal(live.listoneCsvUrl, "live.csv");
  assert.equal(cached.listoneCsvUrl, "live.csv");
  assert.equal(requests, 2);
});
