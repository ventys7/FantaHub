"use strict";

// ---------------------------------------------------------------------------
// Manifest and direct-state layer.
//
// Builds manifests/catalogs, runs the direct state machine (Neon-first cache,
// in-memory TTL cache, fresh rebuild), persists overrides to Neon, projects
// public manifests and exposes the direct entry points used by the API.
// Depends on lib/media/bsd-provider.cjs and lib/media/name-matching.cjs.
// ---------------------------------------------------------------------------

const { loadLeagueAssets } = require("../listone.cjs");
const { leagueId } = require("../settings.cjs");
const {
  databaseConfigured,
  readManifestCache,
  readPlayerOverrides,
  readTeamOverrides,
  upsertPlayerOverride,
  upsertTeamOverrides,
  writeManifestCache
} = require("../neon.cjs");
const {
  CATALOG_VERSION,
  FULL_SYNC_DATES,
  LEAGUE_CONFIG,
  MANIFEST_VERSION,
  PROVIDER,
  SOURCE_MODE,
  bsdGet,
  candidatesForAsset,
  chooseCandidate,
  clubKey,
  clubKeysForValue,
  clone,
  collectBsdPlayers,
  fetchProviderTeamDirectory,
  isCurrentBsdEntry,
  isKnownExternalSourceUrl,
  isResolvedEntry,
  isoNow,
  keepExistingOrUnresolved,
  playerKey,
  providerImageUrl,
  providerTeamCandidates,
  refreshTeamSquad,
  resolveProviderSeason,
  sanitizeCandidate,
  searchPlayerByName,
  teamCandidateResult
} = require("./bsd-provider.cjs");
const {
  assetBelongsToClub,
  listonePlayers,
  rankedCandidates,
  uniqueClubs
} = require("./name-matching.cjs");

function idleRefresh(extra = {}) {
  return { pending: false, phase: "idle", mode: "", teamCursor: 0, playerCursor: 0, warnings: [], error: "", ...extra };
}

function newManifest(id) {
  return {
    version: MANIFEST_VERSION,
    leagueId: id,
    provider: PROVIDER,
    sourceMode: SOURCE_MODE,
    players: {},
    refresh: idleRefresh(),
    updatedAt: null
  };
}

function newCatalog(id) {
  return {
    version: CATALOG_VERSION,
    leagueId: id,
    provider: PROVIDER,
    teams: {},
    players: {},
    providerTeams: {},
    providerTeamsUpdatedAt: null,
    updatedAt: null
  };
}

function assertPublishableManifest(manifest) {
  if (!manifest || manifest.provider !== PROVIDER || manifest.version !== MANIFEST_VERSION) {
    throw new Error("Manifest BSD non valido");
  }
  for (const entry of Object.values(manifest.players || {})) {
    if (entry.status !== "resolved") continue;
    if (!isResolvedEntry(entry)) throw new Error(`Foto non valida nel manifest: ${entry.listoneName || entry.key}`);
    if (isKnownExternalSourceUrl(entry.photoUrl) && !isCurrentBsdEntry(entry)) {
      throw new Error(`URL esterno non autorizzato nel manifest: ${entry.listoneName || entry.key}`);
    }
  }
  return true;
}

function summary(manifest) {
  const values = Object.values(manifest.players || {});
  const bsdResolved = values.filter(isCurrentBsdEntry).length;
  const resolved = values.filter(isResolvedEntry).length;
  return {
    resolved,
    bsdResolved,
    legacyResolved: Math.max(0, resolved - bsdResolved),
    unresolved: values.filter((entry) => !isResolvedEntry(entry)).length,
    refreshPending: Boolean(manifest.refresh?.pending)
  };
}

function publicManifest(manifest) {
  const players = {};
  Object.entries(manifest.players || {}).forEach(([key, entry]) => {
    if (isResolvedEntry(entry)) {
      players[key] = {
        key,
        listoneName: entry.listoneName,
        realTeam: entry.realTeam,
        photoUrl: entry.photoUrl,
        status: "resolved",
        externalId: entry.externalId,
        externalName: entry.externalName,
        externalTeam: entry.externalTeam,
        provider: entry.provider || "legacy",
        storageKey: entry.storageKey || "",
        matchedBy: entry.matchedBy,
        checkedAt: entry.checkedAt,
        lastRefreshError: entry.lastRefreshError || ""
      };
    } else {
      players[key] = {
        key,
        listoneName: entry.listoneName,
        realTeam: entry.realTeam,
        status: "unresolved",
        candidates: (entry.candidates || []).map(sanitizeCandidate).filter(Boolean),
        error: entry.error || "Foto da sincronizzare",
        checkedAt: entry.checkedAt || null
      };
    }
  });
  const projected = {
    version: MANIFEST_VERSION,
    leagueId: manifest.leagueId,
    provider: PROVIDER,
    sourceMode: SOURCE_MODE,
    updatedAt: manifest.updatedAt,
    players,
    refresh: manifest.refresh || idleRefresh(),
    summary: summary(manifest)
  };
  if (manifest.degraded) {
    projected.degraded = true;
    projected.degradedMessage = manifest.degradedMessage || "";
  }
  if (manifest.season && manifest.season.id != null) {
    projected.season = {
      year: Number(manifest.season.year),
      label: String(manifest.season.label || manifest.season.name || ""),
      id: String(manifest.season.id),
      source: String(manifest.season.source || PROVIDER)
    };
  }
  return projected;
}

// --- Direct state --------------------------------------------------------------------

const DIRECT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DIRECT_STATE_VERSION = 2;
const directStateCache = new Map();

async function mapWithConcurrency(values, concurrency, worker) {
  const queue = [...values];
  const runners = Array.from({ length: Math.max(1, Math.min(Number(concurrency || 1), queue.length || 1)) }, async () => {
    while (queue.length) {
      const value = queue.shift();
      await worker(value);
    }
  });
  await Promise.all(runners);
}

function directResolvedEntry(asset, candidate, matchedBy = "automatic") {
  const clean = sanitizeCandidate(candidate);
  if (!clean) return keepExistingOrUnresolved(asset, null, [], "ID BSD non valido");
  return {
    key: playerKey(asset.displayName, asset.realTeam),
    listoneName: asset.displayName,
    realTeam: asset.realTeam,
    provider: PROVIDER,
    sourceMode: SOURCE_MODE,
    externalId: clean.id,
    externalName: clean.name || asset.displayName,
    externalTeam: clean.teamName || asset.realTeam,
    photoUrl: providerImageUrl(clean.id),
    cached: false,
    storageVerified: false,
    status: "resolved",
    matchedBy,
    checkedAt: isoNow(),
    candidates: [],
    lastRefreshError: ""
  };
}

function cacheExpiresAt(generatedAt) {
  const value = new Date(generatedAt || 0).getTime();
  return Number.isFinite(value) ? value + DIRECT_CACHE_TTL_MS : 0;
}

function validCachedState(value) {
  return Boolean(
    value?.version === DIRECT_STATE_VERSION
    && value?.manifest?.players
    && value?.catalog?.players
    && Array.isArray(value?.teamIssues)
  );
}

function applyTeamOverridesToCatalog(catalog, overrides, id) {
  Object.entries(overrides || {}).forEach(([key, override]) => {
    if (!/^\d+$/.test(String(override?.id || ""))) return;
    catalog.teams[key] = {
      id: String(override.id),
      name: String(override.name || key),
      listoneName: key,
      key,
      country: LEAGUE_CONFIG[id]?.country || "",
      playerIds: [],
      checkedAt: null,
      resolutionSource: "neon",
      resolutionReason: "Associazione persistente Neon",
      error: ""
    };
  });
}

function manualCandidate(asset, override) {
  return {
    id: String(override.id),
    name: String(override.name || asset.displayName),
    names: [String(override.name || asset.displayName)],
    teamName: asset.realTeam,
    teamKey: clubKey(asset.realTeam)
  };
}

async function buildDirectState(rawLeagueId, options = {}) {
  const id = leagueId(rawLeagueId);
  const fresh = Boolean(options.fresh);
  const cached = directStateCache.get(id);

  // Neon is the shared source of truth across serverless instances. Read it before
  // trusting process memory so a manual override saved by another instance is not
  // hidden for six hours by an older local cache.
  let previousPlayers = null;
  if (!fresh && databaseConfigured()) {
    const persisted = await readManifestCache(id);
    const persistedAt = new Date(persisted?.generatedAt || 0).getTime();
    const localAt = Number(cached?.generatedAt || 0);
    if (persisted?.state?.manifest?.players) previousPlayers = clone(persisted.state.manifest.players);
    if (persisted && cacheExpiresAt(persisted.generatedAt) > Date.now() && validCachedState(persisted.state)
        && (!cached || persistedAt >= localAt)) {
      const state = clone(persisted.state);
      directStateCache.set(id, {
        expiresAt: cacheExpiresAt(persisted.generatedAt),
        generatedAt: persistedAt,
        state: clone(state)
      });
      return state;
    }
  }

  if (!fresh && cached && cached.expiresAt > Date.now() && validCachedState(cached.state)) {
    return clone(cached.state);
  }
  if (!previousPlayers && cached?.state?.manifest?.players) {
    previousPlayers = clone(cached.state.manifest.players);
  }
  if (!previousPlayers) previousPlayers = {};

  const { assets } = await loadLeagueAssets(id);
  const players = listonePlayers(assets);
  const catalog = newCatalog(id);
  const clubs = uniqueClubs(players);
  const failedTeams = {};
  const [playerOverrides, teamOverrides] = await Promise.all([
    readPlayerOverrides(id),
    readTeamOverrides(id)
  ]);

  applyTeamOverridesToCatalog(catalog, teamOverrides, id);
  // La directory BSD puo' essere irraggiungibile: non deve far saltare la
  // costruzione dello stato. In down il catalogo resta vuoto e lo stato viene
  // marcato "degraded", riusando le entry risolte del build precedente.
  try {
    catalog.providerTeams = await fetchProviderTeamDirectory(LEAGUE_CONFIG[id]?.country);
    catalog.providerTeamsUpdatedAt = isoNow();
  } catch (error) {
    catalog.providerTeams = {};
    catalog.bsdDirectoryError = String(error?.message || error || "Catalogo squadre BSD non disponibile");
  }

  if (!catalog.bsdDirectoryError) {
    await mapWithConcurrency(clubs, 5, async (club) => {
      try {
        const clubAssets = players.filter((asset) => assetBelongsToClub(asset, club));
        await refreshTeamSquad(id, club, catalog, clubAssets);
      } catch (error) {
        failedTeams[clubKey(club)] = String(error?.message || error || "Rosa BSD non disponibile");
      }
    });
  }

  if (databaseConfigured()) {
    const resolvedTeams = Object.values(catalog.teams || {})
      .filter((team) => /^\d+$/.test(String(team?.id || "")) && !team.error)
      .map((team) => ({ teamKey: team.key, id: team.id, name: team.name }));
    await upsertTeamOverrides(id, resolvedTeams);
  }

  const manifest = newManifest(id);
  manifest.players = {};
  manifest.updatedAt = isoNow();
  manifest.refresh = idleRefresh({ completedAt: manifest.updatedAt });

  // La stagione corrente e' risolta per lega (e servita dalle cache delle rose);
  // viene allegata al manifest quando disponibile, altrimenti il blocco resta assente.
  const season = await resolveProviderSeason(id);
  if (season) {
    manifest.season = { year: season.year, label: season.name, id: season.id, source: season.source };
  }

  if (catalog.bsdDirectoryError) {
    manifest.degraded = true;
    manifest.degradedMessage = catalog.bsdDirectoryError;
  }

  // Fallback "cerca nella lega": quando un giocatore del Listone non e' nella
  // rosa attiva della sua squadra (es. trasferito nel mercato in corso), BSD
  // lo conosce comunque per nome. La ricerca viene filtrata per il country
  // della lega e matchata con le stesse regole dei candidati di rosa; se il
  // primo candidato e' chiaro, l'entry si risolve, altrimenti resta da
  // controllare con i candidati esposti (il taglio manuale resta possibile).
  const pendingNameSearches = [];
  players.forEach((asset) => {
    const key = playerKey(asset.displayName, asset.realTeam);
    const override = playerOverrides[key];
    if (override?.id) {
      manifest.players[key] = directResolvedEntry(asset, manualCandidate(asset, override), "manual-neon");
      return;
    }
    if (catalog.bsdDirectoryError) {
      // In down non c'e' modo di risolvere: chi era risolto ieri conserva la
      // foto; chi non lo era resta unresolved con la reason dell'outage.
      manifest.players[key] = keepExistingOrUnresolved(asset, previousPlayers[key] || null, [], catalog.bsdDirectoryError);
      return;
    }
    const failedTeamError = clubKeysForValue(asset.realTeam).map((value) => failedTeams[value]).find(Boolean) || "";
    const candidates = failedTeamError ? [] : candidatesForAsset(catalog, asset);
    const result = failedTeamError ? { selected: null, candidates: [] } : chooseCandidate(asset, candidates);
    if (result.selected) {
      manifest.players[key] = directResolvedEntry(asset, result.selected);
      return;
    }
    manifest.players[key] = keepExistingOrUnresolved(
      asset,
      null,
      result.candidates,
      failedTeamError || (result.candidates.length ? "Associazione BSD da controllare" : "Giocatore non trovato nella rosa BSD")
    );
    // La ricerca per nome ha senso solo quando non esiste gia' un candidato
    // in rosa da confermare: in quel caso il problema e' la squadra, non il
    // nome, e la ricerca globale non aggiunge informazioni.
    if (!failedTeamError && !result.candidates.length) {
      pendingNameSearches.push({ key, asset });
    }
  });

  await mapWithConcurrency(pendingNameSearches, 6, async ({ key, asset }) => {
    const hits = await searchPlayerByName(asset.displayName, LEAGUE_CONFIG[id]?.country || "");
    if (!hits.length) return; // resta "Giocatore non trovato nella rosa BSD"
    const searchResult = chooseCandidate(asset, hits);
    if (searchResult.selected) {
      manifest.players[key] = directResolvedEntry(asset, searchResult.selected, "automatic-search");
    } else if (searchResult.candidates.length) {
      manifest.players[key] = keepExistingOrUnresolved(
        asset,
        null,
        searchResult.candidates,
        "Associazione BSD da controllare"
      );
    }
  });

  assertPublishableManifest(manifest);
  const teamIssues = Object.entries(failedTeams).map(([key, error]) => ({
    key,
    teamName: clubs.find((club) => clubKey(club) === key) || key,
    error
  }));
  if (catalog.bsdDirectoryError && !teamIssues.length) {
    teamIssues.push({ key: "bsd-directory", teamName: "Catalogo BSD", error: catalog.bsdDirectoryError });
  }
  const state = {
    version: DIRECT_STATE_VERSION,
    manifest,
    catalog,
    total: players.length,
    degraded: Boolean(catalog.bsdDirectoryError),
    degradedMessage: catalog.bsdDirectoryError || "",
    teamIssues
  };
  const generatedAt = Date.now();
  const expiresAt = generatedAt + DIRECT_CACHE_TTL_MS;
  directStateCache.set(id, { expiresAt, generatedAt, state: clone(state) });
  if (databaseConfigured()) await writeManifestCache(id, state);
  return clone(state);
}

async function directReadManifest(rawLeagueId, options = {}) {
  return (await buildDirectState(rawLeagueId, options)).manifest;
}

async function directMediaStatus(rawLeagueId, options = {}) {
  const state = await buildDirectState(rawLeagueId, options);
  const payload = publicManifest(state.manifest);
  payload.total = state.total;
  payload.remaining = Number(payload.summary.unresolved || 0);
  payload.teamIssues = state.teamIssues;
  payload.directImages = true;
  payload.blobWrites = 0;
  payload.persistence = databaseConfigured() ? "neon" : "local";
  if (state.degraded) {
    payload.degraded = true;
    payload.degradedMessage = state.degradedMessage || "";
  }
  return payload;
}

async function refreshDirectManifest(rawLeagueId) {
  const id = leagueId(rawLeagueId);
  directStateCache.delete(id);
  return directReadManifest(id, { fresh: true });
}

async function directSyncMissing(rawLeagueId) {
  const manifest = await refreshDirectManifest(rawLeagueId);
  return {
    manifest,
    total: Object.keys(manifest.players || {}).length,
    processed: Object.keys(manifest.players || {}).length,
    remaining: summary(manifest).unresolved
  };
}

async function directSearchProvider(rawLeagueId, query, teamName = "", options = {}) {
  const state = await buildDirectState(rawLeagueId);
  const all = Object.values(state.catalog.players || {});
  const targetTeam = clubKey(teamName);
  const roster = all.filter((candidate) => String(candidate.teamKey) === targetTeam);
  const sameTeamRanked = rankedCandidates(query, roster, 30);
  const similar = sameTeamRanked.filter((candidate) => Number(candidate.score || 0) >= 40).slice(0, 8);
  const fullRoster = sameTeamRanked.slice(0, 80);
  const database = options.includeDatabase
    ? rankedCandidates(query, all.filter((candidate) => String(candidate.teamKey) !== targetTeam), 0)
        .filter((candidate) => Number(candidate.score || 0) > 0)
        .slice(0, 60)
    : [];
  return { similar, roster: fullRoster, database };
}

async function directSearchProviderTeams(rawLeagueId, rawTeamName) {
  const id = leagueId(rawLeagueId);
  const { assets } = await loadLeagueAssets(id);
  const players = listonePlayers(assets);
  const clubAssets = players.filter((asset) => assetBelongsToClub(asset, rawTeamName));
  if (!clubAssets.length) throw new Error(`Nessun giocatore del Listone associato a ${rawTeamName}`);
  const directory = await fetchProviderTeamDirectory(LEAGUE_CONFIG[id]?.country);
  const candidates = providerTeamCandidates(rawTeamName, directory, LEAGUE_CONFIG[id]?.country, 10);
  const results = await Promise.all(candidates.map(async (candidate) => {
    try {
      const payload = await bsdGet("/api/players/", { team: candidate.id, limit: 200 });
      const roster = collectBsdPlayers(payload, { ...candidate, key: clubKey(rawTeamName) });
      return teamCandidateResult(clubAssets, candidate, roster);
    } catch (error) {
      return {
        id: String(candidate.id), name: String(candidate.name || ""), country: String(candidate.country || ""),
        rosterSize: 0, automatic: 0, ambiguous: 0, noNameMatch: clubAssets.length,
        coverage: 0, nameScore: Number(candidate.nameScore || 0), error: String(error?.message || error || "Rosa BSD non disponibile")
      };
    }
  }));
  return results.sort((a, b) => b.automatic - a.automatic || b.coverage - a.coverage || b.nameScore - a.nameScore || Number(a.id) - Number(b.id));
}

async function persistDirectState(id, state) {
  state.version = DIRECT_STATE_VERSION;
  const generatedAt = Date.now();
  const expiresAt = generatedAt + DIRECT_CACHE_TTL_MS;
  directStateCache.set(id, { expiresAt, generatedAt, state: clone(state) });
  if (databaseConfigured()) await writeManifestCache(id, state);
}

async function directLinkManual(rawLeagueId, key, rawCandidate) {
  const id = leagueId(rawLeagueId);
  if (!databaseConfigured()) throw new Error("Neon non configurato: collegamento non persistibile");
  const candidate = sanitizeCandidate(rawCandidate);
  if (!candidate) throw new Error("Candidato BSD non valido");
  const state = await buildDirectState(id);
  const existing = state.manifest.players[String(key || "")];
  if (!existing) throw new Error("Giocatore del Listone non trovato");
  await upsertPlayerOverride(id, existing.key, candidate.id, candidate.name || existing.listoneName);
  state.manifest.players[existing.key] = directResolvedEntry({
    displayName: existing.listoneName,
    realTeam: existing.realTeam
  }, {
    ...candidate,
    teamName: candidate.teamName || existing.realTeam,
    teamKey: clubKey(existing.realTeam)
  }, "manual-neon");
  state.manifest.updatedAt = isoNow();
  await persistDirectState(id, state);
  return state.manifest.players[existing.key];
}

async function directLinkTeam(rawLeagueId, rawTeamName, externalId, externalName = "") {
  const id = leagueId(rawLeagueId);
  if (!databaseConfigured()) throw new Error("Neon non configurato: squadra non persistibile");
  const teamId = String(externalId || "").trim();
  if (!/^\d+$/.test(teamId)) throw new Error("ID squadra BSD non valido");
  const teamKey = clubKey(rawTeamName);
  await upsertTeamOverrides(id, [{ teamKey, id: teamId, name: String(externalName || rawTeamName) }]);
  directStateCache.delete(id);
  const state = await buildDirectState(id, { fresh: true });
  return {
    teamKey,
    id: teamId,
    name: String(externalName || rawTeamName),
    manifest: publicManifest(state.manifest)
  };
}

function isFullSyncDate(date = new Date()) {
  const monthDay = `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return FULL_SYNC_DATES.has(monthDay);
}

module.exports = {
  assertPublishableManifest,
  buildDirectState,
  directLinkManual,
  directLinkTeam,
  directMediaStatus,
  directReadManifest,
  directSearchProvider,
  directSearchProviderTeams,
  directSyncMissing,
  isFullSyncDate,
  newCatalog,
  newManifest,
  publicManifest,
  refreshDirectManifest,
  summary
};
