"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const originalCwd = process.cwd();
const media = require(path.join(originalCwd, "lib", "player-media.cjs"));

function team(id, name, country = "Spain") {
  return { id: String(id), name, country, key: media.clubKey(name) };
}

test("isNonFirstTeamName flags women's and reserve squads but not first teams", () => {
  const women = ["Real Oviedo Femenino", "Tottenham Hotspur Women", "Levante UD Femenino", "Reading WFC", "FC Barcelona Femení", "Chelsea FCW", "Athletic Club Femenino", "Manchester City Women"];
  women.forEach((name) => assert.equal(media.isNonFirstTeamName(name), true, name));

  const youth = ["Real Madrid Castilla", "Real Madrid B", "Sevilla Atletico", "Barcelona Atletic", "Villarreal B", "Real Oviedo II", "Getafe U19"];
  youth.forEach((name) => assert.equal(media.isNonFirstTeamName(name), true, name));

  const first = ["Real Oviedo", "Athletic Club", "Atletico Madrid", "Real Betis", "West Ham United", "Tottenham Hotspur", "Barcelona", "Real Madrid", "Real Sociedad", "Valencia CF", "Celta Vigo", "Girona"];
  first.forEach((name) => assert.equal(media.isNonFirstTeamName(name), false, name));
});

test("bestProviderTeam never picks a women's team via name-only matching (PD)", () => {
  const directory = {
    "real oviedo femenino|77": team(77, "Real Oviedo Femenino"),
    "levante ud femenino|78": team(78, "Levante UD Femenino")
  };

  const oviedo = media.bestProviderTeam("Real Oviedo", directory, "Spain");
  assert.equal(oviedo, null, "solo la squadra femminile nel catalogo non deve essere scelta");

  const directoryWithMen = {
    ...directory,
    "real oviedo cf|66": team(66, "Real Oviedo CF")
  };
  const withMen = media.bestProviderTeam("Real Oviedo", directoryWithMen, "Spain");
  assert.equal(withMen?.id, "66", "quando esiste la maschile va scelta quella");
});

test("bestProviderTeam never picks a women's team via name-only matching (FP)", () => {
  const directory = {
    "tottenham hotspur women|90": team(90, "Tottenham Hotspur Women", "England"),
    "tottenham hotspur|91": team(91, "Tottenham Hotspur", "England")
  };
  const found = media.bestProviderTeam("Tottenham Hotspur", directory, "England");
  assert.equal(found?.id, "91");

  const onlyWomen = {
    "tottenham hotspur women|90": team(90, "Tottenham Hotspur Women", "England")
  };
  assert.equal(media.bestProviderTeam("Tottenham Hotspur", onlyWomen, "England"), null);
});

test("resolveProviderTeam ignores a stale cached women's team and re-resolves to the men's team", async () => {
  const catalog = {
    providerTeams: {
      "real oviedo cf|66": team(66, "Real Oviedo CF"),
      "real oviedo femenino|77": team(77, "Real Oviedo Femenino")
    },
    teams: {
      "real oviedo": { id: "77", name: "Real Oviedo Femenino", listoneName: "Real Oviedo", key: "real oviedo", playerIds: [], checkedAt: null, error: "" }
    }
  };

  const resolved = await media.resolveProviderTeam("pd", "Real Oviedo", catalog);
  assert.equal(resolved.team.id, "66", "la entry femminile in cache deve essere ri-risolta");
  assert.equal(catalog.teams["real oviedo"].id, "66");
});

test("resolveProviderTeam keeps a cached men's team untouched", async () => {
  const catalog = {
    providerTeams: { "real oviedo cf|66": team(66, "Real Oviedo CF") },
    teams: {
      "real oviedo": { id: "66", name: "Real Oviedo CF", listoneName: "Real Oviedo", key: "real oviedo", playerIds: [], checkedAt: null, error: "" }
    }
  };

  const resolved = await media.resolveProviderTeam("pd", "Real Oviedo", catalog);
  assert.equal(resolved.team.id, "66");
});
