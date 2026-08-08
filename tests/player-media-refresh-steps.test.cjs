"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const originalCwd = process.cwd();
let tempRoot;
let media;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

// N club, M giocatori in rosa ciascuno; gli altri N giocatori del CSV non
// compaiono in nessuna rosa, cosi' finiscono in pendingNameSearches.
function csvResponse(nClubs, rosterSize = 1) {
  const rows = ["Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto"];
  for (let c = 0; c < nClubs; c += 1) {
    const club = `Club${c}`;
    for (let p = 0; p < rosterSize; p += 1) {
      rows.push(`Paolo,A,Player${c}_${p},${club},30,35`);
    }
    rows.push(`Paolo,A,Extra${c},${club},18,22`); // mai in rosa BSD
  }
  return new Response(rows.join("\n"), { status: 200, headers: { "content-type": "text/csv" } });
}

// id BSD squadra = 1000 + indice club; id giocatore = 1000 + club*10 + p
function buildRosters(nClubs, rosterSize = 1) {
  const rosters = {};
  for (let c = 0; c < nClubs; c += 1) {
    rosters[1000 + c] = Array.from({ length: rosterSize }, (_, p) => ({
      id: 1000 + c * 10 + p,
      full_name: `Player${c}_${p}`
    }));
  }
  return rosters;
}

async function setup(nClubs = 2, rosterSize = 1, apiDelayMs = 0) {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-media-steps-"));
  await fs.mkdir(path.join(tempRoot, "data"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, "data", "settings.json"), JSON.stringify({
    version: 1,
    leagues: {
      fp: { listoneCsvUrl: "https://example.test/fp.csv", standingsCsvUrl: "", disciplineDocUrl: "" },
      pd: { listoneCsvUrl: "", standingsCsvUrl: "", disciplineDocUrl: "" }
    }
  }));
  process.chdir(tempRoot);

  process.env.BSD_API_KEY = "test-token";
  const rosters = buildRosters(nClubs, rosterSize);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  global.fetch = async (input) => {
    await sleep(apiDelayMs); // simula latenza fissa, per forzare il fingerprint a budget
    const url = new URL(String(input));
    if (url.hostname === "example.test") return csvResponse(nClubs, rosterSize);
    if (url.pathname === "/api/teams/") {
      return jsonResponse({
        count: nClubs,
        next: null,
        previous: null,
        results: Array.from({ length: nClubs }, (_, c) => ({
          id: 1000 + c,
          name: `Club${c}`,
          short_name: `Club${c}`,
          country: "England"
        }))
      });
    }
    if (url.pathname === "/api/players/") {
      if (url.searchParams.get("search")) {
        return jsonResponse({ count: 0, results: [] }); // nessun hit per nome
      }
      const team = Number(url.searchParams.get("team") || 0);
      return jsonResponse({ count: (rosters[team] || []).length, results: rosters[team] || [] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  // Rifacimento pulito: ogni test ricarica il modulo col proprio env.
  delete require.cache[require.resolve(path.join(originalCwd, "lib", "player-media.cjs"))];
  media = require(path.join(originalCwd, "lib", "player-media.cjs"));
}

async function teardown() {
  process.chdir(originalCwd);
  delete process.env.REFRESH_STEP_BUDGET_MS;
  delete process.env.FACE_BRIDGE_ENABLED;
  delete process.env.BSD_API_KEY;
  delete global.fetch;
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
}

function runSteps(seed) {
  return async () => {
    let result = seed;
    let guard = 0;
    while (result.pending && guard < 200) {
      guard += 1;
      result = await media.refreshDirectStep("fp", {});
    }
    assert.equal(result.pending, false, "il loop di step deve terminare");
    assert.ok(result.manifest, "risultato terminale espone il manifest pubblico");
    return { result, guard };
  };
}

test("refreshDirectStep prosegue a step e termina con lo stesso stato del refresh one-shot", async (t) => {
  await setup(2, 1);
  t.teardown?.(teardown);
  process.env.REFRESH_STEP_BUDGET_MS = "1"; // budget minuscolo: ogni chiamata quasi si ferma subito
  process.env.FACE_BRIDGE_ENABLED = "0"; // niente rete esterna nei test

  const first = await media.refreshDirectStep("fp", { reset: true });
  const { result } = await runSteps(first)();

  // Il manifest a step e la proiezione pubblica del one-shot devono avere le
  // stesse associazioni, ossia lo stesso comportamento complessivo.
  const state = await media.buildDirectState("fp", { fresh: true });
  const manifest = result.manifest;
  const oneShot = media.publicManifest(state.manifest);
  for (const entry of Object.values(state.manifest.players || {})) {
    const projected = manifest.players[entry.key];
    assert.ok(projected, `entry ${entry.key} presente anche nel manifest a step`);
    assert.equal(projected.status, oneShot.players[entry.key].status, `status di ${entry.key}`);
    assert.equal(projected.photoUrl || "", oneShot.players[entry.key].photoUrl || "", `foto di ${entry.key}`);
    assert.equal(projected.matchedBy || "", oneShot.players[entry.key].matchedBy || "", `associazione di ${entry.key}`);
    assert.equal(projected.externalId || "", oneShot.players[entry.key].externalId || "", `id BSD di ${entry.key}`);
  }
});

test("refreshDirectStep si ferma a meta' della fase teams e riprende", async (t) => {
  // 12 club (la fase teams lavora a batch di 5) e ~8ms di latenza per ogni
  // chiamata BSD: il budget di 1ms scade necessariamente tra le batch, quindi
  // il primo giro deve ritornare pending e i giri successivi riprendere.
  await setup(12, 1, 8);
  t.teardown?.(teardown);
  process.env.REFRESH_STEP_BUDGET_MS = "1";
  process.env.FACE_BRIDGE_ENABLED = "0";

  const first = await media.refreshDirectStep("fp", { reset: true });
  assert.equal(first.pending, true, "con budget di 1ms e latenza 8ms il primo step non puo' terminare");
  assert.equal(first.phase, "teams");
  assert.equal(typeof first.progress.clubsDone, "number", "progress espone il contatore club");
  assert.ok(first.progress.clubsDone <= 12, "al piu' 12 club completati");

  let result = first;
  let guard = 0;
  while (result.pending && guard < 300) {
    guard += 1;
    result = await media.refreshDirectStep("fp", {});
  }
  assert.equal(result.pending, false, "il loop di step deve terminare");
  assert.ok(result.manifest, "risultato terminale espone il manifest pubblico");
  // Nessun club puo' essere fallito: i mock rispondono sempre. Le voci
  // "Squadra BSD da confermare" (copertura 1/2) sono attese, non errori.
  const realIssues = (result.manifest.teamIssues || []).filter(
    (issue) => !/da confermare|Squadra BSD da confermare/.test(String(issue.error))
  );
  assert.deepEqual(realIssues, [], "nessun errore reale nelle squadre");
});
