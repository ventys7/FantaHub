"use strict";

// Regressione per l'errore produzione "Squadra BSD da confermare per Athletic
// Bilbao". Cause accertate (verifiche live 2026-08-07 su sports.bzzoiro.com):
//  1. i seed di data/bsd-team-seeds.json puntavano a ID sbagliati del catalogo:
//     athletic club 843 = Athletic Club BRASILIANO (venue "Estádio Joaquim
//     Patinhas", cap 8000, rosa brasiliana) -> il vero Athletic (Bilbao) e'
//     id 51 (venue "San Mamés", 53289); real madrid 926 = Real Madrid FEMENINO
//     (Ciudad Real Madrid, cap 6000, rosa Folgado/Redondo) -> maschile = 57;
//     alaves 3884 = femminile -> maschile = 45; valencia 3885 = femminile
//     -> maschile = 47. Altri id con lo stesso nome nel directory Spagna
//     (es. 911 "Athletic Club" = Instalaciones de Lezama, giovanile cap 1500)
//     non vanno scelti perché rosa giovanili/ridotte.
//  2. tokenSimilarity dava peso pieno al token generico "club": "Athletic
//     Club" vs "Club Portugalete" => score 10 >= soglia 9 => falsi candidati
//     nella lista "da confermare".

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { installSafeFetchMock } = require("./helpers/mock-safe-fetch.cjs");

const originalCwd = process.cwd();
installSafeFetchMock(originalCwd);

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function setup() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-athletic-seed-"));
  await fs.mkdir(path.join(tempRoot, "data"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, "data", "settings.json"), JSON.stringify({
    version: 1,
    leagues: {
      fp: { listoneCsvUrl: "", standingsCsvUrl: "", disciplineDocUrl: "" },
      pd: { listoneCsvUrl: "https://example.test/pd.csv", standingsCsvUrl: "", disciplineDocUrl: "" }
    }
  }));
  process.chdir(tempRoot);
  process.env.BSD_API_KEY = "test-token";
  return tempRoot;
}

async function teardown(tempRoot) {
  process.chdir(originalCwd);
  delete process.env.BSD_API_KEY;
  delete global.fetch;
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
}

test("generic club tokens do not create false candidate teams", async (t) => {
  const tempRoot = await setup();
  t.after(() => teardown(tempRoot));

  const media = require(path.join(originalCwd, "lib", "player-media.cjs"));
  const directory = {
    "1": { id: 1, name: "Club Portugalete", country: "Spain" },
    "2": { id: 2, name: "Burgos Club de Fútbol", country: "Spain" },
    "3": { id: 3, name: "Club Atlético Antoniano", country: "Spain" },
    "4": { id: 4, name: "Athletic Club", country: "Spain" },
    "5": { id: 5, name: "Real Sociedad", country: "Spain" }
  };

  const candidates = media.providerTeamCandidates("Athletic Bilbao", directory, "Spain");
  const ids = candidates.map((team) => String(team.id));
  assert.ok(ids.includes("4"), `Athletic Club deve restare candidata: ${ids}`);
  assert.ok(!ids.includes("1"), `Club Portugalete non deve entrare: ${ids}`);
  assert.ok(!ids.includes("2"), `Burgos Club de Fútbol non deve entrare: ${ids}`);
  assert.ok(!ids.includes("3"), `Club Atlético Antoniano non deve entrare: ${ids}`);

  const sociedad = media.providerTeamCandidates("Real Sociedad", directory, "Spain");
  assert.ok(sociedad.some((team) => String(team.id) === "5"), "match legittimo conservato");
});

test("seed resolves the real male Athletic Club (51) from the Spain directory", async (t) => {
  const tempRoot = await setup();
  t.after(() => teardown(tempRoot));

  // Il seed 51 (San Mamés) e' nel directory Spagna: la risoluzione per id deve
  // preferirlo al namesake brasiliano (843) o ai giovanili (911/4915).
  global.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/api/teams/");
    assert.equal(url.searchParams.get("country"), "Spain");
    return jsonResponse({
      count: 3,
      next: null,
      results: [
        { id: 843, name: "Athletic Club", country: "Brazil" },
        { id: 911, name: "Athletic Club", country: "Spain" },
        { id: 51, name: "Athletic Club", country: "Spain" }
      ]
    });
  };

  const media = require(path.join(originalCwd, "lib", "player-media.cjs"));
  const catalog = { teams: {}, players: {} };
  const resolved = await media.resolveProviderTeam("pd", "Athletic Bilbao", catalog, []);

  assert.equal(resolved.team.id, "51");
  assert.equal(resolved.team.resolutionSource, "seed");
  assert.equal(resolved.team.name, "Athletic Club");
  assert.equal(resolved.team.country, "Spain");
  assert.equal(catalog.teams["athletic club"].id, "51");
});

test("a persisted neon override with a stale roster is repaired via seed (911 -> 51)", async (t) => {
  const tempRoot = await setup();
  t.after(() => teardown(tempRoot));

  // Directory Spagna con i namesake: il vero Athletic (51, San Mamés) e' l'unico
  // con rosa maschile completa (23+); 911 invece ha una rosa stantia.
  const directory = {
    "911": { id: 911, name: "Athletic Club", country: "Spain" },
    "4915": { id: 4915, name: "Athletic Club B U21", country: "Spain" },
    "51": { id: 51, name: "Athletic Club", country: "Spain" }
  };

  const rosters = {
    "911": [{ id: 91101, name: "Vivian" }, { id: 91102, name: "Stale One" }],
    "4915": [{ id: 491501, name: "Vivian" }, { id: 491502, name: "Stale Two" }],
    "51": [
      { id: 5101, name: "Vivian" },
      ...Array.from({ length: 22 }, (_, i) => ({ id: 5102 + i, name: `Player ${String(i + 1).padStart(2, "0")}` }))
    ],
    "843": [{ id: 84301, name: "Vivian" }, { id: 84302, name: "Stale Brazilian" }]
  };

  // Listone: 23 giocatori -> la rosa intera deve venire dalla squadra 51 (seed),
  // non dall'override persistita 911.
  const assetRows = [
    { displayName: "Vivian" },
    ...Array.from({ length: 22 }, (_, i) => ({ displayName: `Player ${String(i + 1).padStart(2, "0")}` }))
  ];

  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/players/") {
      const roster = rosters[String(url.searchParams.get("team"))] || [];
      return jsonResponse({ count: roster.length, next: null, results: roster });
    }
    assert.equal(url.pathname, "/api/teams/");
    return jsonResponse({ count: Object.keys(directory).length, next: null, results: Object.values(directory) });
  };

  const media = require(path.join(originalCwd, "lib", "player-media.cjs"));
  const catalog = {
    teams: {
      "athletic club": {
        id: "911", name: "Athletic Club", country: "Spain",
        resolutionSource: "neon", playerIds: [], checkedAt: null,
        key: "athletic club", listoneName: "Athletic Club"
      }
    },
    players: {},
    providerTeams: directory
  };

  // Riproduce l'errore produzione "Squadra BSD da confermare per Athletic Club:
  // Athletic Club [911] 1/23; Athletic Club B U21 [4915] 1/23; ...": la override
  // persistita "neon" con rosa stantia entra nel repair path, che deve
  // ri-risolvere via seed (51) e non via overlap (911).
  const result = await media.refreshTeamSquad("pd", "Athletic Club", catalog, assetRows);
  assert.equal(result.id, "51");
  assert.equal(result.resolutionSource, "seed");
  assert.equal(result.playerIds.length, 23);
});

test("pd seeds point at the male senior BSD first teams (no women/youth ids)", async (t) => {
  const seeds = JSON.parse(await fs.readFile(path.join(originalCwd, "data", "bsd-team-seeds.json"), "utf8"));
  const pd = seeds.pd || {};
  assert.equal(pd["athletic club"].id, "51", "Athletic Club Bilbao (San Mamés)");
  assert.equal(pd.alaves.id, "45", "Deportivo Alavés (Mendizorroza)");
  assert.equal(pd["real madrid"].id, "57", "Real Madrid (Bernabéu)");
  assert.equal(pd.valencia.id, "47", "Valencia (Mestalla)");
  // Nessun seed deve puntare a femminili/giovanili/paesi estranei: i quattro bug
  // fissati erano 843 (Athletic brasiliano), 926 (Real Madrid Femenino),
  // 3884 (Alavés Femenino) e 3885 (Valencia Femenino).
  const bad = ["843", "926", "3884", "3885"];
  for (const id of bad) {
    for (const [slug, seed] of Object.entries(pd)) {
      assert.notEqual(String(seed.id), id, `${slug} non deve puntare a ${id}`);
    }
  }
});
