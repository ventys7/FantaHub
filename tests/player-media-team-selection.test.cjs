"use strict";

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

test("team diagnostic chooses the male senior roster by Listone overlap and skips annotated clubs", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-team-selection-"));
  t.after(async () => {
    process.chdir(originalCwd);
    delete process.env.BSD_API_KEY;
    delete global.fetch;
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

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

  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "example.test") {
      const csv = [
        "Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto",
        "Paolo,A,Oyarzabal,Real Sociedad,30,35",
        "Paolo,A,Kubo,Real Sociedad,25,30",
        "Paolo,P,Remiro,Real Sociedad,15,20",
        "Paolo,A,Mbappe,Real Madrid,50,60",
        "Paolo,C,Bellingham,Real Madrid,45,55",
        "Paolo,A,Vinicius,Real Madrid,48,58",
        "Paolo,D,Nota,Sevilla/Getafe,1,1"
      ].join("\n");
      return new Response(csv, { status: 200, headers: { "content-type": "text/csv" } });
    }
    if (url.pathname === "/api/teams/") {
      assert.equal(url.searchParams.get("country"), "Spain");
      return jsonResponse({
        count: 4,
        next: null,
        results: [
          { id: 100, name: "Real Sociedad", country: "Spain" },
          { id: 101, name: "Real Sociedad Women", country: "Spain" },
          { id: 200, name: "Real Madrid Castilla", country: "Spain" },
          { id: 201, name: "Real Madrid", country: "Spain" }
        ]
      });
    }
    if (url.pathname === "/api/players/") {
      const team = url.searchParams.get("team");
      const rosters = {
        "100": [
          { id: 1001, full_name: "Maria Molina" },
          { id: 1002, full_name: "Maren Lezeta" }
        ],
        "101": [
          { id: 1011, full_name: "Mikel Oyarzabal" },
          { id: 1012, full_name: "Takefusa Kubo" },
          { id: 1013, full_name: "Alex Remiro" }
        ],
        "200": [
          { id: 2001, full_name: "Academy One" },
          { id: 2002, full_name: "Academy Two" }
        ],
        "201": [
          { id: 2011, full_name: "Kylian Mbappe" },
          { id: 2012, full_name: "Jude Bellingham" },
          { id: 2013, full_name: "Vinicius Junior" }
        ]
      };
      return jsonResponse({ count: rosters[team]?.length || 0, results: rosters[team] || [] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const media = require(path.join(originalCwd, "lib", "player-media.cjs"));
  const report = await media.diagnoseProviderTeamSelection("pd");

  assert.equal(report.totalClubs, 2);
  assert.equal(report.annotatedPlayers.length, 1);
  assert.equal(report.annotatedPlayers[0].realTeam, "Sevilla/Getafe");
  assert.equal(report.recommendedTeamMap["real sociedad"].id, "101");
  assert.equal(report.recommendedTeamMap["real madrid"].id, "201");
  assert.equal(report.counts.recommended, 2);
});
