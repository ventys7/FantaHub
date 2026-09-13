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

test("an unknown promoted club is resolved automatically without Blob persistence", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-promoted-team-"));
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
      fp: { listoneCsvUrl: "https://example.test/fp.csv", standingsCsvUrl: "", disciplineDocUrl: "" },
      pd: { listoneCsvUrl: "", standingsCsvUrl: "", disciplineDocUrl: "" }
    }
  }));
  process.chdir(tempRoot);
  process.env.BSD_API_KEY = "test-token";

  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "example.test") {
      const csv = [
        "Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto",
        "Paolo,P,Mads Hermansen,Leicester City,15,20",
        "Paolo,D,Wout Faes,Leicester City,12,18",
        "Paolo,A,Jamie Vardy,Leicester City,20,25"
      ].join("\n");
      return new Response(csv, { status: 200, headers: { "content-type": "text/csv" } });
    }
    if (url.pathname === "/api/teams/") {
      assert.equal(url.searchParams.get("country"), "England");
      return jsonResponse({
        count: 2,
        next: null,
        results: [
          { id: 901, name: "Leicester City Women", country: "England" },
          { id: 902, name: "Leicester City", country: "England" }
        ]
      });
    }
    if (url.pathname === "/api/players/") {
      const team = url.searchParams.get("team");
      const rosters = {
        "901": [
          { id: 1, full_name: "Janina Leitzig" },
          { id: 2, full_name: "Sophie Howard" }
        ],
        "902": [
          { id: 3, full_name: "Mads Hermansen" },
          { id: 4, full_name: "Wout Faes" },
          { id: 5, full_name: "Jamie Vardy" }
        ]
      };
      return jsonResponse({ count: rosters[team]?.length || 0, results: rosters[team] || [] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const media = require(path.join(originalCwd, "lib", "player-media.cjs"));
  const report = await media.diagnoseFreshMatching("fp");
  assert.equal(report.teamsOk, 1);
  assert.equal(report.counts.automatic, 3);

  const candidates = await media.searchProviderTeams("fp", "Leicester City");
  assert.equal(candidates[0].id, "902");
  assert.equal(candidates[0].automatic, 3);

  await assert.rejects(
    media.linkTeamManual("fp", "Leicester City", "902"),
    /Neon non configurato/
  );
});
