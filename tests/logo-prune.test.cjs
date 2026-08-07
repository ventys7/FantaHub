"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const NEON_PATH = require.resolve("../lib/neon.cjs");
const LISTONE_PATH = require.resolve("../lib/listone.cjs");

const LIB_PATHS = [
  "../api/admin.js",
  "../api/team-logo.js",
  "../lib/admin-auth.cjs",
  "../lib/http.cjs",
  "../lib/listone.cjs",
  "../lib/logo-access.cjs",
  "../lib/neon.cjs",
  "../lib/settings.cjs",
  "../lib/storage.cjs"
];

function clearLibCache() {
  for (const relative of LIB_PATHS) {
    try { delete require.cache[require.resolve(relative)]; } catch {}
  }
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

function fakeNeon(deleted) {
  return {
    databaseConfigured: () => true,
    ensureSchema: async () => true,
    deleteLogoAccess: async (league, keys) => { deleted.push({ league, keys }); },
    listTeamLogoMetadata: async () => ({}),
    readFantasyTeams: async () => null,
    readLogoAccessRows: async () => ({
      teams: {
        "Team A": { codeHash: "a" },
        "Team B": { codeHash: "b" },
        "Team C": { codeHash: "c" }
      },
      updatedAt: null
    }),
    readRuntimeSetting: async () => null,
    upsertLogoAccess: async () => {},
    writeFantasyTeams: async () => ({}),
    writeRuntimeSetting: async () => ({})
  };
}

function installNeonMock(neonMock) {
  const original = require.cache[NEON_PATH];
  clearLibCache();
  require.cache[NEON_PATH] = { id: NEON_PATH, filename: NEON_PATH, loaded: true, exports: neonMock };
  return () => {
    if (original) require.cache[NEON_PATH] = original;
    else delete require.cache[NEON_PATH];
    clearLibCache();
  };
}

function mockListone(loadLeagueAssets) {
  const original = require.cache[LISTONE_PATH];
  const real = require("../lib/listone.cjs");
  require.cache[LISTONE_PATH] = {
    id: LISTONE_PATH,
    filename: LISTONE_PATH,
    loaded: true,
    exports: { loadLeagueAssets, teamNamesFromAssets: real.teamNamesFromAssets }
  };
  return () => {
    if (original) require.cache[LISTONE_PATH] = original;
    else delete require.cache[LISTONE_PATH];
  };
}

async function seedRuntime(tempRoot) {
  await fs.mkdir(path.join(tempRoot, ".lineup-runtime", "teams"), { recursive: true });
  await fs.mkdir(path.join(tempRoot, ".lineup-runtime", "logo-access"), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, ".lineup-runtime", "teams", "fp.json"),
    JSON.stringify({ version: 1, leagueId: "fp", teams: { "Persisted Team": {}, "Out Team": {} } })
  );
  await fs.writeFile(
    path.join(tempRoot, ".lineup-runtime", "logo-access", "fp.json"),
    JSON.stringify({
      version: 1,
      leagueId: "fp",
      teams: {
        "Persisted Team": { codeHash: "a", version: 1 },
        "Out Team": { codeHash: "b", version: 1 }
      }
    })
  );
}

async function readLogoAccessFile(tempRoot) {
  const raw = await fs.readFile(path.join(tempRoot, ".lineup-runtime", "logo-access", "fp.json"), "utf8");
  return JSON.parse(raw);
}

async function seedTeamsFile(tempRoot, teams) {
  await fs.mkdir(path.join(tempRoot, ".lineup-runtime", "teams"), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, ".lineup-runtime", "teams", "fp.json"),
    JSON.stringify({ version: 1, leagueId: "fp", teams })
  );
}

function withLocalEnv(run) {
  return async () => {
    const originalCwd = process.cwd();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-prune-"));
    const saved = {};
    for (const key of ["DATABASE_URL", "POSTGRES_URL", "VERCEL"]) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.chdir(tempRoot);
    clearLibCache();
    try {
      await run(tempRoot);
    } finally {
      process.chdir(originalCwd);
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await fs.rm(tempRoot, { recursive: true, force: true });
      clearLibCache();
    }
  };
}

test("pruneStaleLogoCodes removes only stale teams with Neon backend (mock)", async () => {
  const deleted = [];
  const restore = installNeonMock(fakeNeon(deleted));
  try {
    const { pruneStaleLogoCodes } = require("../lib/logo-access.cjs");
    assert.equal(await pruneStaleLogoCodes("fp", ["Team A", "Team B"]), 1);
    assert.deepEqual(deleted, [{ league: "fp", keys: ["Team C"] }]);
    assert.equal(await pruneStaleLogoCodes("fp", ["Team A", "Team B"]), 1);
    assert.equal(deleted.length, 2);
  } finally {
    restore();
  }
});

test("pruneStaleLogoCodes never removes anything when currentTeamNames is empty", async () => {
  const deleted = [];
  const restore = installNeonMock(fakeNeon(deleted));
  try {
    const { pruneStaleLogoCodes } = require("../lib/logo-access.cjs");
    assert.equal(await pruneStaleLogoCodes("fp", []), 0);
    assert.equal(await pruneStaleLogoCodes("fp", null), 0);
    assert.equal(await pruneStaleLogoCodes("fp", ["  "]), 0);
    assert.equal(deleted.length, 0);
  } finally {
    restore();
  }
});

test("pruneStaleLogoCodes prunes local JSON store and is idempotent", withLocalEnv(async (tempRoot) => {
  const { pruneStaleLogoCodes, readAccess, resetCode } = require("../lib/logo-access.cjs");
  assert.ok(await resetCode("fp", "Team A"));
  assert.ok(await resetCode("fp", "Team B"));

  assert.equal(await pruneStaleLogoCodes("fp", ["Team A"]), 1);
  assert.deepEqual(Object.keys((await readAccess("fp")).teams), ["Team A"]);

  assert.equal(await pruneStaleLogoCodes("fp", ["Team A"]), 0);
  assert.deepEqual(Object.keys((await readAccess("fp")).teams), ["Team A"]);

  assert.ok(await resetCode("fp", "Team C"));
  assert.equal(await pruneStaleLogoCodes("fp", ["Team A", "Team C"]), 0);
  assert.deepEqual(Object.keys((await readAccess("fp")).teams).sort(), ["Team A", "Team C"]);

  assert.equal(await pruneStaleLogoCodes("fp", []), 0);
  assert.deepEqual(Object.keys((await readAccess("fp")).teams).sort(), ["Team A", "Team C"]);
}));

test("adminState returns only current CSV names and prunes stale codes", withLocalEnv(async (tempRoot) => {
  await seedRuntime(tempRoot);
  const restoreListone = mockListone(async () => ({
    assets: [{ ownerTag: "CSV Team" }, { ownerTag: "Persisted Team" }]
  }));
  try {
    const admin = require("../api/admin.js");
    const state = await admin.adminState("fp");
    assert.deepEqual(state.teams, ["CSV Team", "Persisted Team"]);
    assert.deepEqual(Object.keys(state.profiles).sort(), ["Out Team", "Persisted Team"]);
    const access = await readLogoAccessFile(tempRoot);
    assert.deepEqual(Object.keys(access.teams), ["Persisted Team"]);
  } finally {
    restoreListone();
  }
}));

test("adminState falls back to union and does NOT prune when CSV fails", withLocalEnv(async (tempRoot) => {
  await seedRuntime(tempRoot);
  const restoreListone = mockListone(async () => { throw new Error("network down"); });
  try {
    const admin = require("../api/admin.js");
    const state = await admin.adminState("fp");
    assert.deepEqual(state.teams, ["Out Team", "Persisted Team"]);
    const access = await readLogoAccessFile(tempRoot);
    assert.deepEqual(Object.keys(access.teams).sort(), ["Out Team", "Persisted Team"]);
  } finally {
    restoreListone();
  }
}));

test("admin POST prune-logo-codes removes stale codes and reports removedCount", withLocalEnv(async (tempRoot) => {
  await seedRuntime(tempRoot);
  process.env.ADMIN_LINKS_PASSWORD_HASH = "scrypt$prune-test";
  process.env.ADMIN_LINKS_SESSION_SECRET = "prune-test-secret";
  clearLibCache();
  const restoreListone = mockListone(async () => ({
    assets: [{ ownerTag: "Persisted Team" }, { ownerTag: "CSV Team" }]
  }));
  try {
    const payload = Buffer.from(JSON.stringify({ v: 1, exp: Math.floor(Date.now() / 1000) + 300 })).toString("base64url");
    const signature = crypto.createHmac("sha256", "prune-test-secret").update(payload).digest("base64url");
    const admin = require("../api/admin.js");
    const res = mockRes();
    await admin({
      method: "POST",
      headers: { cookie: `lineup_admin_session=${encodeURIComponent(`${payload}.${signature}`)}` },
      body: { action: "prune-logo-codes", leagueId: "fp" }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.removedCount, 1);
    assert.equal(res.body.leagueId, "fp");
    assert.equal(res.body.authenticated, true);
    const access = await readLogoAccessFile(tempRoot);
    assert.deepEqual(Object.keys(access.teams), ["Persisted Team"]);
  } finally {
    delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    delete process.env.ADMIN_LINKS_SESSION_SECRET;
    restoreListone();
  }
}));

test("team-logo POST rejects team no longer in current CSV even if code is stored", withLocalEnv(async (tempRoot) => {
  await seedTeamsFile(tempRoot, { "Old Team": {}, "New Team": {} });
  const restoreListone = mockListone(async () => ({ assets: [{ ownerTag: "New Team" }] }));
  try {
    const { resetCode } = require("../lib/logo-access.cjs");
    const code = await resetCode("fp", "Old Team");
    const handler = require("../api/team-logo.js");
    const res = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { leagueId: "fp", teamName: "Old Team", code, upload: { mimeType: "image/png", dataBase64: "aGVsbG8=" } }
    }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body?.error || "", /Fantasquadra non riconosciuta/);
  } finally {
    restoreListone();
  }
}));

test("team-logo POST falls back to profiles when CSV is down and proceeds to code check", withLocalEnv(async (tempRoot) => {
  await seedTeamsFile(tempRoot, { "Old Team": {} });
  const restoreListone = mockListone(async () => { throw new Error("network down"); });
  try {
    const handler = require("../api/team-logo.js");
    const res = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { leagueId: "fp", teamName: "Old Team", code: "000000", upload: { mimeType: "image/png", dataBase64: "aGVsbG8=" } }
    }, res);
    assert.equal(res.statusCode, 401);
    assert.match(res.body?.error || "", /Codice stemma errato/);
  } finally {
    restoreListone();
  }
}));

test("team-logo POST accepts team present in current CSV and proceeds to code check", withLocalEnv(async (tempRoot) => {
  await seedTeamsFile(tempRoot, { "New Team": {} });
  const restoreListone = mockListone(async () => ({ assets: [{ ownerTag: "New Team" }] }));
  try {
    const handler = require("../api/team-logo.js");
    const res = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { leagueId: "fp", teamName: "New Team", code: "999999", upload: { mimeType: "image/png", dataBase64: "aGVsbG8=" } }
    }, res);
    assert.equal(res.statusCode, 401);
    assert.match(res.body?.error || "", /Codice stemma errato/);
  } finally {
    restoreListone();
  }
}));