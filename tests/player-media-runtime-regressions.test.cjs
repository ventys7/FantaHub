"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("stale imported team overrides are repaired when their roster does not match the Listone", () => {
  const { persistedTeamOverrideNeedsRepair } = require("../lib/player-media.cjs");
  const assets = Array.from({ length: 20 }, (_, index) => ({
    displayName: `Listone Player ${index + 1}`,
    docsName: `Listone Player ${index + 1}`,
    realTeam: "Liverpool"
  }));
  const wrongRoster = Array.from({ length: 25 }, (_, index) => ({
    id: String(index + 1),
    name: `Different Player ${index + 1}`,
    names: [`Different Player ${index + 1}`],
    teamName: "Liverpool Women",
    teamKey: "liverpool"
  }));
  const validRoster = assets.map((asset, index) => ({
    id: String(index + 100),
    name: asset.displayName,
    names: [asset.displayName],
    teamName: "Liverpool",
    teamKey: "liverpool"
  }));
  const persisted = { id: "999", name: "Liverpool", resolutionSource: "neon" };

  assert.equal(persistedTeamOverrideNeedsRepair(assets, persisted, wrongRoster), true);
  assert.equal(persistedTeamOverrideNeedsRepair(assets, persisted, validRoster), false);
  assert.equal(persistedTeamOverrideNeedsRepair(assets, { ...persisted, resolutionSource: "overlap" }, wrongRoster), false);
});

test("public media responses and browser refreshes cannot keep manual Neon overrides stale", () => {
  const api = source("api/player-media.js");
  const browser = source("js/player-media.js");
  const state = source("lib/media/manifest-state.cjs");
  const keys = source("js/club-keys.js");

  assert.match(api, /no-store, max-age=0, must-revalidate/);
  assert.match(browser, /const CACHE_VERSION = 13/);
  assert.match(browser, /cache: "no-store"/);
  assert.match(state, /Neon is the shared source of truth across serverless instances/);
  assert.match(state, /DIRECT_STATE_VERSION = 2/);
  assert.match(keys, /replace\(\/ø\/g, "o"\)/);
  assert.match(keys, /replace\(\/ł\/g, "l"\)/);
});

test("Nottingham Forest crest has a deterministic Kick-off fallback", () => {
  const browser = source("js/player-media.js");
  assert.match(browser, /"nottm forest": "351"/);
  assert.match(browser, /kick-off-tau\.vercel\.app/);
});
