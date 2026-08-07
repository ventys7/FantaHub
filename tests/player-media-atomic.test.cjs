"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const originalCwd = process.cwd();
let tempRoot;
let media;
let mode = "success";
let transientRosterFailures = 0;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function csvResponse() {
  const csv = [
    "Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto",
    "Paolo,A,Bukayo Saka,Arsenal,40,50",
    "Paolo,A,Gabriel Martinelli,Arsenal,30,35"
  ].join("\n");
  return new Response(csv, { status: 200, headers: { "content-type": "text/csv" } });
}

async function setup() {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-media-direct-"));
  await fs.mkdir(path.join(tempRoot, "data"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, "data", "settings.json"), JSON.stringify({
    version: 1,
    leagues: {
      fp: { listoneCsvUrl: "https://example.test/fp.csv", standingsCsvUrl: "", disciplineDocUrl: "" },
      pd: { listoneCsvUrl: "", standingsCsvUrl: "", disciplineDocUrl: "" }
    }
  }));
  process.chdir(tempRoot);
  process.env.BSD_API_KEY = "test-token";

  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "example.test") return csvResponse();
    if (url.pathname === "/api/teams/") {
      if (mode === "team-failure") return jsonResponse({ detail: "temporary outage" }, 503);
      assert.equal(url.searchParams.get("country"), "England");
      const page = Number(url.searchParams.get("page") || 1);
      if (page === 1) {
        return jsonResponse({
          count: 2,
          next: "https://sports.bzzoiro.com/api/teams/?country=England&page=2",
          previous: null,
          results: [{ id: 999, name: "Unrelated Town", country: "England" }]
        });
      }
      return jsonResponse({
        count: 2,
        next: null,
        previous: "https://sports.bzzoiro.com/api/teams/?country=England&page=1",
        results: [{ id: 18, name: "Arsenal", short_name: "Arsenal", country: "England" }]
      });
    }
    if (url.pathname === "/api/players/") {
      if (mode === "transient-team-abort" && transientRosterFailures === 0) {
        transientRosterFailures += 1;
        const error = new Error("This operation was aborted");
        error.name = "AbortError";
        throw error;
      }
      return jsonResponse({
        count: 2,
        results: [
          { id: 455, full_name: "Bukayo Saka" },
          { id: 456, full_name: "Gabriel Martinelli" }
        ]
      });
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

async function assertNoPlayerMediaFiles() {
  await assert.rejects(fs.stat(path.join(tempRoot, ".lineup-runtime", "media")), /ENOENT/);
  await assert.rejects(fs.stat(path.join(tempRoot, ".lineup-runtime", "player-faces")), /ENOENT/);
}

test("player media uses direct BSD URLs without Blob writes", async (t) => {
  await setup();
  t.after(teardown);

  await t.test("matching diagnostic uses the real CSV/BSD path without downloading images", async () => {
    mode = "success";
    const report = await media.diagnoseFreshMatching("fp");
    assert.equal(report.totalPlayers, 2);
    assert.equal(report.teamsOk, 1);
    assert.equal(report.counts.automatic, 2);
    await assertNoPlayerMediaFiles();
  });

  await t.test("a transient BSD roster timeout is retried instead of losing the club", async () => {
    mode = "transient-team-abort";
    transientRosterFailures = 0;
    const report = await media.diagnoseFreshMatching("fp");
    assert.equal(transientRosterFailures, 1);
    assert.equal(report.teamsOk, 1);
    assert.equal(report.counts.automatic, 2);
  });

  await t.test("the public manifest points directly to BSD and never creates staging or image files", async () => {
    mode = "success";
    const manifest = await media.readManifest("fp", { fresh: true });
    assert.equal(manifest.refresh.pending, false);
    assert.equal(Object.keys(manifest.players).length, 2);
    assert.equal(manifest.players["bukayo saka|arsenal"].photoUrl, "https://sports.bzzoiro.com/img/player/455/");
    assert.equal(manifest.players["gabriel martinelli|arsenal"].photoUrl, "https://sports.bzzoiro.com/img/player/456/");
    assert.equal(manifest.players["bukayo saka|arsenal"].storageVerified, false);
    await assertNoPlayerMediaFiles();
  });

  await t.test("candidate search is grouped by similar names, club roster and optional league database", async () => {
    mode = "success";
    await media.readManifest("fp", { fresh: true });
    const local = await media.searchProvider("fp", "Saka", "Arsenal");
    assert.equal(local.similar[0].id, "455");
    assert.ok(Array.isArray(local.roster));
    assert.deepEqual(local.database, []);
    const expanded = await media.searchProvider("fp", "Saka", "Arsenal", { includeDatabase: true });
    assert.ok(Array.isArray(expanded.database));
  });

  await t.test("legacy sync entry points only rebuild the direct manifest", async () => {
    mode = "success";
    const started = await media.startMissingSync("fp");
    const processed = await media.processFullSync("fp");
    const synced = await media.syncMissing("fp");
    assert.equal(started.refresh.pending, false);
    assert.equal(processed.refresh.pending, false);
    assert.equal(synced.manifest.refresh.pending, false);
    assert.equal(synced.remaining, 0);
    await assertNoPlayerMediaFiles();
  });

  await t.test("a failed forced rebuild degrades instead of throwing and writes no fallback data to Blob", async () => {
    mode = "team-failure";
    const manifest = await media.readManifest("fp", { fresh: true });
    assert.equal(manifest.degraded, true);
    assert.match(String(manifest.degradedMessage), /BSD HTTP 503/);
    const saka = manifest.players["bukayo saka|arsenal"];
    assert.equal(saka.status, "resolved", "la entry risolta prima dell'outage viene conservata");
    assert.match(String(saka.lastRefreshError), /BSD HTTP 503/);
    await assertNoPlayerMediaFiles();
  });
});
