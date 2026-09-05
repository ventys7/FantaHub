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
