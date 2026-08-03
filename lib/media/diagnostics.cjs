"use strict";

// ---------------------------------------------------------------------------
// Diagnostics: read-only reports over the BSD pipeline.
//
// diagnoseFreshMatching runs a full squad refresh on a fresh catalog and
// reports per-player matching quality; diagnoseProviderTeamSelection compares
// candidate teams per club and recommends the best one. Both hit the live BSD
// API. Depends on lib/media/bsd-provider.cjs, name-matching.cjs and
// manifest-state.cjs.
// ---------------------------------------------------------------------------

const { loadLeagueAssets } = require("../listone.cjs");
const { leagueId } = require("../settings.cjs");
const {
  LEAGUE_CONFIG,
  bsdGet,
  candidatesForAsset,
  chooseCandidate,
  clubKey,
  clubKeysForValue,
  collectBsdPlayers,
  fetchProviderTeamDirectory,
  isoNow,
  playerKey,
  providerTeamCandidates,
  recommendProviderTeam,
  refreshTeamSquad,
  sanitizeCandidate,
  teamCandidateResult
} = require("./bsd-provider.cjs");
const {
  assetBelongsToClub,
  listonePlayers,
  uniqueClubs
} = require("./name-matching.cjs");
const { newCatalog } = require("./manifest-state.cjs");

async function diagnoseFreshMatching(rawLeagueId) {
  const id = leagueId(rawLeagueId);
  const { assets } = await loadLeagueAssets(id);
  const players = listonePlayers(assets);
  const catalog = newCatalog(id);
  const clubs = uniqueClubs(players);
  const failedTeams = {};

  for (const club of clubs) {
    try {
      const clubAssets = players.filter((asset) => assetBelongsToClub(asset, club));
      await refreshTeamSquad(id, club, catalog, clubAssets);
    } catch (error) {
      failedTeams[clubKey(club)] = error.message || "Rosa BSD non disponibile";
    }
  }

  const rows = players.map((asset) => {
    const key = playerKey(asset.displayName, asset.realTeam);
    const failedTeamError = clubKeysForValue(asset.realTeam)
      .map((key) => failedTeams[key])
      .find(Boolean) || "";
    const clubCandidates = candidatesForAsset(catalog, asset);
    const result = failedTeamError
      ? { selected: null, candidates: [] }
      : chooseCandidate(asset, clubCandidates);

    let status = "automatic";
    let reason = "";
    if (failedTeamError) {
      status = "team-error";
      reason = failedTeamError;
    } else if (!clubCandidates.length) {
      status = "no-roster";
      reason = "Nessun giocatore BSD associato al club";
    } else if (!result.selected && result.candidates.length) {
      status = "ambiguous";
      reason = "Candidati presenti ma nessun abbinamento automatico sicuro";
    } else if (!result.selected) {
      status = "no-name-match";
      reason = "Nessun nome BSD compatibile nella rosa del club";
    }

    return {
      key,
      listoneName: asset.displayName,
      docsName: asset.docsName || "",
      realTeam: asset.realTeam,
      status,
      reason,
      selected: result.selected ? sanitizeCandidate(result.selected) : null,
      candidates: (result.candidates || []).slice(0, 5),
      clubCandidateCount: clubCandidates.length
    };
  });

  const counts = rows.reduce((acc, row) => {
    acc[row.status] = Number(acc[row.status] || 0) + 1;
    return acc;
  }, {});

  return {
    version: 1,
    leagueId: id,
    generatedAt: isoNow(),
    totalAssets: (assets || []).length,
    totalPlayers: players.length,
    totalClubs: clubs.length,
    teamsOk: clubs.length - Object.keys(failedTeams).length,
    teamsFailed: Object.keys(failedTeams).length,
    counts: {
      automatic: Number(counts.automatic || 0),
      ambiguous: Number(counts.ambiguous || 0),
      noNameMatch: Number(counts["no-name-match"] || 0),
      noRoster: Number(counts["no-roster"] || 0),
      teamError: Number(counts["team-error"] || 0)
    },
    failedTeams,
    rows
  };
}

function isAnnotatedClubName(value) {
  return String(value || "").includes("/");
}

async function diagnoseProviderTeamSelection(rawLeagueId) {
  const id = leagueId(rawLeagueId);
  const config = LEAGUE_CONFIG[id];
  if (!config) throw new Error("Lega BSD non configurata");

  const { assets } = await loadLeagueAssets(id);
  const players = listonePlayers(assets);
  const regularPlayers = players.filter((asset) => !isAnnotatedClubName(asset.realTeam));
  const annotatedPlayers = players.filter((asset) => isAnnotatedClubName(asset.realTeam));
  const clubs = uniqueClubs(regularPlayers);
  const directory = await fetchProviderTeamDirectory(config.country);
  const rows = [];

  for (const club of clubs) {
    const clubAssets = regularPlayers.filter((asset) => clubKey(asset.realTeam) === clubKey(club));
    const candidates = providerTeamCandidates(club, directory, config.country, 16);
    const candidateResults = [];

    for (const candidate of candidates) {
      try {
        const payload = await bsdGet("/api/players/", { team: candidate.id, limit: 200 });
        const roster = collectBsdPlayers(payload, { ...candidate, key: clubKey(club) });
        candidateResults.push(teamCandidateResult(clubAssets, candidate, roster));
      } catch (error) {
        candidateResults.push({
          id: String(candidate.id),
          name: String(candidate.name || ""),
          country: String(candidate.country || ""),
          nameScore: Number(candidate.nameScore || 0),
          rosterSize: 0,
          automatic: 0,
          ambiguous: 0,
          noNameMatch: clubAssets.length,
          coverage: 0,
          matchedPlayers: [],
          error: String(error?.message || error || "Rosa BSD non disponibile")
        });
      }
    }

    candidateResults.sort((a, b) => b.automatic - a.automatic
      || b.coverage - a.coverage
      || b.nameScore - a.nameScore
      || Number(a.id) - Number(b.id));
    const recommendation = recommendProviderTeam(candidateResults, clubAssets.length);

    rows.push({
      club,
      clubKey: clubKey(club),
      listonePlayers: clubAssets.length,
      status: recommendation.status,
      reason: recommendation.reason,
      recommendedTeamId: recommendation.team?.id || "",
      recommendedTeamName: recommendation.team?.name || "",
      candidates: candidateResults
    });
  }

  const recommendedTeamMap = {};
  rows.forEach((row) => {
    if (row.status === "recommended" && row.recommendedTeamId) {
      recommendedTeamMap[row.clubKey] = {
        id: row.recommendedTeamId,
        name: row.recommendedTeamName,
        listoneName: row.club
      };
    }
  });

  return {
    version: 1,
    leagueId: id,
    country: config.country,
    generatedAt: isoNow(),
    totalPlayers: regularPlayers.length,
    totalClubs: clubs.length,
    annotatedPlayers: annotatedPlayers.map((asset) => ({
      listoneName: asset.displayName,
      docsName: asset.docsName || "",
      realTeam: asset.realTeam
    })),
    counts: {
      recommended: rows.filter((row) => row.status === "recommended").length,
      review: rows.filter((row) => row.status === "review").length,
      unresolved: rows.filter((row) => row.status === "unresolved").length
    },
    recommendedTeamMap,
    rows
  };
}

module.exports = {
  diagnoseFreshMatching,
  diagnoseProviderTeamSelection
};
