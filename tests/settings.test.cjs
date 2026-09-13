"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { cleanUrl, normalizeSettings } = require("../lib/settings.cjs");

const NEON_PATH = require.resolve("../lib/neon.cjs");
const SETTINGS_PATH = require.resolve("../lib/settings.cjs");
const STORAGE_PATH = require.resolve("../lib/storage.cjs");

test("runtime settings keep separate sources for FP and PD", () => {
  const settings = normalizeSettings({ leagues: {
    fp: { listoneCsvUrl: "https://example.com/fp.csv", standingsCsvUrl: "https://example.com/fp-standings.csv", disciplineDocUrl: "https://example.com/fp-doc", regolamentoDocUrl: "https://example.com/fp-regolamento" },
    pd: { listoneCsvUrl: "https://example.com/pd.csv", standingsCsvUrl: "", disciplineDocUrl: "" }
  }});
  assert.equal(settings.leagues.fp.listoneCsvUrl, "https://example.com/fp.csv");
  assert.equal(settings.leagues.pd.listoneCsvUrl, "https://example.com/pd.csv");
  assert.equal(settings.leagues.pd.standingsCsvUrl, "");
});

test("regolamento doc URL is normalized per league and defaults to empty", () => {
  const settings = normalizeSettings({ leagues: {
    fp: { regolamentoDocUrl: "https://docs.google.com/document/d/e/example/pub" },
    pd: {}
  }});
  assert.equal(settings.leagues.fp.regolamentoDocUrl, "https://docs.google.com/document/d/e/example/pub");
  assert.equal(settings.leagues.pd.regolamentoDocUrl, "");
});

test("calendario doc URL is normalized per league and defaults to empty", () => {
  const settings = normalizeSettings({ leagues: {
    fp: { calendarioDocUrl: "https://docs.google.com/document/d/e/example/pub" },
    pd: {}
  }});
  assert.equal(settings.leagues.fp.calendarioDocUrl, "https://docs.google.com/document/d/e/example/pub");
  assert.equal(settings.leagues.pd.calendarioDocUrl, "");
});

test("every configured source accepts only credential-free HTTPS URLs", () => {
  const fields = ["listoneCsvUrl", "standingsCsvUrl", "disciplineDocUrl", "regolamentoDocUrl", "calendarioDocUrl"];
  const invalidUrls = ["not a url", "http://example.com/source", "https://user@example.com/source", "https://user:secret@example.com/source"];
  assert.equal(cleanUrl("https://example.com/source"), "https://example.com/source");
  for (const field of fields) {
    for (const value of invalidUrls) {
      assert.throws(() => normalizeSettings({ leagues: { fp: { [field]: value } } }), /URL non valido/);
    }
  }
});

test("Vercel runtime blocks settings writes when Neon is unavailable", async () => {
  const previousVercel = process.env.VERCEL;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousPostgresUrl = process.env.POSTGRES_URL;
  process.env.VERCEL = "1";
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  try {
    const { saveSettings } = require("../lib/settings.cjs");
    await assert.rejects(
      () => saveSettings({ leagues: { fp: {}, pd: {} } }),
      /scrittura runtime bloccata/
    );
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousPostgresUrl === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = previousPostgresUrl;
  }
});

test("saveLeagueSettings uses the narrow Neon league update without reading the whole document", async () => {
  const originalNeon = require.cache[NEON_PATH];
  const originalSettings = require.cache[SETTINGS_PATH];
  const previousDatabaseUrl = process.env.DATABASE_URL;
  let received;
  process.env.DATABASE_URL = "postgres://settings-atomic-test";
  require.cache[NEON_PATH] = {
    id: NEON_PATH,
    filename: NEON_PATH,
    loaded: true,
    exports: {
      databaseConfigured: () => true,
      updateLeagueSettings: async (...args) => {
        received = args;
        return { value: { version: 1, leagues: { fp: args[1], pd: {} }, updatedAt: "2026-09-09T12:00:00.000Z" } };
      },
      readRuntimeSetting: async () => { throw new Error("whole-document read"); },
      writeRuntimeSetting: async () => { throw new Error("whole-document write"); }
    }
  };
  delete require.cache[SETTINGS_PATH];
  try {
    const { saveLeagueSettings } = require("../lib/settings.cjs");
    const saved = await saveLeagueSettings("FP", { listoneCsvUrl: "https://example.com/fp.csv" });

    assert.deepEqual(received, ["fp", {
      listoneCsvUrl: "https://example.com/fp.csv",
      standingsCsvUrl: "",
      disciplineDocUrl: "",
      regolamentoDocUrl: "",
      calendarioDocUrl: ""
    }]);
    assert.equal(saved.source, "neon");
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    originalNeon ? require.cache[NEON_PATH] = originalNeon : delete require.cache[NEON_PATH];
    originalSettings ? require.cache[SETTINGS_PATH] = originalSettings : delete require.cache[SETTINGS_PATH];
  }
});

test("saveLeagueSettings keeps the local fallback as a whole-document write", async () => {
  const originalCwd = process.cwd();
  const originalStorage = require.cache[STORAGE_PATH];
  const previousEnv = Object.fromEntries(["DATABASE_URL", "POSTGRES_URL", "VERCEL"].map((name) => [name, process.env[name]]));
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-settings-atomic-"));
  await fs.mkdir(path.join(tempRoot, "data"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, "data", "settings.json"), JSON.stringify({
    version: 1,
    leagues: { fp: {}, pd: { listoneCsvUrl: "https://example.com/pd.csv" } }
  }));
  for (const name of Object.keys(previousEnv)) delete process.env[name];
  process.chdir(tempRoot);
  delete require.cache[SETTINGS_PATH];
  delete require.cache[STORAGE_PATH];
  try {
    const { saveLeagueSettings } = require("../lib/settings.cjs");
    const saved = await saveLeagueSettings("fp", { listoneCsvUrl: "https://example.com/fp.csv" });

    assert.equal(saved.document.leagues.fp.listoneCsvUrl, "https://example.com/fp.csv");
    assert.equal(saved.document.leagues.pd.listoneCsvUrl, "https://example.com/pd.csv");
  } finally {
    process.chdir(originalCwd);
    for (const [name, value] of Object.entries(previousEnv)) value === undefined ? delete process.env[name] : process.env[name] = value;
    delete require.cache[SETTINGS_PATH];
    originalStorage ? require.cache[STORAGE_PATH] = originalStorage : delete require.cache[STORAGE_PATH];
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("readSettings fails closed on malformed local runtime JSON", async () => {
  const originalCwd = process.cwd();
  const originalSettings = require.cache[SETTINGS_PATH];
  const originalStorage = require.cache[STORAGE_PATH];
  const previousEnv = Object.fromEntries(["DATABASE_URL", "POSTGRES_URL", "VERCEL"].map((name) => [name, process.env[name]]));
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-settings-malformed-"));
  for (const name of Object.keys(previousEnv)) delete process.env[name];
  process.chdir(tempRoot);
  delete require.cache[SETTINGS_PATH];
  delete require.cache[STORAGE_PATH];
  try {
    await fs.mkdir(path.join(tempRoot, ".lineup-runtime"), { recursive: true });
    await fs.writeFile(path.join(tempRoot, ".lineup-runtime", "settings.json"), "{private-settings");
    const { readSettings } = require("../lib/settings.cjs");

    await assert.rejects(readSettings(), (error) => {
      assert.match(error.message, /JSON runtime non valido/);
      assert.doesNotMatch(error.message, /private-settings/);
      assert.doesNotMatch(error.message, new RegExp(tempRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      return true;
    });
  } finally {
    process.chdir(originalCwd);
    for (const [name, value] of Object.entries(previousEnv)) value === undefined ? delete process.env[name] : process.env[name] = value;
    delete require.cache[SETTINGS_PATH];
    delete require.cache[STORAGE_PATH];
    if (originalSettings) require.cache[SETTINGS_PATH] = originalSettings;
    if (originalStorage) require.cache[STORAGE_PATH] = originalStorage;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
