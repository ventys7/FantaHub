"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSettings } = require("../lib/settings.cjs");

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
