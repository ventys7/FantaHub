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
const { installSafeFetchMock } = require("./helpers/mock-safe-fetch.cjs");

const originalCwd = process.cwd();
installSafeFetchMock(originalCwd);
const mediaModulePaths = [
  "lib/media/bsd-provider.cjs",
  "lib/media/manifest-state.cjs",
  "lib/player-media.cjs"
];
let tempRoot;
let media;
let mode = "ok";
const requestedTeams = new Set();

function clearMediaModules() {
  mediaModulePaths.forEach((relative) => {
    delete require.cache[require.resolve(path.join(originalCwd, relative))];
  });
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("BSD_CACHE_TTL_MS is finite and bounded", async (t) => {
  const envName = "BSD_CACHE_TTL_MS";
  const modulePath = require.resolve(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
  const originalEnv = process.env[envName];
  const originalModule = require.cache[modulePath];
  t.after(() => {
    restoreEnv(envName, originalEnv);
    if (originalModule) require.cache[modulePath] = originalModule;
    else delete require.cache[modulePath];
  });

  delete process.env[envName];
  delete require.cache[modulePath];
  const provider = require(modulePath);
  assert.equal(typeof provider.bsdCacheTtlMs, "function", "bsdCacheTtlMs must be exported");

  const rows = [
    ["unset", undefined, 604800000],
    ["empty", "", 604800000],
    ["NaN", "NaN", 604800000],
    ["Infinity", "Infinity", 604800000],
    ["negative", "-1", 60000],
    ["zero", "0", 60000],
    ["oversized", "9999999999999", 2592000000],
    ["valid interior", "120000", 120000]
  ];
  for (const [name, value, expected] of rows) {
    await t.test(name, () => {
      if (value === undefined) delete process.env[envName];
      else process.env[envName] = value;
      const result = provider.bsdCacheTtlMs();
      assert.equal(Number.isFinite(result), true);
      assert.equal(result, expected);
    });
  }
});

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

test("restore BSD scarta transfer, ricerche e stagioni alla soglia TTL", (t) => {
  const previousTtl = process.env.BSD_CACHE_TTL_MS;
  const originalNow = Date.now;
  const now = 2_000_000_000_000;
  t.after(() => {
    Date.now = originalNow;
    restoreEnv("BSD_CACHE_TTL_MS", previousTtl);
    clearMediaModules();
  });

  process.env.BSD_CACHE_TTL_MS = "60000";
  Date.now = () => now;
  clearMediaModules();
  const provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
  const freshStoredAt = now - 59_999;
  const expiredStoredAt = now - 60_000;
  const freshTransfer = { value: { id: "fresh-transfer" }, storedAt: freshStoredAt };
  const freshSearch = { value: [{ id: "fresh-search" }], storedAt: freshStoredAt };
  const freshSeason = { value: { id: "fresh-season" }, storedAt: freshStoredAt };

  provider.restoreBsdCaches({
    transfers: {
      fresh: freshTransfer,
      expired: { value: { id: "expired-transfer" }, storedAt: expiredStoredAt }
    },
    searches: {
      fresh: freshSearch,
      expired: { value: [{ id: "expired-search" }], storedAt: expiredStoredAt }
    },
    seasons: {
      fresh: freshSeason,
      expired: { value: { id: "expired-season" }, storedAt: expiredStoredAt }
    }
  });

  const snapshot = provider.dumpBsdCaches();
  assert.ok(snapshot && Number.isInteger(snapshot.revision), "il dump espone la revisione della cache ripristinata");
  assert.deepEqual(snapshot.value, {
    transfers: { fresh: freshTransfer },
    searches: { fresh: freshSearch },
    seasons: { fresh: freshSeason }
  });
});

test("restore BSD non sostituisce una stagione recente con una persistita piu vecchia", async (t) => {
  const previousApiKey = process.env.BSD_API_KEY;
  const previousTtl = process.env.BSD_CACHE_TTL_MS;
  const originalFetch = global.fetch;
  const originalNow = Date.now;
  const now = 2_000_000_000_000;
  t.after(() => {
    Date.now = originalNow;
    global.fetch = originalFetch;
    restoreEnv("BSD_API_KEY", previousApiKey);
    restoreEnv("BSD_CACHE_TTL_MS", previousTtl);
    clearMediaModules();
  });

  process.env.BSD_API_KEY = "test-token";
  process.env.BSD_CACHE_TTL_MS = "60000";
  Date.now = () => now;
  clearMediaModules();
  const provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
  const freshSeason = { id: "fresh", name: "Fresh", year: 2026, startDate: "2026-08-01", source: "bsd" };
  const staleSeason = { id: "stale", name: "Stale", year: 2025, startDate: "2025-08-01", source: "bsd" };
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return jsonResponse({ results: [{ id: 999, name: "Fetched", year: 2027, start_date: "2027-08-01", is_current: true }] });
  };

  provider.restoreBsdCaches({ seasons: { 1: { value: freshSeason, storedAt: now } } });
  provider.restoreBsdCaches({ seasons: { 1: { value: staleSeason, storedAt: now - 60_000 } } });

  assert.deepEqual(
    { season: await provider.resolveProviderSeason("fp"), fetchCalls },
    { season: freshSeason, fetchCalls: 0 }
  );
});

test("restore BSD sostituisce la cache live con una entry persistita allo stesso timestamp", async (t) => {
  const previousApiKey = process.env.BSD_API_KEY;
  const originalFetch = global.fetch;
  const originalNow = Date.now;
  const now = 2_000_000_000_000;
  t.after(() => {
    Date.now = originalNow;
    global.fetch = originalFetch;
    restoreEnv("BSD_API_KEY", previousApiKey);
    clearMediaModules();
  });

  process.env.BSD_API_KEY = "test-token";
  Date.now = () => now;
  clearMediaModules();
  const provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
  global.fetch = async () => jsonResponse({
    results: [{ id: "live", name: "Live", year: 2026, start_date: "2026-08-01", is_current: true }]
  });
  await provider.resolveProviderSeason("1");

  const persistedSeason = { id: "persisted", name: "Persisted", year: 2026, startDate: "2026-08-01", source: "bsd" };
  provider.restoreBsdCaches({ seasons: { 1: { value: persistedSeason, storedAt: now } } });

  assert.deepEqual(await provider.resolveProviderSeason("1"), persistedSeason);
});

test("restore BSD di sole entry valide non richiede un nuovo dump", (t) => {
  const originalNow = Date.now;
  const now = 2_000_000_000_000;
  t.after(() => {
    Date.now = originalNow;
    clearMediaModules();
  });

  Date.now = () => now;
  clearMediaModules();
  const provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
  provider.restoreBsdCaches({
    transfers: { 7: { value: { id: "7", transfers: [] }, storedAt: now } },
    searches: { player: { value: [{ id: "7" }], storedAt: now } },
    seasons: { 1: { value: { id: "1", name: "2026/2027" }, storedAt: now } }
  });

  assert.equal(provider.dumpBsdCaches(), null);
});

test("dump BSD isola i valori snapshot dalle cache interne", async (t) => {
  const previousApiKey = process.env.BSD_API_KEY;
  const originalFetch = global.fetch;
  const originalNow = Date.now;
  const now = 2_000_000_000_000;
  t.after(() => {
    Date.now = originalNow;
    global.fetch = originalFetch;
    restoreEnv("BSD_API_KEY", previousApiKey);
    clearMediaModules();
  });

  process.env.BSD_API_KEY = "test-token";
  Date.now = () => now;
  clearMediaModules();
  const provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
  global.fetch = async () => jsonResponse({
    results: [{ id: "live", name: "Original", year: 2026, start_date: "2026-08-01", is_current: true }]
  });
  await provider.resolveProviderSeason("1");

  const snapshot = provider.dumpBsdCaches();
  snapshot.value.seasons["1"].value.name = "Mutated snapshot";

  assert.equal((await provider.resolveProviderSeason("1")).name, "Original");
});

test("persistenza BSD rimuove le chiavi scadute dal blob precedente", async (t) => {
  await setup();
  const previousTtl = process.env.BSD_CACHE_TTL_MS;
  const originalNow = Date.now;
  const now = 2_000_000_000_000;
  const neonPath = require.resolve(path.join(originalCwd, "lib", "neon.cjs"));
  const originalNeon = require.cache[neonPath];
  const baseFetch = global.fetch;
  const expiredKey = "expired-player";
  const persisted = {
    transfers: { [expiredKey]: { value: { id: expiredKey }, storedAt: now - 60_000 } },
    searches: {},
    seasons: {}
  };
  let written = null;
  t.after(async () => {
    Date.now = originalNow;
    restoreEnv("BSD_CACHE_TTL_MS", previousTtl);
    clearMediaModules();
    if (originalNeon) require.cache[neonPath] = originalNeon;
    else delete require.cache[neonPath];
    await teardown();
  });

  process.env.BSD_CACHE_TTL_MS = "60000";
  Date.now = () => now;
  require.cache[neonPath] = {
    id: neonPath,
    filename: neonPath,
    loaded: true,
    exports: {
      acquireRefreshCheckpoint: async () => ({ checkpoint: null, fencingToken: 1 }),
      clearRefreshCheckpoint: async () => true,
      databaseConfigured: () => true,
      incrementBsdQuota: async (delta, date) => ({ date, calls: delta, rateLimitedUntil: null }),
      markBsdQuotaRateLimited: async (until, date) => ({ date, calls: 0, rateLimitedUntil: until }),
      publishManifestAndClearRefreshCheckpoint: async () => true,
      readBsdQuota: async (date) => ({ date, calls: 0, rateLimitedUntil: null }),
      readManifestCache: async () => null,
      readPlayerOverrides: async () => ({}),
      readRefreshCheckpoint: async () => null,
      readRuntimeSetting: async () => ({ value: persisted }),
      readTeamOverrides: async () => ({}),
      releaseRefreshCheckpoint: async () => true,
      renewRefreshCheckpoint: async () => true,
      upsertPlayerOverrideWithRefreshLease: async () => true,
      upsertTeamOverridesWithRefreshLease: async () => true,
      writeRefreshCheckpoint: async () => true,
      writeRuntimeSetting: async (_key, value) => { written = value; return { value }; }
    }
  };
  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/seasons/") {
      return jsonResponse({ results: [{ id: 1, name: "2026/2027", year: 2026, start_date: "2026-08-01", is_current: true }] });
    }
    if (/^\/api\/players\/\d+\/$/.test(url.pathname)) return jsonResponse({ transfers: [] });
    return baseFetch(input);
  };
  clearMediaModules();
  media = require(path.join(originalCwd, "lib", "player-media.cjs"));

  await media.refreshDirectManifest("fp");

  assert.ok(Object.keys(written?.transfers || {}).length > 0, "il refresh persiste valori BSD freschi");
  assert.equal(written.transfers[expiredKey], undefined);
});

test("persistenze BSD di worker separati ritentano il CAS e conservano entrambi gli snapshot", async (t) => {
  const previousFetch = global.fetch;
  const previousApiKey = process.env.BSD_API_KEY;
  const neonPath = require.resolve(path.join(originalCwd, "lib", "neon.cjs"));
  const originalNeon = require.cache[neonPath];
  let persisted = null;
  let version = null;
  let readCount = 0;
  let writeCount = 0;
  let conflicts = 0;
  let releaseInitialCasReads;
  const initialCasReads = new Promise((resolve) => { releaseInitialCasReads = resolve; });
  const checkpoint = (id) => ({
    v: 1,
    id,
    phase: "finalize",
    done: 0,
    total: 0,
    assets: [],
    clubs: [],
    players: [],
    previousPlayers: {},
    catalog: { players: {}, teams: {} },
    failedTeams: {},
    playerOverrides: {},
    teamOverrides: {},
    pendingNameSearches: [],
    cursor: 0,
    manifest: {
      version: 8,
      leagueId: id,
      provider: "bsd",
      sourceMode: "bsd-direct-images",
      players: {}
    },
    updatedAt: new Date().toISOString()
  });
  t.after(() => {
    releaseInitialCasReads();
    if (previousFetch === undefined) delete global.fetch;
    else global.fetch = previousFetch;
    restoreEnv("BSD_API_KEY", previousApiKey);
    clearMediaModules();
    if (originalNeon) require.cache[neonPath] = originalNeon;
    else delete require.cache[neonPath];
  });

  process.env.BSD_API_KEY = "test-token";
  require.cache[neonPath] = {
    id: neonPath,
    filename: neonPath,
    loaded: true,
    exports: {
      acquireRefreshCheckpoint: async (id, owner) => ({ checkpoint: checkpoint(id), owner, fencingToken: 1 }),
      clearRefreshCheckpoint: async () => true,
      databaseConfigured: () => true,
      incrementBsdQuota: async (delta, date) => ({ date, calls: delta, rateLimitedUntil: null }),
      markBsdQuotaRateLimited: async (until, date) => ({ date, calls: 0, rateLimitedUntil: until }),
      publishManifestAndClearRefreshCheckpoint: async () => true,
      readBsdQuota: async (date) => ({ date, calls: 0, rateLimitedUntil: null }),
      readManifestCache: async () => null,
      readPlayerOverrides: async () => ({}),
      readRefreshCheckpoint: async () => null,
      readRuntimeSetting: async () => {
        readCount += 1;
        const row = persisted ? { value: structuredClone(persisted), version } : null;
        if (readCount === 4) releaseInitialCasReads();
        if (readCount === 3 || readCount === 4) await initialCasReads;
        return row;
      },
      readTeamOverrides: async () => ({}),
      releaseRefreshCheckpoint: async () => true,
      renewRefreshCheckpoint: async () => true,
      upsertPlayerOverrideWithRefreshLease: async () => true,
      upsertTeamOverridesWithRefreshLease: async () => true,
      writeRefreshCheckpoint: async () => true,
      writeRuntimeSetting: async (_key, value, expectedVersion) => {
        writeCount += 1;
        if (expectedVersion !== undefined) {
          const versionMatches = expectedVersion === null ? persisted === null : expectedVersion === version;
          if (!versionMatches) {
            conflicts += 1;
            return null;
          }
        }
        persisted = structuredClone(value);
        version = String(Number(version || 0) + 1);
        return { value, version };
      }
    }
  };
  global.fetch = async (input) => {
    const url = new URL(String(input));
    const league = url.searchParams.get("league");
    return jsonResponse({
      results: [{ id: `season-${league}`, name: `Season ${league}`, year: 2026, start_date: "2026-08-01", is_current: true }]
    });
  };
  clearMediaModules();
  const firstProvider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
  const firstMedia = require(path.join(originalCwd, "lib", "player-media.cjs"));
  clearMediaModules();
  const secondProvider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
  const secondMedia = require(path.join(originalCwd, "lib", "player-media.cjs"));

  await firstProvider.resolveProviderSeason("1");
  await secondProvider.resolveProviderSeason("2");
  await Promise.all([firstMedia.refreshDirectStep("fp"), secondMedia.refreshDirectStep("pd")]);

  assert.equal(conflicts, 1);
  assert.equal(writeCount, 3);
  assert.equal(persisted.seasons["1"].value.id, "season-1");
  assert.equal(persisted.seasons["2"].value.id, "season-2");
});

test("persistenza BSD ritenta uno snapshot non confermato e poi resta inattiva", async (t) => {
  const previousCwd = process.cwd();
  const previousFetch = global.fetch;
  const previousApiKey = process.env.BSD_API_KEY;
  const previousFaceBridge = process.env.FACE_BRIDGE_ENABLED;
  const neonPath = require.resolve(path.join(originalCwd, "lib", "neon.cjs"));
  const originalNeon = require.cache[neonPath];
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-bsd-retry-"));
  const writes = [];
  let persisted = null;
  let firstFailure = "";
  t.after(async () => {
    process.chdir(previousCwd);
    if (previousFetch === undefined) delete global.fetch;
    else global.fetch = previousFetch;
    restoreEnv("BSD_API_KEY", previousApiKey);
    restoreEnv("FACE_BRIDGE_ENABLED", previousFaceBridge);
    clearMediaModules();
    if (originalNeon) require.cache[neonPath] = originalNeon;
    else delete require.cache[neonPath];
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.mkdir(path.join(root, "data"), { recursive: true });
  await fs.writeFile(path.join(root, "data", "settings.json"), JSON.stringify({
    version: 1,
    leagues: {
      fp: { listoneCsvUrl: "https://example.test/fp.csv", standingsCsvUrl: "", disciplineDocUrl: "" },
      pd: { listoneCsvUrl: "", standingsCsvUrl: "", disciplineDocUrl: "" }
    }
  }));
  process.chdir(root);
  process.env.BSD_API_KEY = "test-token";
  process.env.FACE_BRIDGE_ENABLED = "0";
  require.cache[neonPath] = {
    id: neonPath,
    filename: neonPath,
    loaded: true,
    exports: {
      acquireRefreshCheckpoint: async () => ({ checkpoint: null, fencingToken: 1 }),
      clearRefreshCheckpoint: async () => true,
      databaseConfigured: () => true,
      incrementBsdQuota: async (delta, date) => ({ date, calls: delta, rateLimitedUntil: null }),
      markBsdQuotaRateLimited: async (until, date) => ({ date, calls: 0, rateLimitedUntil: until }),
      publishManifestAndClearRefreshCheckpoint: async () => true,
      readBsdQuota: async (date) => ({ date, calls: 0, rateLimitedUntil: null }),
      readManifestCache: async () => null,
      readPlayerOverrides: async () => ({}),
      readRefreshCheckpoint: async () => null,
      readRuntimeSetting: async () => (persisted ? { value: persisted } : null),
      readTeamOverrides: async () => ({}),
      releaseRefreshCheckpoint: async () => true,
      renewRefreshCheckpoint: async () => true,
      upsertPlayerOverrideWithRefreshLease: async () => true,
      upsertTeamOverridesWithRefreshLease: async () => true,
      writeRefreshCheckpoint: async () => true,
      writeRuntimeSetting: async (key, value) => {
        writes.push({ key, value: structuredClone(value) });
        if (writes.length === 1) {
          const error = new Error("Neon unavailable");
          firstFailure = error.message;
          throw error;
        }
        persisted = structuredClone(value);
        return { value };
      }
    }
  };
  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "example.test") return csvResponse();
    if (url.pathname === "/api/teams/") {
      return jsonResponse({
        count: 1,
        next: null,
        results: [{ id: 18, name: "Arsenal FC", country: "England" }]
      });
    }
    if (url.pathname === "/api/seasons/") {
      return jsonResponse({ results: [{ id: 1, name: "2026/2027", year: 2026, start_date: "2026-08-01", is_current: true }] });
    }
    if (url.pathname === "/api/players/") {
      const roster = ROSTERS[String(url.searchParams.get("team"))] || [];
      return jsonResponse({ count: roster.length, next: null, results: roster });
    }
    if (/^\/api\/players\/\d+\/$/.test(url.pathname)) return jsonResponse({ transfers: [] });
    throw new Error(`Unexpected fetch: ${url}`);
  };
  clearMediaModules();
  const freshMedia = require(path.join(originalCwd, "lib", "player-media.cjs"));

  await freshMedia.refreshDirectManifest("fp");
  assert.equal(firstFailure, "Neon unavailable");
  assert.equal(writes.length, 1);

  await freshMedia.refreshDirectManifest("fp");
  assert.equal(writes.length, 2, "lo snapshot non confermato viene ritentato al confine successivo");
  assert.equal(writes[1].key, "bsd-cache");
  assert.deepEqual(writes[1].value, writes[0].value);

  await freshMedia.refreshDirectManifest("fp");
  assert.equal(writes.length, 2, "senza mutazioni non viene eseguita una terza scrittura");
});

test("il protocollo BSD conserva le mutazioni successive allo snapshot confermato", async (t) => {
  const previousCwd = process.cwd();
  const previousFetch = global.fetch;
  const previousApiKey = process.env.BSD_API_KEY;
  const previousTtl = process.env.BSD_CACHE_TTL_MS;
  const originalNow = Date.now;
  const now = 2_000_000_000_000;
  t.after(() => {
    process.chdir(previousCwd);
    if (previousFetch === undefined) delete global.fetch;
    else global.fetch = previousFetch;
    Date.now = originalNow;
    restoreEnv("BSD_API_KEY", previousApiKey);
    restoreEnv("BSD_CACHE_TTL_MS", previousTtl);
    clearMediaModules();
  });

  process.env.BSD_API_KEY = "test-token";
  process.env.BSD_CACHE_TTL_MS = "60000";
  Date.now = () => now;
  clearMediaModules();
  const provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
  global.fetch = async (input) => {
    const league = new URL(String(input)).searchParams.get("league");
    return jsonResponse({
      results: [{ id: league === "1" ? "first" : "second", name: league === "1" ? "First" : "Second", year: 2026, start_date: "2026-08-01", is_current: true }]
    });
  };
  const first = { value: { id: "first", name: "First", year: 2026, startDate: "2026-08-01", source: "bsd" }, storedAt: now };
  const second = { value: { id: "second", name: "Second", year: 2026, startDate: "2026-08-01", source: "bsd" }, storedAt: now };

  await provider.resolveProviderSeason("1");
  const r1 = provider.dumpBsdCaches();
  assert.ok(r1 && Number.isInteger(r1.revision));

  await provider.resolveProviderSeason("2");
  provider.acknowledgeBsdCaches(r1.revision);
  const r2 = provider.dumpBsdCaches();
  assert.ok(r2 && r2.revision > r1.revision, "la mutazione successiva resta pendente come R2");
  assert.deepEqual(r2.value, {
    transfers: {},
    searches: {},
    seasons: { 1: first, 2: second }
  });

  provider.acknowledgeBsdCaches(r2.revision);
  assert.equal(provider.dumpBsdCaches(), null);
});
