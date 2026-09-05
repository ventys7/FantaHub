"use strict";

// Quota BSD globale anti-429: circuito senza retry, stop del giro, niente
// rebuild su semplice lettura, attach a checkpoint freschi. Fixture fittizie.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const originalCwd = process.cwd();
let tempRoot;

const MEDIA_MODULES = [
  "lib/media/bsd-provider.cjs",
  "lib/media/manifest-state.cjs",
  "lib/media/name-matching.cjs",
  "lib/media/face-bridge.cjs",
  "lib/player-media.cjs"
];

function clearMediaCache() {
  for (const relative of MEDIA_MODULES) {
    try { delete require.cache[require.resolve(path.join(originalCwd, relative))]; } catch {}
  }
  try { delete require.cache[require.resolve("../lib/neon.cjs")]; } catch {}
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function csvResponse() {
  return new Response([
    "Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto",
    "Club Alfa,A,Giocatore Uno,Club Alfa,30,35",
    "Club Beta,A,Giocatore Due,Club Beta,18,22"
  ].join("\n"), { status: 200, headers: { "content-type": "text/csv" } });
}

function bsdOkStub(counters) {
  return async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "example.test") return csvResponse();
    if (url.hostname !== "sports.bzzoiro.com") throw new Error(`Unexpected fetch: ${url}`);
    counters.bsd += 1;
    if (url.pathname === "/api/teams/") {
      return jsonResponse({
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 101, name: "Club Alfa", short_name: "Club Alfa", country: "England" },
          { id: 102, name: "Club Beta", short_name: "Club Beta", country: "England" }
        ]
      });
    }
    if (url.pathname === "/api/players/") {
      if (url.searchParams.get("search")) return jsonResponse({ count: 0, results: [] });
      const team = Number(url.searchParams.get("team") || 0);
      const roster = team === 101
        ? [{ id: 9001, full_name: "Giocatore Uno" }]
        : [{ id: 9002, full_name: "Giocatore Due" }];
      return jsonResponse({ count: roster.length, results: roster });
    }
    if (url.pathname.startsWith("/api/players/")) return jsonResponse({ transfers: [] });
    return jsonResponse({});
  };
}

async function setupEnv() {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-bsd-quota-"));
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
  process.env.FACE_BRIDGE_ENABLED = "0";
  clearMediaCache();
}

async function teardownEnv() {
  process.chdir(originalCwd);
  delete process.env.BSD_API_KEY;
  delete process.env.FACE_BRIDGE_ENABLED;
  delete process.env.REFRESH_STEP_BUDGET_MS;
  delete process.env.BSD_DAILY_QUOTA;
  delete global.fetch;
  clearMediaCache();
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
  tempRoot = null;
}

function freshMedia() {
  return require(path.join(originalCwd, "lib", "player-media.cjs"));
}

test("bsd circuit opens on 429: no retry, no further network", async () => {
  await setupEnv();
  try {
    const counters = { bsd: 0 };
    global.fetch = async (input) => {
      const url = new URL(String(input));
      counters.bsd += 1;
      return jsonResponse({ detail: "The free football API allows 7,500 requests a day. It resets at midnight UTC." }, 429);
    };
    const provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
    const first = await provider.bsdGet("/api/teams/", { country: "England" }).then(
      () => { throw new Error("doveva fallire"); },
      (error) => error
    );
    assert.equal(first.quotaExhausted, true);
    assert.equal(counters.bsd, 1);
    await provider.bsdGet("/api/teams/", { country: "England" }).then(
      () => { throw new Error("doveva fallire"); },
      () => {}
    );
    assert.equal(counters.bsd, 1);
    assert.equal(provider.bsdCircuitOpen(), true);
  } finally {
    await teardownEnv();
  }
});

test("non-quota errors still retry", async () => {
  await setupEnv();
  try {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      if (calls < 3) return jsonResponse({ message: "boom" }, 500);
      return jsonResponse({ ok: true });
    };
    const provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
    const payload = await provider.bsdGet("/api/teams/", { country: "England" });
    assert.deepEqual(payload, { ok: true });
    assert.equal(calls, 3);
  } finally {
    await teardownEnv();
  }
});

test("step aborts on quota and later steps make no BSD calls", async () => {
  await setupEnv();
  try {
    const counters = { bsd: 0, csv: 0 };
    global.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "example.test") { counters.csv += 1; return csvResponse(); }
      counters.bsd += 1;
      return jsonResponse({ detail: "quota finita" }, 429);
    };
    const media = freshMedia();
    const first = await media.refreshDirectStep("fp", { reset: true });
    assert.equal(first.quotaExhausted, true);
    assert.equal(first.pending, false);
    assert.equal(counters.bsd, 1);
    assert.ok(first.quota.callsToday >= 1);
    const second = await media.refreshDirectStep("fp", {});
    assert.equal(second.quotaExhausted, true);
    assert.equal(counters.bsd, 1);
    assert.equal(counters.csv, 1);
  } finally {
    await teardownEnv();
  }
});

test("refresh attaches to a fresh checkpoint instead of resetting", async () => {
  await setupEnv();
  try {
    process.env.REFRESH_STEP_BUDGET_MS = "1";
    const counters = { bsd: 0, csv: 0 };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const base = bsdOkStub(counters);
    global.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "example.test") counters.csv += 1;
      await sleep(25);
      return base(input);
    };
    const media = freshMedia();
    const first = await media.refreshDirectStep("fp", { reset: true });
    assert.equal(first.pending, true);
    assert.equal(counters.csv, 1);
    delete process.env.REFRESH_STEP_BUDGET_MS;
    let result = await media.refreshDirectStep("fp", { reset: true });
    let guard = 0;
    while (result.pending && guard < 60) {
      guard += 1;
      result = await media.refreshDirectStep("fp", {});
    }
    assert.equal(result.pending, false);
    assert.equal(counters.csv, 1);
    assert.ok(result.manifest);
  } finally {
    await teardownEnv();
  }
});

test("stale persisted manifest is served without network", async () => {
  await setupEnv();
  let captured = null;
  try {
    const counters = { bsd: 0 };
    global.fetch = bsdOkStub(counters);
    const media = freshMedia();
    let result = await media.refreshDirectStep("fp", { reset: true });
    let guard = 0;
    while (result.pending && guard < 60) {
      guard += 1;
      result = await media.refreshDirectStep("fp", {});
    }
    assert.equal(result.pending, false);
    captured = result.state;
    assert.ok(captured?.manifest?.players);
  } finally {
    await teardownEnv();
  }

  await setupEnv();
  const NEON_PATH = require.resolve(path.join(originalCwd, "lib", "neon.cjs"));
  const originalNeon = require.cache[NEON_PATH];
  const bsdCalls = { count: 0 };
  try {
    clearMediaCache();
    require.cache[NEON_PATH] = {
      id: NEON_PATH,
      filename: NEON_PATH,
      loaded: true,
      exports: {
        databaseConfigured: () => true,
        readManifestCache: async () => ({
          state: captured,
          generatedAt: Date.now() - 7 * 3600 * 1000
        }),
        writeManifestCache: async () => {},
        readPlayerOverrides: async () => ({}),
        readTeamOverrides: async () => ({}),
        readRefreshCheckpoint: async () => null,
        writeRefreshCheckpoint: async () => {},
        clearRefreshCheckpoint: async () => {},
        readRuntimeSetting: async () => null,
        writeRuntimeSetting: async () => ({})
      }
    };
    global.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "sports.bzzoiro.com") {
        bsdCalls.count += 1;
        throw new Error("BSD non deve essere chiamata");
      }
      return csvResponse();
    };
    const manifestState = require(path.join(originalCwd, "lib", "media", "manifest-state.cjs"));
    const state = await manifestState.buildDirectState("fp", {});
    assert.deepEqual(state.manifest.players, captured.manifest.players);
    assert.equal(bsdCalls.count, 0);
  } finally {
    if (originalNeon) require.cache[NEON_PATH] = originalNeon;
    else delete require.cache[NEON_PATH];
    await teardownEnv();
  }
});

test("status payload exposes quota and last sync", async () => {
  await setupEnv();
  try {
    const counters = { bsd: 0 };
    global.fetch = bsdOkStub(counters);
    const media = freshMedia();
    let result = await media.refreshDirectStep("fp", { reset: true });
    let guard = 0;
    while (result.pending && guard < 60) {
      guard += 1;
      result = await media.refreshDirectStep("fp", {});
    }
    assert.equal(result.pending, false);
    const status = await media.directMediaStatus("fp", {});
    assert.ok(status.quota.callsToday > 0);
    assert.equal(status.quota.limit, 7500);
    assert.equal(status.quota.exhausted, false);
    assert.ok(status.lastSyncAt);
  } finally {
    await teardownEnv();
  }
});
