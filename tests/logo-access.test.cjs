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
  const originalCwd = process.cwd();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-logo-test-"));
  process.chdir(tempRoot);

  const { readAccess } = require("../lib/logo-access.cjs");
  const result = await readAccess("fp");

  assert.equal(result.version, 1);
  assert.equal(result.leagueId, "fp");
  assert.deepEqual(result.teams, {});

  await fs.rm(tempRoot, { recursive: true, force: true });
  process.chdir(originalCwd);
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
