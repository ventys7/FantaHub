"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");

const { hashCode, verifyCode } = require("../lib/logo-access.cjs");

test("hashCode and verifyCode roundtrip works correctly", async () => {
  const code = "123456";
  const encoded = await hashCode(code);
  assert.match(encoded, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
  assert.equal(await verifyCode(code, encoded), true);
});

test("verifyCode rejects wrong code", async () => {
  const encoded = await hashCode("123456");
  assert.equal(await verifyCode("wrong", encoded), false);
  assert.equal(await verifyCode("", encoded), false);
  assert.equal(await verifyCode(null, encoded), false);
});

test("verifyCode rejects malformed hashes", async () => {
  assert.equal(await verifyCode("123", ""), false);
  assert.equal(await verifyCode("123", "not-a-hash"), false);
  assert.equal(await verifyCode("123", "scrypt$ab"), false);
  assert.equal(await verifyCode("123", "scrypt$ab$cd"), false);
});

test("hashCode produces different salts each time", async () => {
  const a = await hashCode("same-code");
  const b = await hashCode("same-code");
  assert.notEqual(a, b);
});

test("readAccess returns empty teams when no data exists", async () => {
  // LOCAL_ROOT in storage.cjs è catturato al require: per isolare il test dai
  // dati runtime reali (.lineup-runtime creato dall'uso locale) si ricaricano
  // i moduli dopo il chdir e si ripristina la cache alla fine.
  const modulePaths = [
    "../lib/logo-access.cjs",
    "../lib/storage.cjs",
    "../lib/neon.cjs",
    "../lib/settings.cjs"
  ];
  const saved = new Map();
  for (const relative of modulePaths) {
    const resolved = require.resolve(relative);
    if (require.cache[resolved]) saved.set(resolved, require.cache[resolved]);
    delete require.cache[resolved];
  }
  const originalCwd = process.cwd();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-logo-test-"));
  process.chdir(tempRoot);
  try {
    const { readAccess } = require("../lib/logo-access.cjs");
    const result = await readAccess("fp");

    assert.equal(result.version, 1);
    assert.equal(result.leagueId, "fp");
    assert.deepEqual(result.teams, {});
  } finally {
    process.chdir(originalCwd);
    for (const relative of modulePaths) {
      try { delete require.cache[require.resolve(relative)]; } catch {}
    }
    for (const [resolved, entry] of saved) require.cache[resolved] = entry;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("readAccess fails closed on malformed local runtime JSON", async () => {
  const modulePaths = ["../lib/logo-access.cjs", "../lib/storage.cjs", "../lib/settings.cjs"];
  const saved = new Map(modulePaths.map((relative) => {
    const resolved = require.resolve(relative);
    return [resolved, require.cache[resolved]];
  }));
  const originalCwd = process.cwd();
  const previousEnv = Object.fromEntries(["DATABASE_URL", "POSTGRES_URL", "VERCEL"].map((name) => [name, process.env[name]]));
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-logo-malformed-"));
  for (const name of Object.keys(previousEnv)) delete process.env[name];
  process.chdir(tempRoot);
  for (const resolved of saved.keys()) delete require.cache[resolved];
  try {
    const runtimeDir = path.join(tempRoot, ".lineup-runtime", "logo-access");
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.writeFile(path.join(runtimeDir, "fp.json"), "{private-code");
    const { readAccess } = require("../lib/logo-access.cjs");

    await assert.rejects(readAccess("fp"), (error) => {
      assert.match(error.message, /JSON runtime non valido/);
      assert.doesNotMatch(error.message, /private-code/);
      assert.doesNotMatch(error.message, new RegExp(tempRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      return true;
    });
  } finally {
    process.chdir(originalCwd);
    for (const [name, value] of Object.entries(previousEnv)) value === undefined ? delete process.env[name] : process.env[name] = value;
    for (const resolved of saved.keys()) delete require.cache[resolved];
    for (const [resolved, cached] of saved) if (cached) require.cache[resolved] = cached;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("readAccess rejects invalid league", async () => {
  const { readAccess } = require("../lib/logo-access.cjs");
  await assert.rejects(
    () => readAccess("invalid"),
    /Lega non valida/
  );
});

test("resetCode rejects empty team name", async () => {
  const { resetCode } = require("../lib/logo-access.cjs");
  await assert.rejects(
    () => resetCode("fp", ""),
    /Fantasquadra non valida/
  );
  await assert.rejects(
    () => resetCode("fp", "  "),
    /Fantasquadra non valida/
  );
});

test("checkCode throttles exact-cased teams independently and resets only the verified bucket", async () => {
  const neonPath = require.resolve("../lib/neon.cjs");
  const logoPath = require.resolve("../lib/logo-access.cjs");
  const authPath = require.resolve("../lib/admin-auth.cjs");
  const originalNeon = require.cache[neonPath];
  const encoded = await hashCode("123456");
  const lowerCaseEncoded = await hashCode("654321");
  const buckets = new Map();
  const store = {
    async consume(key) {
      const attempts = Math.min((buckets.get(key) || 0) + 1, 6);
      buckets.set(key, attempts);
      return { allowed: attempts <= 5, retryAfter: attempts <= 5 ? 0 : 900 };
    },
    async reset(key) { buckets.delete(key); }
  };
  require.cache[neonPath] = {
    id: neonPath,
    filename: neonPath,
    loaded: true,
    exports: {
      databaseConfigured: () => true,
      ensureSchema: async () => true,
      sqlClient: () => ({}),
      createAuthThrottleStore: () => store,
      readLogoAccessRows: async () => ({
        teams: {
          "Team Alfa": { codeHash: encoded },
          "team alfa": { codeHash: lowerCaseEncoded }
        },
        updatedAt: null
      }),
      deleteLogoAccess: async () => {},
      upsertLogoAccess: async () => {}
    }
  };
  delete require.cache[logoPath];
  delete require.cache[authPath];
  const originalScrypt = require("node:crypto").scrypt;
  let scryptCalls = 0;
  require("node:crypto").scrypt = (...args) => { scryptCalls += 1; return originalScrypt(...args); };
  try {
    const { checkCode } = require("../lib/logo-access.cjs");
    const req = { headers: { "x-forwarded-for": "192.0.2.30" } };
    for (let index = 0; index < 4; index += 1) assert.equal((await checkCode("fp", "Team Alfa", "000000", req)).verified, false);
    assert.equal((await checkCode("fp", "Team Alfa", "123456", req)).verified, true);
    for (let index = 0; index < 5; index += 1) assert.equal((await checkCode("fp", "Team Alfa", "000000", req)).throttled, false);
    const blocked = await checkCode("fp", "Team Alfa", "123456", req);

    assert.deepEqual(blocked, { verified: false, throttled: true, retryAfter: 900 });
    assert.equal(scryptCalls, 10);
    assert.equal((await checkCode("fp", "Unknown", "000000", req)).verified, false);
    assert.equal(buckets.size, 1);

    const caseReq = { headers: { "x-forwarded-for": "192.0.2.31" } };
    for (let index = 0; index < 4; index += 1) await checkCode("fp", "Team Alfa", "000000", caseReq);
    assert.equal((await checkCode("fp", "team alfa", "654321", caseReq)).verified, true);
    assert.equal((await checkCode("fp", "Team Alfa", "000000", caseReq)).throttled, false);
    const caseBlocked = await checkCode("fp", "Team Alfa", "123456", caseReq);

    assert.deepEqual(caseBlocked, { verified: false, throttled: true, retryAfter: 900 });
    assert.equal(scryptCalls, 16);
  } finally {
    require("node:crypto").scrypt = originalScrypt;
    delete require.cache[logoPath];
    delete require.cache[authPath];
    if (originalNeon) require.cache[neonPath] = originalNeon;
    else delete require.cache[neonPath];
  }
});

test("checkCode fails closed on Vercel when Neon is unavailable", async () => {
  const previous = { VERCEL: process.env.VERCEL, DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL };
  process.env.VERCEL = "1";
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  const logoPath = require.resolve("../lib/logo-access.cjs");
  const authPath = require.resolve("../lib/admin-auth.cjs");
  delete require.cache[logoPath];
  delete require.cache[authPath];
  try {
    const { checkCode } = require("../lib/logo-access.cjs");
    await assert.rejects(() => checkCode("fp", "Team Alfa", "000000", { headers: {} }), (error) => error.statusCode === 503);
  } finally {
    for (const [name, value] of Object.entries(previous)) value === undefined ? delete process.env[name] : process.env[name] = value;
    delete require.cache[logoPath];
    delete require.cache[authPath];
  }
});
