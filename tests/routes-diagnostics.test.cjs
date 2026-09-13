const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const DIAGNOSE_URL = pathToFileURL(path.join(ROOT, "scripts/diagnose.mjs")).href;
const REQUIRED_SECTIONS = [
  "formation",
  "listone",
  "rose",
  "scambi",
  "calendario",
  "classifica",
  "regolamento"
];

test("league diagnostics accept the live seven-tab shell", async () => {
  const { REQUIRED_LEAGUE_SECTIONS, inspectLeaguePage } = await import(DIAGNOSE_URL);
  const html = await readFile(path.join(ROOT, "index.html"), "utf8");

  assert.deepEqual(REQUIRED_LEAGUE_SECTIONS, REQUIRED_SECTIONS);
  assert.deepEqual(inspectLeaguePage(html), { missingSections: [] });
});

test("league diagnostics report a genuinely missing tab", async () => {
  const { inspectLeaguePage } = await import(DIAGNOSE_URL);
  const html = await readFile(path.join(ROOT, "index.html"), "utf8");

  assert.deepEqual(inspectLeaguePage(html.replace('data-league-tab="regolamento"', "")), {
    missingSections: ["regolamento"]
  });
});

test("diagnose accepts generated league pages", () => {
  const result = spawnSync(process.execPath, ["scripts/diagnose.mjs"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
