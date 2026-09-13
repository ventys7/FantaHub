"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { installSafeFetchMock } = require("./helpers/mock-safe-fetch.cjs");

const originalCwd = process.cwd();
installSafeFetchMock(originalCwd);
const rootModules = [
  "lib/media/bsd-provider.cjs",
  "lib/media/manifest-state.cjs",
  "lib/player-media.cjs"
];
let tempRoot;
let media;

function clearMediaModules() {
  for (const relative of rootModules) {
    delete require.cache[require.resolve(path.join(originalCwd, relative))];
  }
}

async function assertBoundedManifestEnv(t, envName, getterName, rows) {
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
  assert.equal(typeof manifestState[getterName], "function", `${getterName} must be exported`);

  for (const [name, value, expected] of rows) {
    await t.test(name, () => {
      if (value === undefined) delete process.env[envName];
      else process.env[envName] = value;
      const result = manifestState[getterName]();
      assert.equal(Number.isFinite(result), true);
      assert.equal(result, expected);
    });
  }
}

function loadWithNeon(overrides = {}, faceBridgeOverrides = null) {
  const neonPath = require.resolve(path.join(originalCwd, "lib", "neon.cjs"));
  const faceBridgePath = require.resolve(path.join(originalCwd, "lib", "media", "face-bridge.cjs"));
  const original = require.cache[neonPath];
  const originalFaceBridge = require.cache[faceBridgePath];
  clearMediaModules();
  if (faceBridgeOverrides) {
    require.cache[faceBridgePath] = {
      id: faceBridgePath,
      filename: faceBridgePath,
      loaded: true,
      exports: { FACE_BRIDGE_RETRY_MS: 6 * 60 * 60 * 1000, ...faceBridgeOverrides }
    };
  }
  require.cache[neonPath] = {
    id: neonPath,
    filename: neonPath,
    loaded: true,
    exports: {
      databaseConfigured: () => true,
      readBsdQuota: async (date) => ({ date, calls: 0, rateLimitedUntil: null }),
      incrementBsdQuota: async (delta, date) => ({ date, calls: delta, rateLimitedUntil: null }),
      markBsdQuotaRateLimited: async (until, date) => ({ date, calls: 0, rateLimitedUntil: until }),
      readManifestCache: async () => null,
      writeManifestCache: async () => {},
      readPlayerOverrides: async () => ({}),
      readTeamOverrides: async () => ({}),
      upsertTeamOverrides: async () => {},
      renewRefreshCheckpoint: async () => true,
      upsertPlayerOverrideWithRefreshLease: async () => true,
      upsertTeamOverridesWithRefreshLease: async () => true,
      readRefreshCheckpoint: async () => null,
      writeRefreshCheckpoint: async () => true,
      clearRefreshCheckpoint: async () => true,
      readRuntimeSetting: async () => null,
      writeRuntimeSetting: async () => ({}),
      ...overrides
    }
  };
  media = require(path.join(originalCwd, "lib", "player-media.cjs"));
  return () => {
    clearMediaModules();
    if (original) require.cache[neonPath] = original;
    else delete require.cache[neonPath];
    if (originalFaceBridge) require.cache[faceBridgePath] = originalFaceBridge;
    else delete require.cache[faceBridgePath];
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

// N club, M giocatori in rosa ciascuno; gli altri N giocatori del CSV non
// compaiono in nessuna rosa, cosi' finiscono in pendingNameSearches.
function csvResponse(nClubs, rosterSize = 1) {
  const rows = ["Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto"];
  for (let c = 0; c < nClubs; c += 1) {
    const club = `Club${c}`;
    for (let p = 0; p < rosterSize; p += 1) {
      rows.push(`Paolo,A,Player${c}_${p},${club},30,35`);
    }
    rows.push(`Paolo,A,Extra${c},${club},18,22`); // mai in rosa BSD
  }
  return new Response(rows.join("\n"), { status: 200, headers: { "content-type": "text/csv" } });
}

// id BSD squadra = 1000 + indice club; id giocatore = 1000 + club*10 + p
function buildRosters(nClubs, rosterSize = 1) {
  const rosters = {};
  for (let c = 0; c < nClubs; c += 1) {
    rosters[1000 + c] = Array.from({ length: rosterSize }, (_, p) => ({
      id: 1000 + c * 10 + p,
      full_name: `Player${c}_${p}`
    }));
  }
  return rosters;
}

async function setup(nClubs = 2, rosterSize = 1, apiDelayMs = 0) {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-media-steps-"));
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
  const rosters = buildRosters(nClubs, rosterSize);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  global.fetch = async (input) => {
    await sleep(apiDelayMs); // simula latenza fissa, per forzare il fingerprint a budget
    const url = new URL(String(input));
    if (url.hostname === "example.test") return csvResponse(nClubs, rosterSize);
    if (url.pathname === "/api/teams/") {
      return jsonResponse({
        count: nClubs,
        next: null,
        previous: null,
        results: Array.from({ length: nClubs }, (_, c) => ({
          id: 1000 + c,
          name: `Club${c}`,
          short_name: `Club${c}`,
          country: "England"
        }))
      });
    }
    if (url.pathname === "/api/players/") {
      if (url.searchParams.get("search")) {
        return jsonResponse({ count: 0, results: [] }); // nessun hit per nome
      }
      const team = Number(url.searchParams.get("team") || 0);
      return jsonResponse({ count: (rosters[team] || []).length, results: rosters[team] || [] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  // Rifacimento pulito: ogni test ricarica il modulo col proprio env.
  delete require.cache[require.resolve(path.join(originalCwd, "lib", "player-media.cjs"))];
  media = require(path.join(originalCwd, "lib", "player-media.cjs"));
}

async function teardown() {
  process.chdir(originalCwd);
  delete process.env.REFRESH_STEP_BUDGET_MS;
  delete process.env.REFRESH_LEASE_MS;
  delete process.env.FACE_BRIDGE_ENABLED;
  delete process.env.FACE_BRIDGE_MAX_LOOKUPS;
  delete process.env.BSD_API_KEY;
  delete global.fetch;
  clearMediaModules();
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
}

function runSteps(seed) {
  return async () => {
    let result = seed;
    let guard = 0;
    while (result.pending && guard < 200) {
      guard += 1;
      result = await media.refreshDirectStep("fp", {});
    }
    assert.equal(result.pending, false, "il loop di step deve terminare");
    assert.ok(result.manifest, "risultato terminale espone il manifest pubblico");
    return { result, guard };
  };
}

test("refreshDirectStep prosegue a step e termina con lo stesso stato del refresh one-shot", async (t) => {
  await setup(2, 1);
  t.teardown?.(teardown);
  process.env.REFRESH_STEP_BUDGET_MS = "1"; // budget minuscolo: ogni chiamata quasi si ferma subito
  process.env.FACE_BRIDGE_ENABLED = "0"; // niente rete esterna nei test

  const first = await media.refreshDirectStep("fp", { reset: true });
  const { result } = await runSteps(first)();

  // Il manifest a step e la proiezione pubblica del one-shot devono avere le
  // stesse associazioni, ossia lo stesso comportamento complessivo.
  const state = await media.buildDirectState("fp", { fresh: true });
  const manifest = result.manifest;
  const oneShot = media.publicManifest(state.manifest);
  for (const entry of Object.values(state.manifest.players || {})) {
    const projected = manifest.players[entry.key];
    assert.ok(projected, `entry ${entry.key} presente anche nel manifest a step`);
    assert.equal(projected.status, oneShot.players[entry.key].status, `status di ${entry.key}`);
    assert.equal(projected.photoUrl || "", oneShot.players[entry.key].photoUrl || "", `foto di ${entry.key}`);
    assert.equal(projected.matchedBy || "", oneShot.players[entry.key].matchedBy || "", `associazione di ${entry.key}`);
    assert.equal(projected.externalId || "", oneShot.players[entry.key].externalId || "", `id BSD di ${entry.key}`);
  }
});

test("refreshDirectStep si ferma a meta' della fase teams e riprende", async (t) => {
  // 12 club (la fase teams lavora a batch di 5) e ~8ms di latenza per ogni
  // chiamata BSD: il budget di 1ms scade necessariamente tra le batch, quindi
  // il primo giro deve ritornare pending e i giri successivi riprendere.
  await setup(12, 1, 8);
  t.teardown?.(teardown);
  process.env.REFRESH_STEP_BUDGET_MS = "1";
  process.env.FACE_BRIDGE_ENABLED = "0";

  const first = await media.refreshDirectStep("fp", { reset: true });
  assert.equal(first.pending, true, "con budget di 1ms e latenza 8ms il primo step non puo' terminare");
  assert.equal(first.phase, "teams");
  assert.equal(typeof first.progress.clubsDone, "number", "progress espone il contatore club");
  assert.ok(first.progress.clubsDone <= 12, "al piu' 12 club completati");

  let result = first;
  let guard = 0;
  while (result.pending && guard < 300) {
    guard += 1;
    result = await media.refreshDirectStep("fp", {});
  }
  assert.equal(result.pending, false, "il loop di step deve terminare");
  assert.ok(result.manifest, "risultato terminale espone il manifest pubblico");
  // Nessun club puo' essere fallito: i mock rispondono sempre. Le voci
  // "Squadra BSD da confermare" (copertura 1/2) sono attese, non errori.
  const realIssues = (result.manifest.teamIssues || []).filter(
    (issue) => !/da confermare|Squadra BSD da confermare/.test(String(issue.error))
  );
  assert.deepEqual(realIssues, [], "nessun errore reale nelle squadre");
});

test("refreshDirectStep acquisisce prima della rete e segnala un lease occupato", async (t) => {
  await setup();
  const owners = [];
  const restoreNeon = loadWithNeon({
    acquireRefreshCheckpoint: async (league, owner) => {
      owners.push({ league, owner });
      return null;
    }
  });
  let networkCalls = 0;
  global.fetch = async () => {
    networkCalls += 1;
    throw new Error("La rete non deve essere chiamata");
  };
  t.after(async () => {
    restoreNeon();
    await teardown();
  });

  assert.deepEqual(await media.refreshDirectStep("fp", { reset: true }), { pending: true, phase: "busy" });
  assert.deepEqual(await media.refreshDirectStep("fp", {}), { pending: true, phase: "busy" });
  assert.equal(networkCalls, 0);
  assert.equal(owners.length, 2);
  assert.equal(owners[0].league, "fp");
  assert.notEqual(owners[0].owner, owners[1].owner);
});

test("refreshDirectStep protegge ogni checkpoint e pubblica atomicamente", async (t) => {
  await setup();
  process.env.FACE_BRIDGE_ENABLED = "0";
  const calls = { acquire: [], update: [], publish: [], release: [], legacyPublish: 0, legacyClear: 0 };
  const restoreNeon = loadWithNeon({
    acquireRefreshCheckpoint: async (league, owner, leaseMs) => {
      calls.acquire.push([league, owner, leaseMs]);
      return { checkpoint: null, owner, fencingToken: 7 };
    },
    writeRefreshCheckpoint: async (...args) => { calls.update.push(args); return true; },
    publishManifestAndClearRefreshCheckpoint: async (...args) => { calls.publish.push(args); return true; },
    releaseRefreshCheckpoint: async (...args) => { calls.release.push(args); return true; },
    writeManifestCache: async () => { calls.legacyPublish += 1; },
    clearRefreshCheckpoint: async () => { calls.legacyClear += 1; return true; }
  });
  t.after(async () => {
    restoreNeon();
    await teardown();
  });

  const result = await media.refreshDirectStep("fp", { reset: true });
  const owner = calls.acquire[0][1];

  assert.equal(result.pending, false);
  assert.ok(calls.update.length > 0);
  assert.ok(calls.update.every(([league, , guardedOwner, token]) => league === "fp" && guardedOwner === owner && token === 7));
  assert.equal(calls.publish.length, 1);
  assert.deepEqual(calls.publish[0].slice(0, 3), ["fp", owner, 7]);
  assert.equal(calls.legacyPublish, 0);
  assert.equal(calls.legacyClear, 0);
  assert.deepEqual(calls.release, [["fp", owner, 7]]);
});

test("refreshDirectStep non ripiega sulla memoria se Neon non salva il checkpoint", async (t) => {
  await setup();
  process.env.FACE_BRIDGE_ENABLED = "0";
  const released = [];
  const restoreNeon = loadWithNeon({
    acquireRefreshCheckpoint: async (league, owner) => ({ checkpoint: null, owner, fencingToken: 11 }),
    writeRefreshCheckpoint: async () => { throw new Error("Neon checkpoint unavailable"); },
    releaseRefreshCheckpoint: async (...args) => { released.push(args); return true; }
  });
  t.after(async () => {
    restoreNeon();
    await teardown();
  });

  await assert.rejects(media.refreshDirectStep("fp", { reset: true }), /Neon checkpoint unavailable/);
  assert.equal(released.length, 1);
  assert.equal(released[0][0], "fp");
  assert.equal(released[0][2], 11);
});

test("refreshDirectManifest non pubblica se perde il lease durante il refresh", async (t) => {
  await setup();
  process.env.FACE_BRIDGE_ENABLED = "0";
  const calls = { publish: [], release: [], legacyPublish: 0 };
  const cachedState = {
    version: 2,
    manifest: {
      version: 8,
      leagueId: "fp",
      provider: "bsd",
      sourceMode: "bsd-direct-images",
      players: { cached: { key: "cached", listoneName: "Cached", realTeam: "Club0", status: "unresolved" } }
    },
    catalog: { players: {} },
    total: 1,
    degraded: false,
    degradedMessage: "",
    teamIssues: []
  };
  let persistedReads = 0;
  const restoreNeon = loadWithNeon({
    acquireRefreshCheckpoint: async (league, owner) => ({ checkpoint: null, owner, fencingToken: 21 }),
    readManifestCache: async () => (++persistedReads === 1 ? { state: cachedState, generatedAt: Date.now() } : null),
    publishManifestAndClearRefreshCheckpoint: async (...args) => { calls.publish.push(args); return false; },
    releaseRefreshCheckpoint: async (...args) => { calls.release.push(args); return true; },
    writeManifestCache: async () => { calls.legacyPublish += 1; }
  });
  t.after(async () => {
    restoreNeon();
    await teardown();
  });

  assert.ok((await media.directReadManifest("fp")).players.cached);
  await assert.rejects(media.refreshDirectManifest("fp"), /Lease refresh non piu' valida/);
  assert.ok((await media.directReadManifest("fp")).players.cached);
  assert.equal(calls.publish.length, 1);
  assert.equal(calls.legacyPublish, 0);
  assert.deepEqual(calls.release[0]?.slice(0, 1), ["fp"]);
  assert.equal(calls.release[0]?.[2], 21);
});

test("refreshDirectManifest e directLinkTeam rinnovano il lease durante lavori lunghi", async (t) => {
  await setup();
  process.env.FACE_BRIDGE_ENABLED = "0";
  process.env.REFRESH_LEASE_MS = "30";
  const originalFetch = global.fetch;
  global.fetch = async (...args) => {
    await new Promise((resolve) => setTimeout(resolve, 12));
    return originalFetch(...args);
  };
  let fencingToken = 40;
  const renewals = new Map();
  const releases = [];
  const restoreNeon = loadWithNeon({
    acquireRefreshCheckpoint: async (league, owner) => ({ checkpoint: null, owner, fencingToken: ++fencingToken }),
    renewRefreshCheckpoint: async (league, owner, token) => {
      renewals.set(token, Number(renewals.get(token) || 0) + 1);
      return true;
    },
    publishManifestAndClearRefreshCheckpoint: async (league, owner, token) => Number(renewals.get(token) || 0) > 0,
    releaseRefreshCheckpoint: async (...args) => { releases.push(args); return true; }
  });
  t.after(async () => {
    restoreNeon();
    await teardown();
  });

  const manifest = await media.refreshDirectManifest("fp");
  assert.ok(manifest.players);
  const linked = await media.directLinkTeam("fp", "Club0", "1000", "Club0");
  assert.ok(linked.manifest.players);
  assert.ok(renewals.get(41) > 0);
  assert.ok(renewals.get(42) > 0);
  assert.equal(releases[0]?.[2], 41);
  assert.equal(releases[1]?.[2], 42);
});

test("directLinkManual non pubblica con un token diventato stale", async (t) => {
  await setup();
  const state = {
    version: 2,
    manifest: {
      version: 3,
      leagueId: "fp",
      provider: "bsd",
      sourceMode: "direct",
      players: {
        "player0_0|club0": {
          key: "player0_0|club0",
          listoneName: "Player0_0",
          realTeam: "Club0",
          status: "unresolved"
        }
      }
    },
    catalog: { players: {} },
    total: 1,
    degraded: false,
    degradedMessage: "",
    teamIssues: []
  };
  const calls = { fencedOverride: [], publish: [], release: [], legacyOverride: 0, legacyPublish: 0 };
  const restoreNeon = loadWithNeon({
    acquireRefreshCheckpoint: async (league, owner) => ({ checkpoint: null, owner, fencingToken: 31 }),
    readManifestCache: async () => ({ state, generatedAt: Date.now() }),
    upsertPlayerOverride: async () => { calls.legacyOverride += 1; },
    upsertPlayerOverrideWithRefreshLease: async (...args) => { calls.fencedOverride.push(args); return false; },
    publishManifestAndClearRefreshCheckpoint: async (...args) => { calls.publish.push(args); return false; },
    releaseRefreshCheckpoint: async (...args) => { calls.release.push(args); return true; },
    writeManifestCache: async () => { calls.legacyPublish += 1; }
  });
  t.after(async () => {
    restoreNeon();
    await teardown();
  });

  await assert.rejects(
    media.directLinkManual("fp", "player0_0|club0", { id: "1000", name: "Player0_0", teamName: "Club0" }),
    /Lease refresh non piu' valida/
  );
  assert.equal(calls.fencedOverride.length, 1);
  assert.deepEqual(calls.fencedOverride[0].slice(0, 3), ["fp", calls.release[0][1], 31]);
  assert.equal(calls.publish.length, 0);
  assert.equal(calls.legacyOverride, 0);
  assert.equal(calls.legacyPublish, 0);
  assert.equal(calls.release[0]?.[2], 31);
});

test("directLinkTeam occupato non modifica Neon e non chiama la rete", async (t) => {
  await setup();
  let overrideWrites = 0;
  let networkCalls = 0;
  const restoreNeon = loadWithNeon({
    acquireRefreshCheckpoint: async () => null,
    upsertTeamOverrides: async () => { overrideWrites += 1; }
  });
  global.fetch = async () => {
    networkCalls += 1;
    throw new Error("La rete non deve essere chiamata");
  };
  t.after(async () => {
    restoreNeon();
    await teardown();
  });

  await assert.rejects(media.directLinkTeam("fp", "Club0", "1000", "Club0"), /aggiornamento.*corso/i);
  assert.equal(overrideWrites, 0);
  assert.equal(networkCalls, 0);
});

test("directLinkTeam stale non modifica override, cache o rete", async (t) => {
  await setup();
  let fencedWrites = 0;
  let legacyWrites = 0;
  let networkCalls = 0;
  const releases = [];
  const restoreNeon = loadWithNeon({
    acquireRefreshCheckpoint: async (league, owner) => ({ checkpoint: null, owner, fencingToken: 51 }),
    upsertTeamOverrides: async () => { legacyWrites += 1; },
    upsertTeamOverridesWithRefreshLease: async () => { fencedWrites += 1; return false; },
    releaseRefreshCheckpoint: async (...args) => { releases.push(args); return true; }
  });
  global.fetch = async () => {
    networkCalls += 1;
    throw new Error("La rete non deve essere chiamata");
  };
  t.after(async () => {
    restoreNeon();
    await teardown();
  });

  await assert.rejects(media.directLinkTeam("fp", "Club0", "1000", "Club0"), /Lease refresh non piu' valida/);
  assert.equal(fencedWrites, 1);
  assert.equal(legacyWrites, 0);
  assert.equal(networkCalls, 0);
  assert.equal(releases[0]?.[2], 51);
});

test("the faces phase never exceeds maxLookups when its batch is larger", async () => {
  await teardown();
  const { faceBridgeUnresolved } = require(path.join(originalCwd, "lib", "media", "manifest-state.cjs"));
  const manifest = {
    players: Object.fromEntries(Array.from({ length: 5 }, (_, index) => [
      `player-${index}`,
      { key: `player-${index}`, listoneName: `Player ${index}`, realTeam: "Club", status: "unresolved" }
    ]))
  };
  let calls = 0;

  const result = await faceBridgeUnresolved(manifest, {}, "fp", {
    batchSize: 5,
    maxLookups: 2,
    now: () => 7 * 60 * 60 * 1000,
    lookupFace: async () => { calls += 1; return null; }
  });

  assert.equal(calls, 2);
  assert.equal(result.lookups, 2);
  assert.equal(result.incomplete, true);
});

test("refreshDirectStep keeps face work pending until every candidate is processed", async (t) => {
  let checkpoint = {
    v: 1,
    id: "fp",
    phase: "faces",
    done: 0,
    total: 61,
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
      leagueId: "fp",
      provider: "bsd",
      sourceMode: "bsd-direct-images",
      players: Object.fromEntries(Array.from({ length: 61 }, (_, index) => [
        `player-${index}`,
        { key: `player-${index}`, listoneName: `Player ${index}`, realTeam: "Club", status: "unresolved" }
      ]))
    },
    updatedAt: new Date().toISOString()
  };
  let lookups = 0;
  let publishes = 0;
  const restoreNeon = loadWithNeon({
    acquireRefreshCheckpoint: async (_league, owner) => ({
      checkpoint: structuredClone(checkpoint),
      owner,
      fencingToken: 71
    }),
    writeRefreshCheckpoint: async (_league, value) => {
      checkpoint = structuredClone(value);
      return true;
    },
    publishManifestAndClearRefreshCheckpoint: async () => {
      publishes += 1;
      return true;
    },
    releaseRefreshCheckpoint: async () => true
  }, {
    lookupFace: async () => { lookups += 1; return null; }
  });
  t.after(restoreNeon);

  const first = await media.refreshDirectStep("fp", { budgetMs: 60_000 });
  assert.equal(first.pending, true);
  assert.equal(first.phase, "faces");
  assert.equal(lookups, 60);
  assert.equal(checkpoint.phase, "faces");
  assert.equal(publishes, 0);

  for (const entry of Object.values(checkpoint.manifest.players)) {
    if (entry.fallbackCheckedAt) entry.fallbackCheckedAt = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
  }

  const second = await media.refreshDirectStep("fp", { budgetMs: 60_000 });
  assert.equal(second.pending, false);
  assert.equal(lookups, 61);
  assert.equal(publishes, 1);
});

test("REFRESH_STEP_BUDGET_MS is finite and bounded", async (t) => {
  await assertBoundedManifestEnv(t, "REFRESH_STEP_BUDGET_MS", "refreshStepBudgetMs", [
    ["unset", undefined, 45000],
    ["empty", "", 45000],
    ["NaN", "NaN", 45000],
    ["Infinity", "Infinity", 45000],
    ["negative", "-1", 1],
    ["zero", "0", 1],
    ["oversized", "9999999999999", 240000],
    ["valid interior", "60000", 60000]
  ]);
});

test("FACE_BRIDGE_MAX_LOOKUPS is finite and bounded", async (t) => {
  await assertBoundedManifestEnv(t, "FACE_BRIDGE_MAX_LOOKUPS", "faceBridgeMaxLookups", [
    ["unset", undefined, 60],
    ["empty", "", 60],
    ["NaN", "NaN", 60],
    ["Infinity", "Infinity", 60],
    ["negative", "-1", 1],
    ["zero", "0", 1],
    ["oversized", "9999999999999", 300],
    ["valid interior", "120", 120]
  ]);
});
