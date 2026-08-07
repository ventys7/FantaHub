"use strict";

// Resilienza agli outage del provider BSD (A1) e filtro squadre
// femminili/giovanili per tutto il percorso (A2).
//
// Il mock di global.fetch copre: CSV del Listone (example.test), directory
// squadre BSD (sports.bzzoiro.com/api/teams/) e rose (api/players/). La modalita'
// "down" fa fallire la fetch della directory con Error("fetch failed") e deve
// essere gestita da buildDirectState senza eccezioni.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const originalCwd = process.cwd();
let tempRoot;
let media;
let mode = "ok";
const requestedTeams = new Set();

const CSV = [
  "Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto",
  "Paolo,A,Bukayo Saka,Arsenal,40,50",
  "Paolo,A,Gabriel Martinelli,Arsenal,30,35",
  "Paolo,P,David Raya,Arsenal,20,28",
  "Paolo,D,Leandro Trossard,Arsenal,25,32"
].join("\n");

const ROSTERS = {
  "18": [
    { id: 455, full_name: "Bukayo Saka" },
    { id: 456, full_name: "Gabriel Martinelli" },
    { id: 457, full_name: "David Raya" },
    { id: 458, full_name: "Leandro Trossard" }
  ],
  "19": [
    { id: 501, full_name: "Leah Williamson" },
    { id: 502, full_name: "Beth Mead" }
  ]
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function csvResponse() {
  return new Response(CSV, { status: 200, headers: { "content-type": "text/csv" } });
}

async function setup() {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-bsd-resilience-"));
  await fs.mkdir(path.join(tempRoot, "data"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, "data", "settings.json"), JSON.stringify({
    version: 1,
    leagues: {
      fp: { listoneCsvUrl: "https://example.test/fp.csv", standingsCsvUrl: "", disciplineDocUrl: "" },
      pd: { listoneCsvUrl: "https://example.test/fp.csv", standingsCsvUrl: "", disciplineDocUrl: "" }
    }
  }));
  process.chdir(tempRoot);
  process.env.BSD_API_KEY = "test-token";
  mode = "ok";
  requestedTeams.clear();

  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "example.test") return csvResponse();
    if (url.pathname === "/api/teams/") {
      if (mode === "down") throw new Error("fetch failed");
      assert.equal(url.searchParams.get("country"), "England");
      return jsonResponse({
        count: 2,
        next: null,
        results: [
          { id: 18, name: "Arsenal FC", country: "England" },
          { id: 19, name: "Arsenal Women", country: "England" }
        ]
      });
    }
    if (url.pathname === "/api/players/") {
      const team = url.searchParams.get("team");
      requestedTeams.add(String(team));
      const roster = ROSTERS[String(team)] || [];
      return jsonResponse({ count: roster.length, next: null, results: roster });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  media = require(path.join(originalCwd, "lib", "player-media.cjs"));
}

async function teardown() {
  process.chdir(originalCwd);
  delete process.env.BSD_API_KEY;
  delete global.fetch;
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
}

test("BSD directory down: stato degradato senza eccezioni e reason su ogni giocatore", async (t) => {
  await setup();
  t.after(teardown);

  mode = "down";
  const status = await media.directMediaStatus("fp", { fresh: true });
  assert.equal(status.degraded, true);
  assert.match(status.degradedMessage, /fetch failed/);
  assert.ok(Array.isArray(status.teamIssues));
  assert.equal(status.teamIssues.length, 1, "un solo issue riassuntivo, non spam di timeout");
  assert.equal(status.teamIssues[0].key, "bsd-directory");
  assert.match(String(status.teamIssues[0].error), /fetch failed/);

  const entries = Object.values(status.players);
  assert.ok(entries.length >= 4, `tutti i giocatori restano nel manifest: ${entries.length}`);
  entries.forEach((entry) => {
    assert.equal(entry.status, "unresolved");
    assert.match(String(entry.error), /fetch failed/, "la reason degradata NON e' 'Giocatore non trovato'");
    assert.doesNotMatch(String(entry.error), /Giocatore non trovato/);
  });

  const manifest = await media.refreshDirectManifest("fp");
  assert.equal(manifest.degraded, true);
  assert.match(manifest.degradedMessage, /fetch failed/);
});

test("un giocatore risolto prima dell'outage mantiene la foto quando la rebuild degrada", async (t) => {
  await setup();
  t.after(teardown);

  const ok = await media.directMediaStatus("fp", { fresh: true });
  assert.equal(ok.degraded, undefined, "tutto ok: nessun flag degraded");
  const sakaKey = "bukayo saka|arsenal";
  assert.equal(ok.players[sakaKey].status, "resolved");
  const preservedUrl = ok.players[sakaKey].photoUrl;

  mode = "down";
  const degraded = await media.directMediaStatus("fp", { fresh: true });
  assert.equal(degraded.degraded, true);
  assert.equal(degraded.players[sakaKey].status, "resolved", "entry risolta precedente conservata");
  assert.equal(degraded.players[sakaKey].photoUrl, preservedUrl);
  assert.match(String(degraded.players[sakaKey].lastRefreshError), /fetch failed/);
  assert.equal(degraded.teamIssues.length, 1);
});
