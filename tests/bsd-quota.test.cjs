"use strict";

// Quota BSD globale anti-429: circuito senza retry, stop del giro, niente
// rebuild su semplice lettura, attach a checkpoint freschi. Fixture fittizie.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { installSafeFetchMock } = require("./helpers/mock-safe-fetch.cjs");

const originalCwd = process.cwd();
installSafeFetchMock(originalCwd);
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
    "Club Alfa,A,Fantasiosa Alfa,Club Alfa,18,22",
    "Club Beta,A,Giocatore Due,Club Beta,18,22",
    "Club Beta,A,Fantasiosa Beta,Club Beta,18,22"
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
    if (url.pathname === "/api/seasons/") {
      return jsonResponse({ results: [{ id: 1, name: "2025/2026", year: 2025, start_date: "2025-01-01", is_current: true }] });
    }
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

function quotaNeonStub() {
  let record = null;
  const readBsdQuota = async (date) => {
    if (!record || record.date !== date) record = { date, calls: 0, rateLimitedUntil: null };
    return { ...record };
  };
  return {
    readBsdQuota,
    incrementBsdQuota: async (delta, date) => {
      await readBsdQuota(date);
      record.calls += Number(delta);
      return { ...record };
    },
    markBsdQuotaRateLimited: async (until, date) => {
      await readBsdQuota(date);
      record.rateLimitedUntil = until;
      return { ...record };
    }
  };
}

function refreshLeaseNeonStub() {
  let checkpoint = null;
  let fencingToken = 0;
  return {
    acquireRefreshCheckpoint: async (league, owner) => ({
      checkpoint,
      owner,
      fencingToken: ++fencingToken
    }),
    renewRefreshCheckpoint: async () => true,
    writeRefreshCheckpoint: async (league, payload) => { checkpoint = payload; return true; },
    clearRefreshCheckpoint: async () => { checkpoint = null; return true; },
    publishManifestAndClearRefreshCheckpoint: async () => { checkpoint = null; return true; },
    releaseRefreshCheckpoint: async () => true,
    upsertPlayerOverrideWithRefreshLease: async () => true,
    upsertTeamOverridesWithRefreshLease: async () => true
  };
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

test("failed quota persistence keeps BSD calls pending for retry", async () => {
  await setupEnv();
  try {
    global.fetch = async () => jsonResponse({ ok: true });
    const provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
    await provider.bsdGet("/api/teams/", { country: "England" });

    await assert.rejects(
      provider.commitBsdCallCount(async () => { throw new Error("Neon unavailable"); }),
      /Neon unavailable/
    );
    let retriedDelta = 0;
    await provider.commitBsdCallCount(async (delta) => { retriedDelta = delta; });

    assert.equal(retriedDelta, 1);
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

test("one-shot preflight throws classified quota metadata", async () => {
  await setupEnv();
  const neonPath = require.resolve(path.join(originalCwd, "lib", "neon.cjs"));
  const originalNeon = require.cache[neonPath];
  try {
    let quotaReads = 0;
    require.cache[neonPath] = {
      id: neonPath,
      filename: neonPath,
      loaded: true,
      exports: {
        ...refreshLeaseNeonStub(),
        databaseConfigured: () => true,
        readBsdQuota: async (date) => {
          quotaReads += 1;
          if (quotaReads > 1) throw new Error("quota read failed");
          return { date, calls: 7500, rateLimitedUntil: null };
        },
        incrementBsdQuota: async () => { throw new Error("unexpected increment"); },
        markBsdQuotaRateLimited: async () => { throw new Error("unexpected rate-limit write"); },
        readManifestCache: async () => null,
        readPlayerOverrides: async () => ({}),
        readTeamOverrides: async () => ({}),
        readRuntimeSetting: async () => null,
        writeRuntimeSetting: async () => ({})
      }
    };
    const media = freshMedia();

    await assert.rejects(media.refreshDirectManifest("fp"), (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.quotaExhausted, true);
      assert.equal(error.status, 429);
      assert.equal(error.quota.callsToday >= 1, true);
      assert.equal(error.quota.limit, 7500);
      assert.equal(error.quota.exhausted, true);
      assert.equal(Number.isFinite(Date.parse(error.quota.resetAt)), true);
      assert.equal(error.quota.rateLimitedUntil, null);
      return true;
    });
    assert.equal(quotaReads, 1);
  } finally {
    if (originalNeon) require.cache[neonPath] = originalNeon;
    else delete require.cache[neonPath];
    await teardownEnv();
  }
});

test("one-shot live directory and team quota failures keep canonical metadata", async (t) => {
  for (const failure of ["directory", "team"]) {
    await t.test(failure, async () => {
      await setupEnv();
      try {
        global.fetch = async (input) => {
          const url = new URL(String(input));
          if (url.hostname === "example.test") return csvResponse();
          if (url.pathname === "/api/seasons/") {
            return jsonResponse({ results: [{ id: 1, name: "2025/2026", year: 2025, is_current: true }] });
          }
          if (url.pathname === "/api/teams/") {
            if (failure === "directory") return jsonResponse({ detail: "quota finita" }, 429);
            return jsonResponse({
              count: 2,
              results: [
                { id: 101, name: "Club Alfa", country: "England" },
                { id: 102, name: "Club Beta", country: "England" }
              ]
            });
          }
          if (url.pathname === "/api/players/") return jsonResponse({ detail: "quota finita" }, 429);
          throw new Error(`Unexpected fetch: ${url}`);
        };
        const provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
        await provider.resolveProviderSeason("fp");
        const media = freshMedia();

        await assert.rejects(media.refreshDirectManifest("fp"), (error) => {
          assert.ok(error instanceof Error);
          assert.equal(error.quotaExhausted, true);
          assert.equal(error.status, 429);
          assert.equal(error.quota.exhausted, true);
          assert.equal(error.quota.limit, 7500);
          assert.equal(Number.isFinite(Date.parse(error.quota.resetAt)), true);
          assert.equal(Number.isFinite(error.quota.callsToday), true);
          assert.ok(Object.hasOwn(error.quota, "rateLimitedUntil"));
          return true;
        });
      } finally {
        await teardownEnv();
      }
    });
  }
});

test("one-shot search quota failure is classified and accounted once", async () => {
  await setupEnv();
  try {
    const counters = { bsd: 0, search: 0 };
    global.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "example.test") {
        return new Response([
          "Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto",
          "Arsenal,A,Known Player,Arsenal,30,35",
          "Arsenal,A,Missing Player,Arsenal,18,22"
        ].join("\n"), { status: 200, headers: { "content-type": "text/csv" } });
      }
      counters.bsd += 1;
      if (url.pathname === "/api/teams/") {
        return jsonResponse({ count: 1, results: [{ id: 18, name: "Arsenal", country: "England" }] });
      }
      if (url.pathname === "/api/players/" && url.searchParams.get("search")) {
        counters.search += 1;
        return jsonResponse({ detail: "quota finita" }, 429);
      }
      if (url.pathname === "/api/players/") {
        return jsonResponse({ count: 1, results: [{ id: 9001, full_name: "Known Player" }] });
      }
      if (url.pathname.startsWith("/api/players/")) return jsonResponse({ transfers: [] });
      if (url.pathname === "/api/seasons/") {
        return jsonResponse({ results: [{ id: 1, name: "2025/2026", year: 2025, is_current: true }] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
    const media = freshMedia();

    await assert.rejects(media.refreshDirectManifest("fp"), (error) => {
      assert.equal(error.quotaExhausted, true);
      assert.equal(error.status, 429);
      assert.equal(error.quota.callsToday, counters.bsd);
      assert.equal(error.quota.exhausted, true);
      assert.equal(error.quota.rateLimitedUntil, error.quota.resetAt);
      return true;
    });
    assert.equal(counters.search, 1);
  } finally {
    await teardownEnv();
  }
});

test("quota accounting failures preserve the marked one-shot error", async () => {
  await setupEnv();
  const neonPath = require.resolve(path.join(originalCwd, "lib", "neon.cjs"));
  const originalNeon = require.cache[neonPath];
  try {
    let quotaReads = 0;
    require.cache[neonPath] = {
      id: neonPath,
      filename: neonPath,
      loaded: true,
      exports: {
        ...refreshLeaseNeonStub(),
        databaseConfigured: () => true,
        readBsdQuota: async (date) => {
          quotaReads += 1;
          if (quotaReads > 1) throw new Error("quota read failed");
          return { date, calls: 0, rateLimitedUntil: null };
        },
        incrementBsdQuota: async () => { throw new Error("quota increment failed"); },
        markBsdQuotaRateLimited: async () => { throw new Error("quota rate-limit failed"); },
        readManifestCache: async () => null,
        readPlayerOverrides: async () => ({}),
        readTeamOverrides: async () => ({}),
        readRuntimeSetting: async () => null,
        writeRuntimeSetting: async () => ({})
      }
    };
    global.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "example.test") return csvResponse();
      if (url.pathname === "/api/teams/") return jsonResponse({ detail: "quota finita" }, 429);
      throw new Error(`Unexpected fetch: ${url}`);
    };
    const media = freshMedia();

    await assert.rejects(media.refreshDirectManifest("fp"), (error) => {
      assert.equal(error.quotaExhausted, true);
      assert.equal(error.status, 429);
      assert.equal(Number.isFinite(error.quota.callsToday), true);
      assert.equal(error.quota.callsToday >= 0, true);
      assert.equal(Number.isFinite(error.quota.limit), true);
      assert.equal(error.quota.limit > 0, true);
      assert.equal(error.quota.exhausted, true);
      assert.equal(Date.parse(error.quota.resetAt) > Date.now(), true);
      assert.equal(error.quota.rateLimitedUntil, null);
      return true;
    });
  } finally {
    if (originalNeon) require.cache[neonPath] = originalNeon;
    else delete require.cache[neonPath];
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
    const quota = quotaNeonStub();
    require.cache[NEON_PATH] = {
      id: NEON_PATH,
      filename: NEON_PATH,
      loaded: true,
      exports: {
        ...quota,
        databaseConfigured: () => true,
        readManifestCache: async () => ({
          state: captured,
          generatedAt: Date.now() - 7 * 3600 * 1000
        }),
        writeManifestCache: async () => {},
        readPlayerOverrides: async () => ({}),
        readTeamOverrides: async () => ({}),
        readRefreshCheckpoint: async () => null,
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

test("second full refresh reuses transfers/searches/seasons, refetches rosters and directory", async () => {
  await setupEnv();
  const NEON_PATH = require.resolve(path.join(originalCwd, "lib", "neon.cjs"));
  const originalNeon = require.cache[NEON_PATH];
  const store = {};
  const quota = quotaNeonStub();
  const counters = { roster: 0, transfer: 0, directory: 0, season: 0, search: 0 };
  try {
    require.cache[NEON_PATH] = {
      id: NEON_PATH,
      filename: NEON_PATH,
      loaded: true,
      exports: {
        ...quota,
        ...refreshLeaseNeonStub(),
        databaseConfigured: () => true,
        readManifestCache: async () => null,
        writeManifestCache: async () => {},
        readPlayerOverrides: async () => ({}),
        readTeamOverrides: async () => ({}),
        upsertTeamOverrides: async () => {},
        readRefreshCheckpoint: async () => null,
        readRuntimeSetting: async (key) => (store[key] ? { value: store[key] } : null),
        writeRuntimeSetting: async (key, value) => { store[key] = value; return { value }; }
      }
    };
    const csv4 = [
      "Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto",
      "Club Alfa,A,Giocatore A1,Club Alfa,30,35",
      "Club Alfa,A,Giocatore A2,Club Alfa,30,35",
      "Club Alfa,A,Giocatore A3,Club Alfa,30,35",
      "Club Alfa,A,Fantasiosa Alfa,Club Alfa,18,22",
      "Club Beta,A,Giocatore B1,Club Beta,30,35",
      "Club Beta,A,Giocatore B2,Club Beta,30,35",
      "Club Beta,A,Giocatore B3,Club Beta,30,35",
      "Club Beta,A,Fantasiosa Beta,Club Beta,18,22"
    ].join("\n");
    const rosters4 = {
      101: ["Giocatore A1", "Giocatore A2", "Giocatore A3"],
      102: ["Giocatore B1", "Giocatore B2", "Giocatore B3"]
    };
    let playerId = 9000;
    const rosterByTeam = {};
    for (const [team, names] of Object.entries(rosters4)) {
      rosterByTeam[team] = names.map((full_name) => ({ id: (playerId += 1), full_name }));
    }
    global.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "example.test") {
        return new Response(csv4, { status: 200, headers: { "content-type": "text/csv" } });
      }
      if (url.pathname === "/api/teams/") {
        counters.directory += 1;
        return jsonResponse({
          count: 2, next: null, previous: null,
          results: [
            { id: 101, name: "Club Alfa", short_name: "Club Alfa", country: "England" },
            { id: 102, name: "Club Beta", short_name: "Club Beta", country: "England" }
          ]
        });
      }
      if (url.pathname === "/api/players/") {
        if (url.searchParams.get("search")) { counters.search += 1; return jsonResponse({ count: 0, results: [] }); }
        counters.roster += 1;
        const roster = rosterByTeam[Number(url.searchParams.get("team") || 0)] || [];
        return jsonResponse({ count: roster.length, results: roster });
      }
      if (url.pathname.startsWith("/api/players/")) { counters.transfer += 1; return jsonResponse({ transfers: [] }); }
      if (url.pathname === "/api/seasons/") {
        counters.season += 1;
        return jsonResponse({ results: [{ id: 1, name: "2025/2026", year: 2025, start_date: "2025-01-01", is_current: true }] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
    const runFullRefresh = async () => {
      const media = freshMedia();
      let result = await media.refreshDirectStep("fp", { reset: true });
      let guard = 0;
      while (result.pending && guard < 60) {
        guard += 1;
        result = await media.refreshDirectStep("fp", {});
      }
      assert.equal(result.pending, false);
      return result;
    };
    await runFullRefresh();
    const afterFirst = { ...counters };
    assert.ok(afterFirst.transfer > 0, "il primo giro legge i transfer");
    assert.ok(afterFirst.directory > 0, "il primo giro legge la directory");
    // Nuova "istanza serverless": i Map in memoria si svuotano, resta solo Neon.
    clearMediaCache();
    delete require.cache[NEON_PATH];
    require.cache[NEON_PATH] = {
      id: NEON_PATH,
      filename: NEON_PATH,
      loaded: true,
      exports: {
        ...quota,
        ...refreshLeaseNeonStub(),
        databaseConfigured: () => true,
        readManifestCache: async () => null,
        writeManifestCache: async () => {},
        readPlayerOverrides: async () => ({}),
        readTeamOverrides: async () => ({}),
        upsertTeamOverrides: async () => {},
        readRefreshCheckpoint: async () => null,
        readRuntimeSetting: async (key) => (store[key] ? { value: store[key] } : null),
        writeRuntimeSetting: async (key, value) => { store[key] = value; return { value }; }
      }
    };
    await runFullRefresh();
    assert.equal(counters.transfer, afterFirst.transfer, "transfer riusati dalla cache");
    assert.equal(counters.search, afterFirst.search, "ricerche riusate dalla cache");
    assert.equal(counters.season, afterFirst.season, "stagione riusata dalla cache");
    assert.ok(counters.roster > afterFirst.roster, "rose ricaricate (non cachate)");
    assert.ok(counters.directory > afterFirst.directory, "directory ricaricata (non cachata: il down deve restare visibile)");
  } finally {
    if (originalNeon) require.cache[NEON_PATH] = originalNeon;
    else delete require.cache[NEON_PATH];
    await teardownEnv();
  }
});

test("persisted search hits respect TTL, misses retry sooner", async () => {
  await setupEnv();
  try {
    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      return jsonResponse({ count: 1, results: [{ id: 7, full_name: "Giocatore Uno" }] });
    };
    const provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
    const key = (name) => `${provider.normalize(name)}|${provider.normalize("England")}`;
    provider.restoreBsdCaches({ searches: { [key("Giocatore Uno")]: { value: [{ id: 7 }], storedAt: Date.now() } } });
    assert.deepEqual(await provider.searchPlayerByName("Giocatore Uno", "England"), [{ id: 7 }]);
    assert.equal(fetchCalls, 0);
    provider.clearSearchCache();
    provider.restoreBsdCaches({ searches: { [key("Giocatore Uno")]: { value: [{ id: 7 }], storedAt: 0 } } });
    await provider.searchPlayerByName("Giocatore Uno", "England");
    assert.ok(fetchCalls > 0, "voce scaduta: torna in rete");
    const afterExpired = fetchCalls;
    provider.clearSearchCache();
    provider.restoreBsdCaches({ searches: { [key("Introvabile")]: { value: [], storedAt: Date.now() } } });
    assert.deepEqual(await provider.searchPlayerByName("Introvabile", "England"), []);
    assert.equal(fetchCalls, afterExpired, "miss fresca: niente rete");
    const dump = provider.dumpBsdCaches();
    assert.ok(dump);
    JSON.parse(JSON.stringify(dump));
  } finally {
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

test("BSD_DAILY_QUOTA is finite and bounded", async (t) => {
  const envName = "BSD_DAILY_QUOTA";
  const modulePath = require.resolve(path.join(originalCwd, "lib", "media", "manifest-state.cjs"));
  const originalEnv = process.env[envName];
  const originalModule = require.cache[modulePath];
  t.after(() => {
    if (originalEnv === undefined) delete process.env[envName];
    else process.env[envName] = originalEnv;
    if (originalModule) require.cache[modulePath] = originalModule;
    else delete require.cache[modulePath];
  });

  delete process.env[envName];
  delete require.cache[modulePath];
  const manifestState = require(modulePath);
  assert.equal(typeof manifestState.quotaLimit, "function", "quotaLimit must be exported");

  const rows = [
    ["unset", undefined, 7500],
    ["empty", "", 7500],
    ["NaN", "NaN", 7500],
    ["Infinity", "Infinity", 7500],
    ["negative", "-1", 1],
    ["zero", "0", 1],
    ["oversized", "9999999999999", 50000],
    ["valid interior", "12345", 12345]
  ];
  for (const [name, value, expected] of rows) {
    await t.test(name, () => {
      if (value === undefined) delete process.env[envName];
      else process.env[envName] = value;
      const result = manifestState.quotaLimit();
      assert.equal(Number.isFinite(result), true);
      assert.equal(result, expected);
    });
  }
});
