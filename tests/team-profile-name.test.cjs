"use strict";

// Nomi fantasquadra (displayName) nella stessa logica dei loghi:
// stesso codice per-squadra, stessa chiave CSV, upload facoltativo.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const NEON_PATH = require.resolve("../lib/neon.cjs");
const LISTONE_PATH = require.resolve("../lib/listone.cjs");

const LIB_PATHS = [
  "../api/team-logo.js",
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

async function seedTeamsFile(tempRoot, teams) {
  await fs.mkdir(path.join(tempRoot, ".lineup-runtime", "teams"), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, ".lineup-runtime", "teams", "fp.json"),
    JSON.stringify({ version: 1, leagueId: "fp", teams })
  );
}

async function readTeamsFile(tempRoot) {
  const raw = await fs.readFile(path.join(tempRoot, ".lineup-runtime", "teams", "fp.json"), "utf8");
  return JSON.parse(raw).teams;
}

function withLocalEnv(run) {
  return async () => {
    const originalCwd = process.cwd();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-teamname-"));
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

test("team-logo POST saves displayName without upload when code is valid", withLocalEnv(async (tempRoot) => {
  await seedTeamsFile(tempRoot, { "Team Alfa": {}, "Team Beta": {} });
  const restoreListone = mockListone(async () => ({ assets: [{ ownerTag: "Team Alfa" }, { ownerTag: "Team Beta" }] }));
  try {
    const { resetCode } = require("../lib/logo-access.cjs");
    const code = await resetCode("fp", "Team Alfa");
    const handler = require("../api/team-logo.js");
    const res = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { leagueId: "fp", teamName: "Team Alfa", code, displayName: "Aquile Reali" }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.displayName, "Aquile Reali");
    const teams = await readTeamsFile(tempRoot);
    assert.equal(teams["Team Alfa"].displayName, "Aquile Reali");
  } finally {
    restoreListone();
  }
}));

test("team-logo POST rejects displayName longer than 24 characters (spaces included)", withLocalEnv(async (tempRoot) => {
  await seedTeamsFile(tempRoot, { "Team Alfa": {} });
  const restoreListone = mockListone(async () => ({ assets: [{ ownerTag: "Team Alfa" }] }));
  try {
    const { resetCode } = require("../lib/logo-access.cjs");
    const code = await resetCode("fp", "Team Alfa");
    const handler = require("../api/team-logo.js");
    const res = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { leagueId: "fp", teamName: "Team Alfa", code, displayName: "X".repeat(25) }
    }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body?.error || "", /troppo lungo/);
  } finally {
    restoreListone();
  }
}));

test("team-logo POST rejects duplicate displayName and participant-key collisions", withLocalEnv(async (tempRoot) => {
  await seedTeamsFile(tempRoot, { "Team Alfa": { displayName: "Aquile" }, "Team Beta": {} });
  const restoreListone = mockListone(async () => ({ assets: [{ ownerTag: "Team Alfa" }, { ownerTag: "Team Beta" }] }));
  try {
    const { resetCode } = require("../lib/logo-access.cjs");
    const code = await resetCode("fp", "Team Beta");
    const handler = require("../api/team-logo.js");
    const dup = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { leagueId: "fp", teamName: "Team Beta", code, displayName: "AQUILE" }
    }, dup);
    assert.equal(dup.statusCode, 400);
    assert.match(dup.body?.error || "", /già utilizzato/);
    const collision = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { leagueId: "fp", teamName: "Team Beta", code, displayName: "Team Alfa" }
    }, collision);
    assert.equal(collision.statusCode, 400);
    assert.match(collision.body?.error || "", /già utilizzato/);
  } finally {
    restoreListone();
  }
}));

test("team-logo POST clears displayName with empty string and normalizes own-key alias", withLocalEnv(async (tempRoot) => {
  await seedTeamsFile(tempRoot, { "Team Alfa": { displayName: "Aquile" } });
  const restoreListone = mockListone(async () => ({ assets: [{ ownerTag: "Team Alfa" }] }));
  try {
    const { resetCode } = require("../lib/logo-access.cjs");
    const code = await resetCode("fp", "Team Alfa");
    const handler = require("../api/team-logo.js");
    const cleared = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { leagueId: "fp", teamName: "Team Alfa", code, displayName: "   " }
    }, cleared);
    assert.equal(cleared.statusCode, 200);
    assert.equal(cleared.body.displayName, "");
    const alias = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { leagueId: "fp", teamName: "Team Alfa", code, displayName: "Aquile Nuove" }
    }, alias);
    assert.equal(alias.body.displayName, "Aquile Nuove");
    const redundant = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { leagueId: "fp", teamName: "Team Alfa", code, displayName: "Team Alfa" }
    }, redundant);
    assert.equal(redundant.statusCode, 200);
    assert.equal(redundant.body.displayName, "");
  } finally {
    restoreListone();
  }
}));

test("team-logo POST with upload preserves existing displayName (Neon path)", async () => {
  const original = require.cache[NEON_PATH];
  clearLibCache();
  const codeHash = await require("../lib/logo-access.cjs").hashCode("123456");
  clearLibCache();
  let saved = null;
  require.cache[NEON_PATH] = {
    id: NEON_PATH,
    filename: NEON_PATH,
    loaded: true,
    exports: {
      databaseConfigured: () => true,
      ensureSchema: async () => true,
      sqlClient: () => ({}),
      createAuthThrottleStore: () => ({ consume: async () => ({ allowed: true, retryAfter: 0 }), reset: async () => {} }),
      readTeamLogo: async () => null,
      updateTeamIdentity: async (league, teamName, profile, logo) => {
        saved = { league, teamName, profile, logo };
      },
      listTeamLogoMetadata: async () => ({}),
      readFantasyTeams: async () => ({
        teams: { "Team Alfa": { displayName: "Aquile", logoUrl: "" } },
        updatedAt: null
      }),
      readLogoAccessRows: async () => ({ teams: { "Team Alfa": { codeHash } }, updatedAt: null }),
      upsertLogoAccess: async () => {},
      deleteLogoAccess: async () => {},
      readRuntimeSetting: async () => null,
      writeRuntimeSetting: async () => ({})
    }
  };
  const restoreListone = mockListone(async () => ({ assets: [{ ownerTag: "Team Alfa" }] }));
  try {
    const handler = require("../api/team-logo.js");
    const res = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: {
        leagueId: "fp",
        teamName: "Team Alfa",
        code: "123456",
        upload: {
          mimeType: "image/png",
          dataBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nAAAAABJRU5ErkJggg=="
        }
      }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.displayName, "Aquile");
    assert.equal(saved.profile.displayName, "Aquile");
    assert.match(saved.profile.logoUrl || "", /^\/api\/team-logo\?/);
    assert.equal(saved.logo.mimeType, "image/png");
  } finally {
    restoreListone();
    if (original) require.cache[NEON_PATH] = original;
    else delete require.cache[NEON_PATH];
    clearLibCache();
  }
});
