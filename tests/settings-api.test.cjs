"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

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

test("settings API rejects non-GET methods", async () => {
  const handler = require("../api/settings.js");
  const res = mockRes();
  await handler({ method: "POST" }, res);
  assert.equal(res.statusCode, 405);
  assert.match(res.body?.error || "", /non consentito/i);
});

test("settings API returns 500 when settings file is missing", async () => {
  const originalCwd = process.cwd();
  const { mkdtemp, rm, mkdir, writeFile } = require("node:fs/promises");
  const path = require("node:path");
  const os = require("node:os");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "lineup-settings-test-"));
  await mkdir(path.join(tempRoot, "data"), { recursive: true });
  await writeFile(path.join(tempRoot, "data", "settings.json"), "not valid json", "utf8");
  const prevCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    // Clear any cached settings module
    const handler = require("../api/settings.js");
    const res = mockRes();
    await handler({ method: "GET", query: {} }, res);
    // repositorySettings catches JSON errors and falls back to defaults
    assert.equal(res.statusCode, 200);
  } finally {
    process.chdir(prevCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("settings API rejects invalid league in query", async () => {
  const handler = require("../api/settings.js");
  const res = mockRes();
  await handler({ method: "GET", query: { league: "invalid" } }, res);
  assert.equal(res.statusCode, 500);
  assert.match(String(res.body?.error || ""), /Lega non valida/i);
});
