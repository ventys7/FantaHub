"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Replicate scryptAsync for test hash generation (same algorithm as admin-auth.cjs)
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

function clearModuleCache() {
  delete require.cache[require.resolve("../api/admin.js")];
  delete require.cache[require.resolve("../lib/admin-auth.cjs")];
}

function installModuleMock(relative, exports) {
  const resolved = require.resolve(relative);
  const original = require.cache[resolved];
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
  return () => original ? require.cache[resolved] = original : delete require.cache[resolved];
}

function installAdminDependencies() {
  const { leagueId } = require("../lib/settings.cjs");
  return [
    installModuleMock("../lib/settings.cjs", {
      leagueId,
      readSettings: async () => ({ leagues: { fp: {}, pd: {} } }),
      readTeamProfiles: async (id) => ({ leagueId: id, teams: {} }),
      saveLeagueSettings: async () => {}
    }),
    installModuleMock("../lib/listone.cjs", {
      loadLeagueAssets: async () => { throw new Error("not configured"); },
      teamNamesFromAssets: () => []
    }),
    installModuleMock("../lib/logo-access.cjs", { pruneStaleLogoCodes: async () => 0, resetCode: async () => "000000" }),
    installModuleMock("../lib/migrate-neon.cjs", { migrateLegacyRuntimeToNeon: async () => ({}) })
  ];
}

function installThrottleNeon(records = new Map()) {
  const real = require("../lib/neon.cjs");
  const store = {
    async consume(key) {
      const attempts = Math.min((records.get(key) || 0) + 1, 6);
      records.set(key, attempts);
      return { allowed: attempts <= 5, retryAfter: attempts <= 5 ? 0 : 900 };
    },
    async reset(key) { records.delete(key); }
  };
  return installModuleMock("../lib/neon.cjs", {
    ...real,
    databaseConfigured: () => true,
    ensureSchema: async () => true,
    sqlClient: () => ({}),
    createAuthThrottleStore: () => store
  });
}

test("admin API returns 503 when password hash is not configured", async () => {
  const prevHash = process.env.ADMIN_LINKS_PASSWORD_HASH;
  delete process.env.ADMIN_LINKS_PASSWORD_HASH;
  clearModuleCache();
  try {
    const handler = require("../api/admin.js");
    const res = mockRes();
    await handler({ method: "GET", query: {}, headers: {} }, res);
    assert.equal(res.statusCode, 503);
    assert.match(res.body?.error || "", /non configurato/i);
  } finally {
    if (prevHash !== undefined) process.env.ADMIN_LINKS_PASSWORD_HASH = prevHash;
    else delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    clearModuleCache();
  }
});

test("admin API login rejects wrong password", async () => {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync("correct-password", salt, 32);
  process.env.ADMIN_LINKS_PASSWORD_HASH = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
  clearModuleCache();
  try {
    const handler = require("../api/admin.js");
    const res = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { action: "login", password: "wrong-password", leagueId: "fp" }
    }, res);
    // Login returns 401 with error message, not authenticated: false
    assert.equal(res.statusCode, 401);
    assert.match(res.body?.error || "", /Password errata|errata/i);
  } finally {
    delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    clearModuleCache();
  }
});

test("admin API GET with invalid league returns error", async () => {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync("test-password", salt, 32);
  process.env.ADMIN_LINKS_PASSWORD_HASH = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
  clearModuleCache();
  try {
    const handler = require("../api/admin.js");
    const res = mockRes();
    await handler({
      method: "GET",
      query: { league: "invalid" },
      headers: {}
    }, res);
    // GET handler now catches leagueId() error and returns 400
    assert.equal(res.statusCode, 400);
    assert.match(res.body?.error || "", /Lega non valida/i);
  } finally {
    delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    clearModuleCache();
  }
});

test("admin auth keys normalize purpose and league but isolate exact-cased teams and clients", () => {
  clearModuleCache();
  const { authThrottleKey, clientIp } = require("../lib/admin-auth.cjs");
  const req = {
    headers: { "x-forwarded-for": " ::FFFF:192.0.2.4 , 198.51.100.7", "x-real-ip": "203.0.113.9" },
    socket: { remoteAddress: "198.51.100.8" }
  };
  const base = authThrottleKey({ purpose: "team", league: " FP ", team: " Team Alfa ", req });

  assert.equal(clientIp(req), "192.0.2.4");
  assert.equal(clientIp({ headers: { "x-forwarded-for": "  , 198.51.100.7", "x-real-ip": " 203.0.113.9 " } }), "203.0.113.9");
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.equal(base, authThrottleKey({ purpose: "TEAM", league: "fp", team: "Team Alfa", req }));
  assert.notEqual(base, authThrottleKey({ purpose: "team", league: "fp", team: "team alfa", req }));
  assert.notEqual(base, authThrottleKey({ purpose: "admin", league: "fp", team: "team alfa", req }));
  assert.notEqual(base, authThrottleKey({ purpose: "team", league: "pd", team: "team alfa", req }));
  assert.notEqual(base, authThrottleKey({ purpose: "team", league: "fp", team: "team beta", req }));
  assert.notEqual(base, authThrottleKey({ purpose: "team", league: "fp", team: "team alfa", req: { headers: { "x-real-ip": "192.0.2.5" } } }));
  clearModuleCache();
});

test("admin API hides raw throttle backend failures behind a generic 503", async () => {
  const diagnostic = "NEON_ADMIN_THROTTLE_INTERNAL_42";
  const previousHash = process.env.ADMIN_LINKS_PASSWORD_HASH;
  const realNeon = require("../lib/neon.cjs");
  const restoreNeon = installModuleMock("../lib/neon.cjs", {
    ...realNeon,
    databaseConfigured: () => true,
    ensureSchema: async () => true,
    sqlClient: () => ({}),
    createAuthThrottleStore: () => ({
      consume: async () => { throw new Error(diagnostic); },
      reset: async () => {}
    })
  });
  process.env.ADMIN_LINKS_PASSWORD_HASH = "configured";
  clearModuleCache();
  try {
    const handler = require("../api/admin.js");
    const res = mockRes();
    await handler({
      method: "POST",
      headers: { "x-real-ip": "192.0.2.22" },
      body: { action: "login", password: "wrong", leagueId: "fp" }
    }, res);

    assert.deepEqual(
      { statusCode: res.statusCode, body: res.body, leaked: JSON.stringify(res.body).includes(diagnostic) },
      { statusCode: 503, body: { error: "Servizio temporaneamente non disponibile" }, leaked: false }
    );
  } finally {
    if (previousHash === undefined) delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    else process.env.ADMIN_LINKS_PASSWORD_HASH = previousHash;
    clearModuleCache();
    restoreNeon();
  }
});

test("admin API shares five failed attempts across fresh handlers and blocks the sixth before scrypt", async () => {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync("correct-password", salt, 32);
  const records = new Map();
  const restoreNeon = installThrottleNeon(records);
  const restores = installAdminDependencies();
  const originalScrypt = crypto.scrypt;
  let scryptCalls = 0;
  crypto.scrypt = (...args) => { scryptCalls += 1; return originalScrypt(...args); };
  process.env.ADMIN_LINKS_PASSWORD_HASH = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
  try {
    const statuses = [];
    let last;
    for (let index = 0; index < 6; index += 1) {
      clearModuleCache();
      const handler = require("../api/admin.js");
      last = mockRes();
      await handler({
        method: "POST",
        headers: { "x-forwarded-for": "192.0.2.20" },
        body: { action: "login", password: "wrong-password", leagueId: "fp" }
      }, last);
      statuses.push(last.statusCode);
    }

    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429]);
    assert.match(last.headers["retry-after"], /^\d+$/);
    assert.doesNotMatch(last.body?.error || "", /password|credential/i);
    assert.equal(scryptCalls, 5);
  } finally {
    crypto.scrypt = originalScrypt;
    delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    clearModuleCache();
    restores.reverse().forEach((restore) => restore());
    restoreNeon();
  }
});

test("successful admin verification resets the failed-attempt bucket", async () => {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync("correct-password", salt, 32);
  const restoreNeon = installThrottleNeon();
  const restores = installAdminDependencies();
  process.env.ADMIN_LINKS_PASSWORD_HASH = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
  const request = (password) => ({
    method: "POST",
    headers: { "x-real-ip": "192.0.2.21" },
    body: { action: "login", password, leagueId: "fp" }
  });
  try {
    const handler = require("../api/admin.js");
    for (let index = 0; index < 4; index += 1) await handler(request("wrong"), mockRes());
    const success = mockRes();
    await handler(request("correct-password"), success);
    const afterReset = mockRes();
    await handler(request("wrong"), afterReset);

    assert.equal(success.statusCode, 200);
    assert.equal(afterReset.statusCode, 401);
  } finally {
    delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    clearModuleCache();
    restores.reverse().forEach((restore) => restore());
    restoreNeon();
  }
});

test("admin API controls invalid POST leagues and fails closed on Vercel without Neon", async () => {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync("correct-password", salt, 32);
  const previous = { VERCEL: process.env.VERCEL, DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL };
  process.env.ADMIN_LINKS_PASSWORD_HASH = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  try {
    clearModuleCache();
    let handler = require("../api/admin.js");
    const invalid = mockRes();
    await handler({ method: "POST", headers: {}, body: { action: "login", leagueId: "bad", password: "wrong" } }, invalid);
    assert.equal(invalid.statusCode, 400);

    process.env.VERCEL = "1";
    clearModuleCache();
    handler = require("../api/admin.js");
    const unavailable = mockRes();
    await handler({ method: "POST", headers: {}, body: { action: "login", leagueId: "fp", password: "wrong" } }, unavailable);
    assert.equal(unavailable.statusCode, 503);
  } finally {
    delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    for (const [name, value] of Object.entries(previous)) value === undefined ? delete process.env[name] : process.env[name] = value;
    clearModuleCache();
  }
});
