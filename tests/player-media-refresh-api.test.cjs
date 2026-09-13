"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { installSafeFetchMock } = require("./helpers/mock-safe-fetch.cjs");

const ROOT = path.join(__dirname, "..");
const originalCwd = process.cwd();
installSafeFetchMock(originalCwd);
let tempRoot;

const API_PATH = require.resolve(path.join(ROOT, "api", "player-media.js"));
const MEDIA_PATH = require.resolve(path.join(ROOT, "lib", "player-media.cjs"));
const ISOLATED_MODULES = [
  API_PATH,
  MEDIA_PATH,
  require.resolve(path.join(ROOT, "lib", "settings.cjs")),
  require.resolve(path.join(ROOT, "lib", "admin-auth.cjs")),
  require.resolve(path.join(ROOT, "lib", "storage.cjs"))
];
const FIXED_NOW = Date.parse("2026-09-10T23:59:00.000Z");
const QUOTA = {
  callsToday: 7500,
  limit: 7500,
  exhausted: true,
  resetAt: "2026-09-11T00:00:00.000Z",
  rateLimitedUntil: null
};

function scryptAsync(password, salt, length) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, length, (error, key) => error ? reject(error) : resolve(key)));
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end(value) { this.body = value ?? null; return this; },
    send(value) { this.body = value; return this; }
  };
}

function cookie(hash, now = Math.floor(Date.now() / 1000)) {
  // Same algorithm as lib/admin-auth.cjs (no ADMIN_LINKS_SESSION_SECRET set).
  const payload = Buffer.from(JSON.stringify({ v: 1, exp: now + 600 })).toString("base64url");
  const key = crypto.createHash("sha256").update(`lineup-admin:${hash}`).digest("hex");
  const sig = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return `lineup_admin_session=${encodeURIComponent(`${payload}.${sig}`)}`;
}

function clearModuleCache() {
  delete require.cache[require.resolve(path.join(ROOT, "api", "player-media.js"))];
  delete require.cache[require.resolve(path.join(ROOT, "lib", "player-media.cjs"))];
  delete require.cache[require.resolve(path.join(ROOT, "lib", "settings.cjs"))];
  delete require.cache[require.resolve(path.join(ROOT, "lib", "admin-auth.cjs"))];
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

// 1 club, 1 giocatore in rosa; l'Extra del CSV finisce in pendingNameSearches.
async function setup() {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-media-api-"));
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
    if (url.hostname === "example.test") {
      return new Response("Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto\nPaolo,A,Player0_0,Club0,30,35\nPaolo,A,Extra0,Club0,18,22\n", {
        status: 200, headers: { "content-type": "text/csv" }
      });
    }
    if (url.pathname === "/api/teams/") {
      return jsonResponse({
        count: 1, next: null, previous: null,
        results: [{ id: 1000, name: "Club0", short_name: "Club0", country: "England" }]
      });
    }
    if (url.pathname === "/api/players/") {
      if (url.searchParams.get("search")) return jsonResponse({ count: 0, results: [] });
      return jsonResponse({ count: 1, results: [{ id: 1000, full_name: "Player0_0" }] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  clearModuleCache();
}

async function teardown() {
  process.chdir(originalCwd);
  delete process.env.BSD_API_KEY;
  delete process.env.REFRESH_STEP_BUDGET_MS;
  delete process.env.FACE_BRIDGE_ENABLED;
  delete global.fetch;
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
}

function loadHandlerWithRefreshError(t, error, directMediaStatus = async () => ({ quota: QUOTA })) {
  const originalHash = process.env.ADMIN_LINKS_PASSWORD_HASH;
  const originalNow = Date.now;
  const originalModules = new Map(ISOLATED_MODULES.map((modulePath) => [modulePath, require.cache[modulePath]]));
  const hash = "test-admin-hash";

  process.env.ADMIN_LINKS_PASSWORD_HASH = hash;
  Date.now = () => FIXED_NOW;
  require.cache[MEDIA_PATH] = {
    id: MEDIA_PATH,
    filename: MEDIA_PATH,
    loaded: true,
    exports: {
      directMediaStatus,
      publicManifest: (manifest) => manifest,
      refreshDirectManifest: async () => { throw error; }
    }
  };
  delete require.cache[API_PATH];

  t.after(() => {
    Date.now = originalNow;
    if (originalHash === undefined) delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    else process.env.ADMIN_LINKS_PASSWORD_HASH = originalHash;
    for (const [modulePath, cached] of originalModules) {
      if (cached) require.cache[modulePath] = cached;
      else delete require.cache[modulePath];
    }
  });

  return { handler: require(API_PATH), hash };
}

test("one-shot player-media refresh actions map quota exhaustion to 429", async (t) => {
  const error = new Error("Quota BSD esaurita");
  error.quotaExhausted = true;
  error.status = 429;
  const { handler, hash } = loadHandlerWithRefreshError(t, error);

  for (const action of ["sync-missing", "full-sync", "continue-full-sync"]) {
    await t.test(action, async () => {
      const res = mockRes();
      await handler({
        method: "POST",
        headers: { cookie: cookie(hash) },
        body: { leagueId: "fp", action }
      }, res);

      assert.equal(res.statusCode, 429);
      assert.equal(res.body?.quotaExhausted, true);
      assert.deepEqual(res.body?.quota, QUOTA);
      const retryAfter = Number(res.headers["retry-after"]);
      assert.equal(retryAfter, 60);
      assert.ok(Number.isInteger(retryAfter) && retryAfter > 0);
    });
  }
});

test("one-shot player-media refresh keeps ordinary provider failures as 502", async (t) => {
  const { handler, hash } = loadHandlerWithRefreshError(t, new Error("Provider unavailable"));
  const res = mockRes();
  await handler({
    method: "POST",
    headers: { cookie: cookie(hash) },
    body: { leagueId: "fp", action: "full-sync" }
  }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.headers["retry-after"], undefined);
});

test("one-shot quota response falls back to error quota when status lookup fails", async (t) => {
  const error = Object.assign(new Error("Quota BSD esaurita"), {
    quotaExhausted: true,
    status: 429,
    quota: QUOTA,
    internal: "do not expose"
  });
  const { handler, hash } = loadHandlerWithRefreshError(t, error, async () => {
    throw new Error("Status unavailable");
  });
  const res = mockRes();

  await handler({
    method: "POST",
    headers: { cookie: cookie(hash) },
    body: { leagueId: "fp", action: "full-sync" }
  }, res);

  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.body, { quotaExhausted: true, quota: QUOTA });
  assert.equal(res.headers["retry-after"], "60");
});

test("one-shot quota response replaces invalid resetAt with next UTC midnight", async (t) => {
  const error = Object.assign(new Error("Quota BSD esaurita"), {
    quotaExhausted: true,
    status: 429,
    quota: QUOTA
  });
  const statusQuota = { ...QUOTA, resetAt: "invalid", internal: "do not expose" };
  const { handler, hash } = loadHandlerWithRefreshError(t, error, async () => ({ quota: statusQuota }));
  const res = mockRes();

  await handler({
    method: "POST",
    headers: { cookie: cookie(hash) },
    body: { leagueId: "fp", action: "full-sync" }
  }, res);

  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.body, { quotaExhausted: true, quota: QUOTA });
  assert.equal(res.headers["retry-after"], "60");
});

test("quota accounting failure still returns a sanitized 429", async (t) => {
  await setup();
  const originalHash = process.env.ADMIN_LINKS_PASSWORD_HASH;
  const hash = "test-admin-hash";
  process.env.ADMIN_LINKS_PASSWORD_HASH = hash;
  const modulePaths = [
    API_PATH,
    MEDIA_PATH,
    require.resolve(path.join(ROOT, "lib", "media", "manifest-state.cjs")),
    require.resolve(path.join(ROOT, "lib", "media", "bsd-provider.cjs")),
    require.resolve(path.join(ROOT, "lib", "neon.cjs"))
  ];
  const originalModules = new Map(modulePaths.map((modulePath) => [modulePath, require.cache[modulePath]]));
  const neonPath = modulePaths.at(-1);
  let quotaReads = 0;

  delete require.cache[modulePaths[2]];
  delete require.cache[modulePaths[3]];
  delete require.cache[MEDIA_PATH];
  delete require.cache[API_PATH];
  require.cache[neonPath] = {
    id: neonPath,
    filename: neonPath,
    loaded: true,
    exports: {
      databaseConfigured: () => true,
      readBsdQuota: async (date) => {
        quotaReads += 1;
        if (quotaReads > 1) throw new Error("quota read failed");
        return { date, calls: 0, rateLimitedUntil: null };
      },
      incrementBsdQuota: async () => { throw new Error("quota increment failed"); },
      markBsdQuotaRateLimited: async () => { throw new Error("quota rate-limit failed"); },
      acquireRefreshCheckpoint: async (league, owner) => ({ checkpoint: null, owner, fencingToken: 1 }),
      renewRefreshCheckpoint: async () => true,
      releaseRefreshCheckpoint: async () => true,
      publishManifestAndClearRefreshCheckpoint: async () => true,
      upsertPlayerOverrideWithRefreshLease: async () => true,
      upsertTeamOverridesWithRefreshLease: async () => true,
      readManifestCache: async () => null,
      readPlayerOverrides: async () => ({}),
      readTeamOverrides: async () => ({}),
      readRuntimeSetting: async () => null,
      writeRuntimeSetting: async () => ({})
    }
  };
  const csvFetch = global.fetch;
  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "example.test") return csvFetch(input);
    if (url.pathname === "/api/teams/") return jsonResponse({ detail: "quota finita" }, 429);
    throw new Error(`Unexpected fetch: ${url}`);
  };
  t.after(async () => {
    if (originalHash === undefined) delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    else process.env.ADMIN_LINKS_PASSWORD_HASH = originalHash;
    for (const [modulePath, cached] of originalModules) {
      if (cached) require.cache[modulePath] = cached;
      else delete require.cache[modulePath];
    }
    await teardown();
  });

  const res = mockRes();
  await require(API_PATH)({
    method: "POST",
    headers: { cookie: cookie(hash) },
    body: { leagueId: "fp", action: "full-sync" }
  }, res);

  assert.equal(res.statusCode, 429);
  assert.deepEqual(Object.keys(res.body).sort(), ["quota", "quotaExhausted"]);
  assert.equal(res.body.quotaExhausted, true);
  assert.equal(Number.isFinite(res.body.quota.callsToday), true);
  assert.equal(res.body.quota.callsToday >= 0, true);
  assert.equal(Number.isFinite(res.body.quota.limit), true);
  assert.equal(res.body.quota.limit > 0, true);
  assert.equal(res.body.quota.exhausted, true);
  assert.equal(Date.parse(res.body.quota.resetAt) > Date.now(), true);
  assert.equal(res.body.quota.rateLimitedUntil, null);
  assert.ok(Number(res.headers["retry-after"]) > 0);
});

test("POST player-media refresh/continue-sync segue gli step fino al terminale", async (t) => {
  // Admin session.
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync("test-password", salt, 32);
  const hash = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
  process.env.ADMIN_LINKS_PASSWORD_HASH = hash;

  await setup();
  t.after(async () => {
    delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    clearModuleCache();
    await teardown();
  });

  const handler = require(path.join(ROOT, "api", "player-media.js"));
  const start = mockRes();
  await handler({
    method: "POST",
    headers: { cookie: cookie(hash) },
    body: { leagueId: "fp", action: "refresh" }
  }, start);
  assert.equal(start.statusCode, 200, start.body?.error || "");
  assert.ok(start.body, "risposta presente");
  assert.ok(start.body.pending === true || start.body.pending === false, "payload step con pending");
  if (start.body.pending === false) {
    assert.ok(start.body.manifest?.players, "terminale: manifest con players");
    return; // nessun giro di continue necessario
  }

  // La prima chiamata ha frammentato: proseguire fino al terminale.
  let result = start.body;
  let guard = 0;
  while (result.pending && guard < 60) {
    guard += 1;
    const res = mockRes();
    await handler({
      method: "POST",
      headers: { cookie: cookie(hash) },
      body: { leagueId: "fp", action: "continue-sync" }
    }, res);
    assert.equal(res.statusCode, 200, res.body.error || "");
    assert.ok(res.body?.pending === true || res.body?.pending === false, "step coerente");
    result = res.body;
  }
  assert.equal(result.pending, false, "il loop di continue-sync termina");
  assert.ok(result.manifest?.players, "manifest pubblico al terminale");
});
