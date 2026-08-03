"use strict";

// ---------------------------------------------------------------------------
// Query and Listone matching helpers.
//
// Thin layer over lib/media/bsd-provider.cjs: search scoring against provider
// candidates, ranked candidate projection, and Listone asset shaping (player
// splitting, club dedup, club membership). No manifest/state logic lives here.
// ---------------------------------------------------------------------------

const {
  clubKey,
  clubKeysForValue,
  clubNamesForValue,
  normalize,
  playerKey,
  sanitizeCandidate
} = require("./bsd-provider.cjs");

function listonePlayers(assets) {
  const players = [];
  (assets || []).forEach((asset) => {
    if (!asset.displayName || !asset.realTeam) return;
    if (asset.type === "goalkeeper_block" || (asset.role === "P" && /\s+-\s+/.test(asset.displayName))) {
      asset.displayName.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean)
        .forEach((name) => players.push({ ...asset, displayName: name, docsName: name, type: "goalkeeper" }));
    } else players.push(asset);
  });
  return [...new Map(players.map((asset) => [playerKey(asset.displayName, asset.realTeam), asset])).values()]
    .sort((a, b) => clubKey(a.realTeam).localeCompare(clubKey(b.realTeam)) || normalize(a.displayName).localeCompare(normalize(b.displayName)));
}

function uniqueClubs(assets) {
  const map = new Map();
  (assets || []).forEach((asset) => {
    clubNamesForValue(asset.realTeam).forEach((name) => {
      if (name && !map.has(clubKey(name))) map.set(clubKey(name), name);
    });
  });
  return [...map.values()].sort((a, b) => clubKey(a).localeCompare(clubKey(b)));
}

function assetBelongsToClub(asset, club) {
  return clubKeysForValue(asset?.realTeam).includes(clubKey(club));
}

function queryScore(query, candidate) {
  const target = normalize(query);
  const combined = normalize(`${candidate.name} ${(candidate.names || []).join(" ")} ${candidate.teamName}`);
  if (!target) return 0;
  if (combined === target) return 100;
  const tokens = target.split(" ").filter(Boolean);
  return tokens.reduce((score, token) => score + (combined.includes(token) ? 12 : 0), 0) + (combined.includes(target) ? 40 : 0);
}

function rankedCandidates(query, candidates, extraScore = 0) {
  return (candidates || [])
    .map((candidate) => ({ candidate, score: queryScore(query, candidate) + extraScore }))
    .sort((a, b) => b.score - a.score || String(a.candidate.name).localeCompare(String(b.candidate.name)))
    .map(({ candidate, score }) => sanitizeCandidate({ ...candidate, score }))
    .filter(Boolean);
}

module.exports = {
  assetBelongsToClub,
  listonePlayers,
  queryScore,
  rankedCandidates,
  uniqueClubs
};
