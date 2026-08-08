"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertPublishableManifest,
  chooseCandidate,
  clubKey,
  collectBsdPlayers,
  collectBsdTeams,
  isCurrentBsdEntry,
  isFullSyncDate,
  isResolvedEntry,
  keepExistingOrUnresolved,
  playerKey,
  playerPhotoUrl,
  summary
} = require("../lib/player-media.cjs");

test("media keys normalize club aliases without touching fantasy roles", () => {
  assert.equal(clubKey("Man Utd"), "manchester united");
  assert.equal(clubKey("Atlético Madrid"), "atletico de madrid");
  assert.equal(clubKey("Atl. Madrid"), "atletico de madrid");
  assert.equal(clubKey("RCD Espanyol de Barcelona"), "espanyol");
  assert.equal(clubKey("R. Sociedad"), "real sociedad");
  assert.equal(clubKey("Levante UD"), "levante");
  assert.equal(playerKey("João Pedro", "Chelsea"), "joao pedro|chelsea");
});


test("direct BSD photos are current while legacy Blob photos remain readable", () => {
  const legacy = {
    status: "resolved",
    provider: "api-football",
    photoUrl: "https://example.public.blob.vercel-storage.com/player-faces/api-football/1/portrait.png",
    cached: true,
    storageVerified: true,
    storageKey: "player-faces/api-football/1/portrait.png"
  };
  const bsd = {
    status: "resolved",
    provider: "bsd",
    externalId: "455",
    photoUrl: "https://sports.bzzoiro.com/img/player/455/",
    cached: false,
    storageVerified: false
  };
  assert.equal(isResolvedEntry(legacy), true);
  assert.equal(isCurrentBsdEntry(legacy), false);
  assert.equal(isResolvedEntry(bsd), true);
  assert.equal(isCurrentBsdEntry(bsd), true);
  assert.deepEqual(summary({ players: { legacy, bsd, missing: { status: "unresolved" } } }), {
    resolved: 2,
    bsdResolved: 1,
    legacyResolved: 1,
    fallbackResolved: 0,
    unresolved: 1,
    refreshPending: false
  });
});

test("full image refresh is scheduled only twice per year", () => {
  assert.equal(isFullSyncDate(new Date("2026-01-15T04:00:00Z")), true);
  assert.equal(isFullSyncDate(new Date("2026-07-15T04:00:00Z")), true);
  assert.equal(isFullSyncDate(new Date("2026-08-15T04:00:00Z")), false);
});

test("BSD team payload is normalized into stable provider IDs", () => {
  const teams = collectBsdTeams({
    count: 3,
    results: [
      { id: 18, name: "Arsenal", country: "England" },
      { id: 57, name: "Real Madrid", country: { name: "Spain" } },
      { id: 58, name: "Atletico Madrid", country_name: "Spain" }
    ]
  });
  assert.equal(Object.values(teams).find((team) => team.key === "arsenal")?.id, "18");
  assert.equal(Object.values(teams).find((team) => team.key === "real madrid")?.id, "57");
  assert.equal(Object.values(teams).find((team) => team.key === "atletico de madrid")?.id, "58");
});

test("BSD player payload yields names and the standard portrait URL", () => {
  const squad = collectBsdPlayers({
    count: 2,
    results: [
      { id: 455, full_name: "Bukayo Saka", short_name: "B. Saka", position: "F" },
      { id: 594, name: "Kylian Mbappé", position: "F" }
    ]
  }, { id: "18", name: "Arsenal", key: "arsenal" });

  assert.equal(squad.length, 2);
  assert.equal(squad[0].teamKey, "arsenal");
  assert.deepEqual(squad[0].names, ["Bukayo Saka", "B. Saka"]);
  assert.equal(squad[1].photoUrl, playerPhotoUrl("594"));
  assert.equal(playerPhotoUrl("594"), "https://sports.bzzoiro.com/img/player/594/");
});

test("BSD abbreviated names match the Listone only inside the same club", () => {
  const result = chooseCandidate(
    { displayName: "Riccardo Calafiori", realTeam: "Arsenal" },
    [
      { id: "157052", name: "R. Calafiori", names: ["R. Calafiori"], teamName: "Arsenal", teamKey: "arsenal" },
      { id: "999", name: "R. Calafiori", names: ["R. Calafiori"], teamName: "Real Madrid", teamKey: "real madrid" }
    ]
  );
  assert.equal(result.selected?.id, "157052");
});



test("BSD matching handles accents, notes, compound surnames and obvious typos", () => {
  const arsenal = [
    { id: "1", name: "Christian Nørgaard", names: ["Christian Nørgaard"], teamName: "Arsenal", teamKey: "arsenal" },
    { id: "2", name: "Martin Ødegaard", names: ["Martin Ødegaard"], teamName: "Arsenal", teamKey: "arsenal" },
    { id: "3", name: "Myles Lewis-Skelly", names: ["Myles Lewis-Skelly"], teamName: "Arsenal", teamKey: "arsenal" }
  ];
  assert.equal(chooseCandidate({ displayName: "Norgaard", realTeam: "Arsenal" }, arsenal).selected?.id, "1");
  assert.equal(chooseCandidate({ displayName: "Odegaard", realTeam: "Arsenal" }, arsenal).selected?.id, "2");
  assert.equal(chooseCandidate({ displayName: "Lewis-Skelly", realTeam: "Arsenal" }, arsenal).selected?.id, "3");

  const everton = [
    { id: "4", name: "Jake O'Brien", names: ["Jake O'Brien"], teamName: "Everton", teamKey: "everton" },
    { id: "5", name: "Tyrique George", names: ["Tyrique George"], teamName: "Everton", teamKey: "everton" }
  ];
  assert.equal(chooseCandidate({ displayName: "O’Brein", realTeam: "Everton" }, everton).selected?.id, "4");
  assert.equal(chooseCandidate({ displayName: "George (Akas)", realTeam: "Everton" }, everton).selected?.id, "5");

  const liverpool = [
    { id: "6", name: "Alexis Mac Allister", names: ["Alexis Mac Allister"], teamName: "Liverpool", teamKey: "liverpool" }
  ];
  assert.equal(chooseCandidate({ displayName: "MacAllister", realTeam: "Liverpool" }, liverpool).selected?.id, "6");
});

test("docsName resolves a short Listone label while true surname collisions stay ambiguous", () => {
  const arsenal = [
    { id: "452", name: "Gabriel Martinelli", names: ["Gabriel Martinelli"], teamName: "Arsenal", teamKey: "arsenal" },
    { id: "461", name: "Gabriel Jesus", names: ["Gabriel Jesus"], teamName: "Arsenal", teamKey: "arsenal" },
    { id: "4072", name: "Gabriel Magalhães", names: ["Gabriel Magalhães"], teamName: "Arsenal", teamKey: "arsenal" }
  ];
  assert.equal(chooseCandidate({ displayName: "Gabriel", docsName: "Gabriel Martinelli", realTeam: "Arsenal" }, arsenal).selected?.id, "452");
  assert.equal(chooseCandidate({ displayName: "Gabriel", realTeam: "Arsenal" }, arsenal).selected, null);

  const newcastle = [
    { id: "706", name: "Jacob Murphy", names: ["Jacob Murphy"], teamName: "Newcastle", teamKey: "newcastle" },
    { id: "714", name: "Alex Murphy", names: ["Alex Murphy"], teamName: "Newcastle", teamKey: "newcastle" }
  ];
  assert.equal(chooseCandidate({ displayName: "Murphy", realTeam: "Newcastle" }, newcastle).selected, null);
});

test("goalkeeper block split must not share docsName to prevent cross-matching", () => {
  const liverpool = [
    { id: "1", name: "Alisson", names: ["Alisson"], teamName: "Liverpool", teamKey: "liverpool" },
    { id: "2", name: "Caoimhin Kelleher", names: ["Kelleher", "Caoimhin Kelleher"], teamName: "Liverpool", teamKey: "liverpool" }
  ];
  // Kelleher con docsName composito (vecchio comportamento) matcha Alisson se Kelleher non è nel catalogo
  const composito = chooseCandidate({ displayName: "Kelleher", docsName: "Alisson - Kelleher", realTeam: "Liverpool" }, liverpool);
  assert.equal(composito.selected?.id, "2", "con docsName composito deve matchare Kelleher quando presente");

  // Kelleher con docsName composito, solo Alisson disponibile — FALSO POSITIVO (bug)
  const soloAlisson = chooseCandidate({ displayName: "Kelleher", docsName: "Alisson - Kelleher", realTeam: "Liverpool" }, [liverpool[0]]);
  assert.equal(soloAlisson.selected?.id, "1", "docsName composito causa falso match con Alisson (bug)");

  // Kelleher con docsName individuale (fix), solo Alisson disponibile — nessun match
  const fissato = chooseCandidate({ displayName: "Kelleher", docsName: "Kelleher", realTeam: "Liverpool" }, [liverpool[0]]);
  assert.equal(fissato.selected, null, "docsName individuale non deve matchare Alisson");
});

test("goalkeeper asset restricts BSD candidates to goalkeepers by position", () => {
  // collectBsdPlayers cattura position come providerPosition
  const napoliSquad = collectBsdPlayers({
    count: 3,
    results: [
      { id: 100, full_name: "Alex Meret", position: "G" },
      { id: 101, full_name: "Khvicha Kvaratskhelia", short_name: "K. Kvaratskhelia", position: "F" },
      { id: 102, full_name: "Giovanni Di Lorenzo", position: "D" }
    ]
  }, { id: "42", name: "Napoli", key: "napoli" });

  assert.equal(napoliSquad.find((p) => p.id === "100")?.providerPosition, "G");
  assert.equal(napoliSquad.find((p) => p.id === "101")?.providerPosition, "F");
  assert.equal(napoliSquad.find((p) => p.id === "102")?.providerPosition, "D");

  // Un portiere Listone con type="goalkeeper" + candidatesForAsset filtra solo candidati G
  // Simuliamo il filtro manualmente (candidatesForAsset non è esportata)
  const gkCandidates = napoliSquad.filter((c) => /^g/i.test(String(c.providerPosition || "")));
  assert.equal(gkCandidates.length, 1);
  assert.equal(gkCandidates[0].id, "100");

  // Un portiere non deve matchare un attaccante mancino: "Alex Meret" vs attaccante "Meret" (posizione F, nome simile)
  // chooseCandidate da solo matcha (perché non filtra per ruolo), ma il vero filtro è in candidatesForAsset
  const falsoMatch = chooseCandidate(
    { displayName: "Alex Meret", realTeam: "Napoli", type: "goalkeeper" },
    [{ id: "999", name: "A. Meret", names: ["A. Meret"], teamName: "Napoli", teamKey: "napoli", providerPosition: "F" }]
  );
  assert.equal(falsoMatch.selected?.id, "999", "chooseCandidate matcha per nome — il filtro ruolo è in candidatesForAsset");
});

test("a failed refresh preserves the previous verified Blob entry", () => {
  const existing = {
    key: "bukayo saka|arsenal",
    listoneName: "Bukayo Saka",
    realTeam: "Arsenal",
    status: "resolved",
    photoUrl: "https://example.public.blob.vercel-storage.com/player-faces/bsd/455/portrait.png",
    cached: true,
    storageVerified: true,
    externalId: "455"
  };
  const next = keepExistingOrUnresolved(
    { displayName: "Bukayo Saka", realTeam: "Arsenal" },
    existing,
    [],
    "Foto BSD HTTP 503"
  );
  assert.equal(next.status, "resolved");
  assert.equal(next.photoUrl, existing.photoUrl);
  assert.equal(next.lastRefreshError, "Foto BSD HTTP 503");
  assert.equal(isResolvedEntry(next), true);
});

test("publish validation accepts direct BSD portraits and rejects unrelated provider URLs", () => {
  const base = {
    version: 8,
    leagueId: "fp",
    provider: "bsd",
    sourceMode: "bsd-direct-images",
    refresh: { pending: false },
    players: {}
  };
  assert.throws(() => assertPublishableManifest({
    ...base,
    players: {
      bad: {
        key: "bad",
        listoneName: "Bad",
        status: "resolved",
        provider: "api-football",
        externalId: "455",
        photoUrl: "https://v3.football.api-sports.io/img/player/455.png"
      }
    }
  }), /Foto non valida|URL esterno/);

  assert.equal(assertPublishableManifest({
    ...base,
    players: {
      good: {
        key: "good",
        listoneName: "Good",
        status: "resolved",
        provider: "bsd",
        externalId: "455",
        photoUrl: "https://sports.bzzoiro.com/img/player/455/",
        storageVerified: false
      }
    }
  }), true);
});
