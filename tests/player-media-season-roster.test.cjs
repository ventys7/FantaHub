"use strict";

// Filtro rosa per stagione corrente BSD: una squadra punta all'ultima
// stagione esistente; un giocatore e' attivo solo se il suo ULTIMO trasferimento
// e' un ARRIVO nella squadra. La verifica avvia /api/seasons/ + dettaglio
// /api/players/<id>/ (transfers). Se la stagione non e' risolvibile o il
// dettaglio fallisce, nessun giocatore viene rimosso.
//
// Il mock di global.fetch copre: CSV del Listone (example.test), directory
// squadre BSD (/api/teams/), stagioni (/api/seasons/), rose (/api/players/) e
// dettagli giocatore (/api/players/<id>/). Ogni rotta non prevista e' fail-fast.

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

const SEASON_1058 = { id: 1058, league: 1, name: "Premier League 26/27", year: 2026, start_date: "2026-07-01", end_date: "2027-05-31", is_current: true };
const SEASON_1307 = { id: 1307, league: 3, name: "LaLiga 26/27", year: 2026, start_date: "2026-08-15", end_date: "2027-05-31", is_current: true };

// Stagioni senza is_current per il fallback "max year con start_date <= oggi"
// (oggi: 2026-08-07): la 9903 (2026) ha start futuro e non deve vincere.
const SEASONS_99 = [
  { id: 9901, league: 99, name: "Test 24/25", year: 2024, start_date: "2024-07-01" },
  { id: 9902, league: 99, name: "Test 25/26", year: 2025, start_date: "2025-07-01" },
  { id: 9903, league: 99, name: "Test 26/27", year: 2026, start_date: "2027-07-01" }
];

const DIRECTORY = [
  { id: 5, name: "Test FC", country: "England" },
  { id: 6, name: "Failing FC", country: "England" },
  { id: 7, name: "No Season FC", country: "England" },
  { id: 9, name: "Star FC", country: "England" }
];

const ROSTERS = {
  "5": [
    { id: 101, full_name: "Exit Player" },
    { id: 102, full_name: "Arrive Player" },
    { id: 103, full_name: "No Transfer Player" }
  ],
  "6": [{ id: 105, full_name: "Detail Down Player" }],
  "7": [
    { id: 201, full_name: "Old Exit Player" },
    { id: 202, full_name: "Kept Player" }
  ],
  // Rosa interamente attiva (nessun transfer): 4 asset CSV -> 4/4 match
  // automatici, squadra risolta senza margini. I giocatori fantasma del
  // fallback ("Ghost", "Twin", "Unknown") NON sono in questo roster: per
  // loro la ricerca nel catalogo e' l'unico percorso, senza toccare il
  // team match di Test FC.
  "9": [
    { id: 901, full_name: "Star Anchor A" },
    { id: 902, full_name: "Star Anchor B" },
    { id: 903, full_name: "Star Anchor C" },
    { id: 904, full_name: "Star Anchor D" }
  ]
};

// 101: ultimo trasferimento in uscita -> NON attivo. 102: ultimo arrivo in 5 -> attivo.
// 103: nessun transfer -> attivo. 105: il dettaglio va in errore -> conservato.
// 201: ultimo trasferimento in uscita ma nessuna stagione -> conservato.
const TRANSFERS = {
  "101": [{ transfer_date: "2025-06-30", from_team: { id: 5, name: "Test FC" }, to_team: { id: 999, name: "Elsewhere" } }],
  "102": [{ transfer_date: "2025-06-30", from_team: { id: 9, name: "Other Club" }, to_team: { id: 5, name: "Test FC" } }],
  "103": [],
  "201": [{ transfer_date: "2025-06-30", from_team: { id: 7, name: "No Season FC" }, to_team: { id: 999, name: "Elsewhere" } }]
};

// Per il fallback "cerca per nome nella lega": le risposte di
// /api/players/?search= riportano il campo current_team (squadra + paese
// dell'ultimo club) e vengono filtrate per il country della lega.
const SEARCH_HITS = {
  "ghost player": [
    { id: 501, name: "Ghost Player", short_name: "Ghost", current_team: { id: 9, name: "Star FC", country: "England" } },
    { id: 502, name: "Ghost Player", short_name: "Ghost", current_team: { id: 55, name: "France FC", country: "France" } }
  ],
  "twin player": [
    { id: 601, name: "Twin Player", short_name: "Twin", current_team: { id: 9, name: "Star FC", country: "England" } },
    { id: 602, name: "Twin Player", short_name: "Twin", current_team: { id: 9, name: "Star FC", country: "England" } }
  ]
};

let tempRoot;
let provider;
let media;
let noSeasons = false;
let extraCsvRows = [];
const detailFetches = {};
const seasonRequests = [];

// Righe CSV base per Star FC (4 titolari attivi): la squadra si risolve
// 4/4 senza margini. I giocatori del fallback vengono aggiunti a Questa
// squadra con il candidato NET esposto (mai nella rosa).
const STAR_ROWS = [
  "Paolo,A,Star Anchor A,Star FC,10,10",
  "Paolo,A,Star Anchor B,Star FC,10,10",
  "Paolo,A,Star Anchor C,Star FC,10,10",
  "Paolo,A,Star Anchor D,Star FC,10,10"
];

async function setup() {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-season-roster-"));
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
  noSeasons = false;
  extraCsvRows = [];
  Object.keys(detailFetches).forEach((key) => delete detailFetches[key]);
  seasonRequests.length = 0;

  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "example.test") {
      const csv = [
        "Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto",
        "Paolo,A,Arrive Player,Test FC,10,10",
        "Paolo,A,No Transfer Player,Test FC,10,10",
        ...extraCsvRows
      ].join("\n");
      return new Response(csv, { status: 200, headers: { "content-type": "text/csv" } });
    }
    if (url.pathname === "/api/teams/") {
      assert.equal(url.searchParams.get("country"), "England");
      return jsonResponse({ count: DIRECTORY.length, next: null, results: DIRECTORY });
    }
    if (url.pathname === "/api/seasons/") {
      seasonRequests.push(String(url.searchParams.get("league") || ""));
      if (noSeasons) return jsonResponse({ count: 0, next: null, results: [] });
      const league = String(url.searchParams.get("league") || "");
      const seasons = { "1": [SEASON_1058], "3": [SEASON_1307], "99": SEASONS_99 }[league] || [];
      return jsonResponse({ count: seasons.length, next: null, results: seasons });
    }
    if (url.pathname === "/api/players/" && url.searchParams.has("search")) {
      const query = String(url.searchParams.get("search") || "").toLowerCase();
      const hits = SEARCH_HITS[query] || [];
      return jsonResponse({ count: hits.length, next: null, results: hits });
    }
    if (url.pathname === "/api/players/") {
      const team = url.searchParams.get("team");
      const roster = ROSTERS[String(team)] || [];
      return jsonResponse({ count: roster.length, next: null, results: roster });
    }
    const detail = url.pathname.match(/^\/api\/players\/(\d+)\/$/);
    if (detail) {
      const playerId = detail[1];
      detailFetches[playerId] = Number(detailFetches[playerId] || 0) + 1;
      if (playerId === "105") throw new Error("detail unavailable");
      return jsonResponse({ id: Number(playerId), transfers: TRANSFERS[playerId] || [] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  provider = require(path.join(originalCwd, "lib", "media", "bsd-provider.cjs"));
  media = require(path.join(originalCwd, "lib", "player-media.cjs"));
}

async function teardown() {
  process.chdir(originalCwd);
  delete process.env.BSD_API_KEY;
  delete global.fetch;
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
}

test("stagione corrente BSD: is_current scelta, fallback su max year quando assente", async (t) => {
  await setup();
  t.after(teardown);

  const fp = await provider.resolveProviderSeason("fp");
  assert.deepEqual(fp, { id: "1058", name: "Premier League 26/27", year: 2026, startDate: "2026-07-01", source: "bsd" });

  const pd = await provider.resolveProviderSeason("pd");
  assert.equal(pd.id, "1307", "LaLiga (league 3) risolve la stagione corrente");

  provider.clearSeasonCache();
  const fallback = await provider.resolveProviderSeason("99");
  assert.equal(fallback.id, "9902", "senza is_current si sceglie la stagione con year massimo e start_date <= oggi");
  assert.equal(fallback.year, 2025);

  assert.deepEqual(seasonRequests, ["1", "3", "99"], "England -> league 1, Spain -> league 3");
  assert.equal(await provider.resolveProviderSeason("zz"), null, "league non mappabile -> null");
});

test("playerLatestTransfer/isActiveInTeam: ultimo transfer per data ISO", () => {
  const detail = {
    transfers: [
      { transfer_date: "2021-07-01", from_team: { id: 1 }, to_team: { id: 6 } },
      { transfer_date: "2023-08-15", from_team: { id: 6 }, to_team: { id: 5 } },
      { transfer_date: "2022-01-01", from_team: { id: 5 }, to_team: { id: 7 } }
    ]
  };
  const latest = provider.playerLatestTransfer(detail);
  assert.deepEqual(latest, { toTeamId: "5", fromTeamId: "6", date: "2023-08-15" });
  assert.equal(provider.isActiveInTeam(latest, "5"), true);
  assert.equal(provider.isActiveInTeam(latest, "6"), false);
  assert.equal(provider.playerLatestTransfer({ transfers: [] }), null);
  assert.equal(provider.isActiveInTeam(null, "5"), true, "nessun dato -> attivo");
  const future = provider.playerLatestTransfer({
    transfers: [{ transfer_date: "2027-06-30", from_team: { id: 5 }, to_team: { id: 9 } }]
  });
  assert.equal(provider.isActiveInTeam(future, "5"), false, "transfer futuro-datato e' comunque 'latest'");
});

test("filtro rosa: usciti esclusi, arrivi e no-transfer inclusi", async (t) => {
  await setup();
  t.after(teardown);

  provider.clearSeasonCache();
  provider.clearTransferCache();
  const catalog = { teams: {}, players: {}, providerTeams: {} };
  const team = await media.refreshTeamSquad("fp", "Test FC", catalog, []);

  assert.equal(team.id, "5");
  assert.deepEqual(team.playerIds, ["102", "103"]);
  assert.deepEqual(team.rosterStats, {
    total: 3,
    kept: 2,
    removedNames: ["Exit Player"]
  });
  assert.deepEqual(team.season, { id: "1058", name: "Premier League 26/27", year: 2026, startDate: "2026-07-01", source: "bsd" });
  assert.ok(catalog.players["102"], "arrivo registrato nel catalogo");
  assert.ok(catalog.players["103"], "senza transfers registrato nel catalogo");
  assert.equal(catalog.players["101"], undefined, "uscito escluso dal catalogo");
});

test("la cache dei trasferimenti evita fetch di dettaglio alla seconda chiamata", async (t) => {
  await setup();
  t.after(teardown);

  provider.clearSeasonCache();
  provider.clearTransferCache();
  const first = await media.refreshTeamSquad("fp", "Test FC", { teams: {}, players: {}, providerTeams: {} }, []);
  assert.deepEqual(first.playerIds, ["102", "103"]);
  assert.deepEqual(detailFetches, { "101": 1, "102": 1, "103": 1 });

  const beforeSeasons = seasonRequests.length;
  const second = await media.refreshTeamSquad("fp", "Test FC", { teams: {}, players: {}, providerTeams: {} }, []);
  assert.deepEqual(second.playerIds, ["102", "103"]);
  assert.deepEqual(detailFetches, { "101": 1, "102": 1, "103": 1 }, "nessun fetch di dettaglio aggiuntivo");
  assert.equal(seasonRequests.length, beforeSeasons, "stagione servita dalla cache in-process");
});

test("errore rete sul dettaglio giocatore -> giocatore conservato", async (t) => {
  await setup();
  t.after(teardown);

  provider.clearTransferCache();
  const catalog = { teams: {}, players: {}, providerTeams: {} };
  const team = await media.refreshTeamSquad("fp", "Failing FC", catalog, []);

  assert.equal(team.id, "6");
  assert.deepEqual(team.playerIds, ["105"], "dettaglio in errore non rimuove il giocatore");
  assert.deepEqual(team.rosterStats.removedNames, []);
  assert.equal(Number(detailFetches["105"] || 0), 1);
});

test("publicManifest proietta il blocco season solo se presente", async (t) => {
  await setup();
  t.after(teardown);

  const manifest = {
    version: provider.MANIFEST_VERSION,
    leagueId: "fp",
    provider: "bsd",
    sourceMode: "bsd-direct-images",
    updatedAt: null,
    players: {},
    refresh: { pending: false },
    season: { year: 2026, label: "Premier League 26/27", id: "1058", source: "bsd" }
  };
  const projected = media.publicManifest(manifest);
  assert.deepEqual(projected.season, { year: 2026, label: "Premier League 26/27", id: "1058", source: "bsd" });

  delete manifest.season;
  assert.equal(media.publicManifest(manifest).season, undefined, "senza season nel manifest non si aggiunge nulla");
});

test("buildDirectState attacca la stagione di lega al manifest", async (t) => {
  await setup();
  t.after(teardown);

  provider.clearSeasonCache();
  provider.clearTransferCache();
  const manifest = await media.refreshDirectManifest("fp");
  assert.deepEqual(manifest.season, { year: 2026, label: "Premier League 26/27", id: "1058", source: "bsd" });
  assert.equal(manifest.players["arrive player|test"].status, "resolved");
  assert.equal(manifest.players["no transfer player|test"].status, "resolved");
  assert.equal(Object.keys(manifest.players).length, 2, "il filtro ha lasciato solo i giocatori attivi");
});

test("stagione non risolvibile (0 risultati) -> nessun filtro, rosa completa", async (t) => {
  await setup();
  t.after(teardown);

  provider.clearSeasonCache();
  provider.clearTransferCache();
  noSeasons = true;
  const catalog = { teams: {}, players: {}, providerTeams: {} };
  const team = await media.refreshTeamSquad("fp", "No Season FC", catalog, []);

  assert.equal(team.id, "7");
  assert.deepEqual(team.playerIds, ["201", "202"], "rosa conservata per intero come oggi");
  assert.equal(team.rosterStats, null, "nessuno snapshot senza stagione");
  assert.equal(team.season, null);
  assert.equal(detailFetches["201"] || 0, 0, "nessun fetch di dettaglio senza stagione");
  assert.equal(detailFetches["202"] || 0, 0);
});

test("fallback per nome: il giocatore assente dalla rosa attiva viene risolto cercandolo nella lega", async (t) => {
  await setup();
  t.after(teardown);

  // "Ghost Player" non e' nella rosa di Star FC (ROSTERS["9"] = 901..904):
  // nessun candidato in rosa -> la ricerca BSD nel catalogo lo trova con
  // current_team Test FC (England) -> risolto come 501.
  extraCsvRows = [...STAR_ROWS, "Paolo,A,Ghost Player,Star FC,10,10"];
  provider.clearSeasonCache();
  provider.clearTransferCache();
  const manifest = await media.refreshDirectManifest("fp");
  const entry = manifest.players["ghost player|star"];
  assert.equal(entry.status, "resolved", `status atteso resolved, ottenuto ${entry.status} (${entry.error || ""})`);
  assert.equal(entry.externalId, "501", "match sul candidato England, non sul Francia");
  assert.equal(entry.photoUrl, "https://sports.bzzoiro.com/img/player/501/");
});

test("fallback per nome: il candidau dello stesso country viene preferito, l'estero scartato", async (t) => {
  await setup();
  t.after(teardown);

  // Due hit, il primo England e il secondo France: il secondo non deve mai
  // comparire tra i candidati (entry generata solo con il primo club).
  // Chiamata diretta del fallback di ricerca del provider: il filtro per
  // country deve lasciare solo il candidato England, con id come stringa.
  const direct = await provider.searchPlayerByName("Ghost Player", "England");
  assert.equal(direct.length, 1);
  assert.equal(direct[0].id, "501", "id come stringa, coerente con le entry del manifest");
});

test("fallback per nome: hit multipli con lo stesso match -> da controllare, non auto", async (t) => {
  await setup();
  t.after(teardown);

  // Due giocatori omonimi nella stessa squadra: nessun vincitore, l'entry
  // resta unresolved con i candidati esposti (da sistemare a mano).
  extraCsvRows = [...STAR_ROWS, "Paolo,A,Twin Player,Star FC,10,10"];
  provider.clearSeasonCache();
  provider.clearTransferCache();
  const manifest = await media.refreshDirectManifest("fp");
  const entry = manifest.players["twin player|star"];
  assert.equal(entry.status, "unresolved");
  assert.ok((entry.candidates || []).length >= 2, "candidati esposti per il controllo manuale");
});

test("fallback per nome: nessuna hit -> resta da controllare con l'errore di oggi", async (t) => {
  await setup();
  t.after(teardown);

  extraCsvRows = [...STAR_ROWS, "Paolo,A,Unknown Phantom,Star FC,10,10"];
  provider.clearSeasonCache();
  provider.clearTransferCache();
  const manifest = await media.refreshDirectManifest("fp");
  const entry = manifest.players["unknown phantom|star"];
  // Nome non coperto dalla ricerca: il fallback non deve produrre match.
  assert.equal(entry.status, "unresolved");
  assert.equal(entry.error, "Giocatore non trovato nella rosa BSD");
});
