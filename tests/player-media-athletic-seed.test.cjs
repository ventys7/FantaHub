"use strict";

// Regressione per l'errore produzione "Squadra BSD da confermare per Athletic
// Bilbao". Cause accertate:
//  1. i seed di data/bsd-team-seeds.json puntavano a ID stantii del vecchio
//     catalogo (rosa giovanili/ridotte): athletic club 51 (giovanile, rosa 5)
//     vs 843 (rosa maschile completa, 91 giocatori, ma catalogata da BSD come
//     Brasile -> fuori dal directory Spagna), alaves 45 -> 3884,
//     real madrid 57 -> 926, valencia 47 -> 3885.
//  2. tokenSimilarity dava peso pieno al token generico "club": "Athletic
//     Club" vs "Club Portugalete" => score 10 >= soglia 9 => falsi candidati
//     nella lista "da confermare".

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const originalCwd = process.cwd();

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

test("a seed id outside the country directory still resolves (Athletic 843)", async (t) => {
  const tempRoot = await setup();
  t.after(() => teardown(tempRoot));

  // Il directory Spagna NON contiene il team 843 (BSD lo cataloga in Brasile):
  // la rosa maschile reale deve comunque risolversi via seed per id.
  global.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/api/teams/");
    assert.equal(url.searchParams.get("country"), "Spain");
    return jsonResponse({
      count: 1,
      next: null,
      results: [{ id: 911, name: "Athletic Club", country: "Spain" }]
    });
  };

  const media = require(path.join(originalCwd, "lib", "player-media.cjs"));
  const catalog = { teams: {}, players: {} };
  const resolved = await media.resolveProviderTeam("pd", "Athletic Bilbao", catalog, []);

  assert.equal(resolved.team.id, "843");
  assert.equal(resolved.team.resolutionSource, "seed");
  assert.equal(resolved.team.name, "Athletic Club");
  assert.equal(resolved.team.country, "Spain");
  assert.equal(catalog.teams["athletic club"].id, "843");
});

test("pd seeds point at the full male senior BSD rosters", async (t) => {
  const seeds = JSON.parse(await fs.readFile(path.join(originalCwd, "data", "bsd-team-seeds.json"), "utf8"));
  const pd = seeds.pd || {};
  assert.equal(pd["athletic club"].id, "843", "rosa maschile Athletic (91 giocatori)");
  assert.equal(pd.alaves.id, "3884", "Deportivo Alavés rosa 74");
  assert.equal(pd["real madrid"].id, "926", "Real Madrid rosa 64, 24/24 match");
  assert.equal(pd.valencia.id, "3885", "Valencia rosa 81, 21/23 match");
});
