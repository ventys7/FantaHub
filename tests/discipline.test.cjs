"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePublishedDocUrl, parseDisciplineHtml } = require("../lib/discipline.cjs");

test("discipline parser reads two-column published-doc tables", () => {
  const parsed = parseDisciplineHtml(`
    <table>
      <tr><td>Richiami</td><td>Penalizzazioni</td></tr>
      <tr><td>04/11/25 - Il manager Edoardo Russo riceve un richiamo per il mancato inserimento dei voti entro i tempo prestabiliti (2 RICHIAMI)</td><td>02/12/25 - Il manager Edoardo Russo riceve</td><td>-2</td></tr>
      <tr><td>01/11/25 - Il manager Sebastian Mazza riceve un richiamo per il mancato inserimento della formazione entro i tempi prestabiliti (1 RICHIAMO)</td><td>25/01/26 - Il manager Edis Abdulai riceve</td><td>-25</td></tr>
    </table>
  `);
  assert.deepEqual(parsed.recalls.map((item) => [item.name, item.count]), [["Edoardo Russo", 2], ["Sebastian Mazza", 1]]);
  assert.deepEqual(parsed.penalties.map((item) => [item.name, item.points]), [["Edoardo Russo", -1], ["Edis Abdulai", -1]]);
  assert.equal(parsed.recalls[0].reason, "Voti non inseriti entro il termine previsto");
  assert.equal(parsed.penalties[0].reason, "Penalizzazione disciplinare");
});

test("discipline parser excludes Google Docs CSS and executable text", () => {
  const parsed = parseDisciplineHtml(`
    <style>@import url(https://themes.googleusercontent.com/fonts/css);</style>
    <p>Richiami</p>
    <p>03/11/25 - Il manager Edoardo Russo riceve un richiamo per il mancato inserimento della formazione sul docs entro i tempi prestabiliti di 12 ore (1 RICHIAMO)</p>
    <p>Penalizzazioni</p>
    <p>02/12/25 - Il manager Edoardo Russo riceve una penalizzazione di -2 punti</p>
    <script>function _F_toggles_initialize(a){ globalThis._F_toggles=a }</script>
  `);
  assert.equal(parsed.recalls.length, 1);
  assert.equal(parsed.recalls[0].reason, "Formazione non inserita nel documento entro 12 ore");
  assert.equal(parsed.penalties.length, 1);
  assert.equal(parsed.penalties[0].points, -2);
});

test("discipline parser turns Google Docs date anchors into the default one-point penalty", () => {
  const parsed = parseDisciplineHtml(`<p>Penalizzazioni</p><p>25/01/26 - Il manager Edis Abdulai riceve</p><p>-25</p>`);
  assert.equal(parsed.penalties.length, 1);
  assert.equal(parsed.penalties[0].name, "Edis Abdulai");
  assert.equal(parsed.penalties[0].points, -1);
});

test("published Docs typo is normalized", () => {
  assert.equal(
    normalizePublishedDocUrl("https://docs.google.com/document/d/e/example/pubva"),
    "https://docs.google.com/document/d/e/example/pub"
  );
});

test("loadDiscipline rejects non-HTTPS and credentialed sources", async () => {
  const { loadDiscipline } = require("../lib/discipline.cjs");
  for (const url of ["http://example.com/doc", "https://user@example.com/doc", "bad-url"]) {
    await assert.rejects(loadDiscipline(url), /URL|HTTPS|credenzial/i);
  }
});

test("loadDiscipline uses the shared 2 MiB HTML transport", async (t) => {
  const safePath = require.resolve("../lib/safe-fetch.cjs");
  const disciplinePath = require.resolve("../lib/discipline.cjs");
  const previousSafe = require.cache[safePath];
  const calls = [];
  require.cache[safePath] = {
    id: safePath,
    filename: safePath,
    loaded: true,
    exports: {
      safeFetch: async (url, options) => {
        calls.push({ url, options });
        return { body: Buffer.from("<p>Richiami</p>") };
      }
    }
  };
  delete require.cache[disciplinePath];
  t.after(() => {
    delete require.cache[disciplinePath];
    if (previousSafe) require.cache[safePath] = previousSafe;
    else delete require.cache[safePath];
  });

  const { loadDiscipline } = require("../lib/discipline.cjs");
  await loadDiscipline("https://example.com/doc");
  assert.equal(calls[0].options.maxBytes, 2 * 1024 * 1024);
  assert.deepEqual(calls[0].options.allowedMimeTypes, ["text/html"]);
});

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

async function runDisciplineApi(loadDiscipline) {
  const apiPath = require.resolve("../api/discipline.js");
  const disciplinePath = require.resolve("../lib/discipline.cjs");
  const settingsPath = require.resolve("../lib/settings.cjs");
  const previousDiscipline = require.cache[disciplinePath];
  const previousSettings = require.cache[settingsPath];
  require.cache[disciplinePath] = { id: disciplinePath, filename: disciplinePath, loaded: true, exports: { loadDiscipline } };
  require.cache[settingsPath] = {
    id: settingsPath,
    filename: settingsPath,
    loaded: true,
    exports: {
      leagueId: (value) => value,
      readSettings: async () => ({ leagues: { fp: { disciplineDocUrl: "https://example.com/doc" } } })
    }
  };
  delete require.cache[apiPath];
  try {
    const res = mockRes();
    await require("../api/discipline.js")({ method: "GET", query: { league: "fp" } }, res);
    return res;
  } finally {
    delete require.cache[apiPath];
    if (previousDiscipline) require.cache[disciplinePath] = previousDiscipline;
    else delete require.cache[disciplinePath];
    if (previousSettings) require.cache[settingsPath] = previousSettings;
    else delete require.cache[settingsPath];
  }
}

test("discipline API caches only successful loads", async () => {
  const res = await runDisciplineApi(async () => ({ recalls: [], penalties: [] }));
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["cache-control"], /^public/);
});

test("discipline API disables caching when loading fails", async () => {
  const res = await runDisciplineApi(async () => { throw new Error("upstream failed"); });
  assert.equal(res.statusCode, 502);
  assert.equal(res.headers["cache-control"], "no-store");
});
