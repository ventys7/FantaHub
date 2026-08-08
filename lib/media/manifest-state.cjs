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
  clearRefreshCheckpoint,
  databaseConfigured,
  readManifestCache,
  readPlayerOverrides,
  readRefreshCheckpoint,
  readTeamOverrides,
  upsertPlayerOverride,
  upsertTeamOverrides,
  writeManifestCache,
  writeRefreshCheckpoint
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
const { lookupFace } = require("./face-bridge.cjs");

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
  const fallback = values.filter((entry) => String(entry.fallbackPhotoUrl || "")).length;
  return {
    resolved,
    bsdResolved,
    legacyResolved: Math.max(0, resolved - bsdResolved),
    fallbackResolved: fallback,
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
        checkedAt: entry.checkedAt || null,
        fallbackPhotoUrl: entry.fallbackPhotoUrl || "",
        fallbackSource: entry.fallbackSource || "",
        fallbackCheckedAt: entry.fallbackCheckedAt || null
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

const FACE_BRIDGE_ENABLED = String(process.env.FACE_BRIDGE_ENABLED ?? "1").trim() !== "0";
const FACE_BRIDGE_MAX_LOOKUPS = Math.max(0, Math.min(Number(process.env.FACE_BRIDGE_MAX_LOOKUPS || 60), 300));
const FACE_BRIDGE_RETRY_MS = 6 * 60 * 60 * 1000; // re-attempt delle miss ad ogni TTL del direct state

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

// Estrema ratio per gli unresolved: chiede un ritratto keyless (Wikimedia,
// poi TheSportsDB) senza mai risolvere l'associazione BSD. Riutilizza le foto
// gia' trovate nei build precedenti (persistite nel manifest cache/Neon).
// Con options.deadlineAt > 0 processa in lotti (options.batchSize) e si ferma
// prima della scadenza restituendo { incomplete: true }: la macchina a step
// conserva il progresso nel checkpoint tra una chiamata serverless e l'altra.
async function faceBridgeUnresolved(manifest, previousPlayers, id, options = {}) {
  if (!FACE_BRIDGE_ENABLED || !manifest?.players) return { incomplete: false };
  const nowIso = isoNow();
  const nowMs = Date.now();
  const candidateEntries = [];
  Object.entries(manifest.players).forEach(([key, entry]) => {
    if (isResolvedEntry(entry) || String(entry.photoUrl || "")) return;
    const previous = previousPlayers?.[key] || {};
    if (String(previous.fallbackPhotoUrl || "")) {
      // La foto di fallback del build precedente continua a valere.
      entry.fallbackPhotoUrl = previous.fallbackPhotoUrl;
      entry.fallbackSource = previous.fallbackSource || "";
      entry.fallbackCheckedAt = previous.fallbackCheckedAt || nowIso;
      return;
    }
    const checkedAt = new Date(previous.fallbackCheckedAt || 0).getTime();
    if (Number.isFinite(checkedAt) && nowMs - checkedAt < FACE_BRIDGE_RETRY_MS) return; // miss recente: non riprovare
    candidateEntries.push({ key, entry });
  });
  if (!candidateEntries.length) return { incomplete: false };

  // Il budget evita raffiche lente (e rate-limit) in un singolo step.
  const deadlineAt = Number(options.deadlineAt) || 0;
  const batchSize = Math.max(1, Math.min(Number(options.batchSize) || candidateEntries.length, candidateEntries.length));
  const maxLookups = Math.max(1, FACE_BRIDGE_MAX_LOOKUPS);
  let found = 0;
  let used = 0;
  const incomplete = () => deadlineAt > 0 && Date.now() >= deadlineAt && candidateEntries.length > 0;
  while (candidateEntries.length) {
    const batch = candidateEntries.splice(0, batchSize);
    await mapWithConcurrency(batch, 2, async ({ key, entry }) => {
      try {
        const hit = await lookupFace(entry.listoneName, entry.realTeam || "");
        if (hit?.url) {
          entry.fallbackPhotoUrl = hit.url;
          entry.fallbackSource = hit.source || "";
          found += 1;
        }
        entry.fallbackCheckedAt = nowIso;
      } catch (error) {
        entry.fallbackCheckedAt = nowIso; // errore: riprova ad un prossimo giro
      }
    });
    used += batch.length;
    if (used >= maxLookups || incomplete()) {
      break;
    }
  }
  if (found) {
    manifest.faceBridgeFound = Number(manifest.faceBridgeFound || 0) + found;
  }
  return { incomplete: incomplete(), lookups: used, found };
}

// Costruisce il manifest (identita' esatta della sequenza storicamente
// usata da buildDirectState) e restituisce anche la lista dei giocatori da
// ricercare per nome. La ricerca e il FaceBridge restano fasi separate cosi'
// il refresh a step puo' fermarsi in mezzo senza perdere il lavoro.
async function assembleDirectManifest(id, { catalog, players, playerOverrides, previousPlayers, failedTeams }) {
  const manifest = newManifest(id);
  manifest.players = {};
  manifest.updatedAt = isoNow();
  manifest.refresh = idleRefresh({ completedAt: manifest.updatedAt });

  // La stagione corrente e' risolta per lega (e servita dalle fasi delle rose);
  // viene allegata al manifest quando disponibile, altrimenti il blocco resta assente.
  const season = await resolveProviderSeason(id);
  if (season) {
    manifest.season = { year: season.year, label: season.name, id: season.id, source: season.source };
  }

  if (catalog.bsdDirectoryError) {
    manifest.degraded = true;
    manifest.degradedMessage = catalog.bsdDirectoryError;
  }

  // Fallback "cerca nella lega": (stessa logica storica, spostata qui per
  // condividerla tra refresh one-shot e refresh a step).
  const pendingNameSearches = [];
  players.forEach((asset) => {
    const key = playerKey(asset.displayName, asset.realTeam);
    const override = playerOverrides[key];
    if (override?.id) {
      manifest.players[key] = directResolvedEntry(asset, manualCandidate(asset, override), "manual-neon");
      return;
    }
    if (catalog.bsdDirectoryError) {
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
    if (!failedTeamError && !result.candidates.length) {
      pendingNameSearches.push({ key, asset });
    }
  });
  return { manifest, pendingNameSearches };
}

// Ricerche per nome (endpoint BSD /api/players/?search=) in batches: con
// deadline 0 processa tutto, altrimenti si ferma tra un batch e l'altro.
async function applyNameSearchBatch(id, manifest, pendingNameSearches, batchSize = 3, deadlineAt = 0) {
  let index = 0;
  while (index < pendingNameSearches.length) {
    const batch = pendingNameSearches.slice(index, index + batchSize);
    await mapWithConcurrency(batch, 3, async ({ key, asset }) => {
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
    index += batch.length;
    if (deadlineAt > 0 && Date.now() >= deadlineAt && index < pendingNameSearches.length) break;
  }
  return index;
}

function directStateFromAssembly(id, { manifest, catalog, players, clubs, failedTeams }) {
  let teamIssues = Object.entries(failedTeams).map(([key, error]) => ({
    key,
    teamName: clubs.find((club) => clubKey(club) === key) || key,
    error
  }));
  if (catalog.bsdDirectoryError && !teamIssues.length) {
    teamIssues.push({ key: "bsd-directory", teamName: "Catalogo BSD", error: catalog.bsdDirectoryError });
  }
  return {
    version: DIRECT_STATE_VERSION,
    manifest,
    catalog,
    total: players.length,
    degraded: Boolean(catalog.bsdDirectoryError),
    degradedMessage: catalog.bsdDirectoryError || "",
    teamIssues
  };
}

function assembleStepResponse(id, state, step) {
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
  return {
    id,
    pending: false,
    phase: step.phase,
    state,
    manifest: payload
  };
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

  const { manifest, pendingNameSearches } = await assembleDirectManifest(id, {
    catalog,
    players,
    playerOverrides,
    previousPlayers,
    failedTeams
  });

  await applyNameSearchBatch(id, manifest, pendingNameSearches);

  // FaceBridge: come extrema ratio, per chi e' restato unresolved dopo roster e
  // ricerca per nome, si chiede un ritratto a Wikimedia/TheSportsDB (keyless).
  // Il risultato NON e' una risoluzione BSD: la entry resta unresolved ma porta
  // fallbackPhotoUrl/fallbackSource/fallbackCheckedAt cosi' il client mostra
  // comunque una foto vera. Le miss vengono riconsiderate dopo FACE_BRIDGE_RETRY_MS.
  await faceBridgeUnresolved(manifest, previousPlayers, id);

  assertPublishableManifest(manifest);
  const state = directStateFromAssembly(id, { manifest, catalog, players, clubs, failedTeams });
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

// --- Refresh a step (serverless-safe) ---------------------------------------
//
// Il refresh completo (20 rose BSD, ~50-100 chiamate HTTP, FaceBridge) puo'
// durare minuti: troppo per una funzione Vercel Hobby, che viene tagliata
// intorno ai 60s. refreshDirectStep fraziona la pipeline in fasi
// (teams -> manifest -> search -> faces) salvando il checkpoint in
// runtime_settings (Neon) dopo ogni scadenza di budget. Le chiamate
// successive riprendono da dov'erano rimaste fino a che il risultato finale
// viene persistito come manifest cache e il checkpoint rimosso.
//
// Forma del checkpoint (serializzabile, tenuto fuori dal manifest pubblico):
//   { v: 1, leagueId, phase, budgetMs, startedAt, updatedAt, source: {
//       assets, players, clubs, playerOverrides, teamOverrides,
//       previousPlayers, catalog, failedTeams, loaded
//     }, progress: { clubsLoaded, searchDone } }
// La persistenza Neon e' best-effort: in locale (senza DB) il checkpoint
// vive nella cache di processo e i refresh restano step-safe comunque.

const DEFAULT_STEP_BUDGET_MS = Math.max(1000, Number(process.env.REFRESH_STEP_BUDGET_MS || 45000));
const REFRESH_CHECKPOINT_VERSION = 1;
const refreshStepCache = new Map(); // leagueId -> checkpoint in-memory (fallback senza Neon)

// Qualsiasi "risposta non terminale" usa questa forma, cosi' il client
// (admin-links.js) sa che deve continuare a chiamare continue-sync.
function stepPending(cp) {
  const progress = { phase: cp.phase, done: cp.done, total: cp.total };
  if (cp.phase === "teams") progress.clubsDone = cp.done;
  if (cp.phase === "search") progress.searchDone = cp.done;
  return { id: cp.id, pending: true, phase: cp.phase, progress };
}

function stepSeed(id) {
  return {
    v: REFRESH_CHECKPOINT_VERSION,
    id,
    phase: "teams",
    done: 0,
    total: 0,
    assets: null,
    clubs: [],
    players: [],
    previousPlayers: {},
    catalog: newCatalog(id),
    failedTeams: {},
    playerOverrides: {},
    teamOverrides: {},
    pendingNameSearches: [],
    cursor: 0,
    budgetMs: DEFAULT_STEP_BUDGET_MS,
    updatedAt: null
  };
}

async function stepLoadPrevious(id) {
  // In un refresh a step preferiamo il precedente persistito come base per
  // keepExistingOrUnresolved: le foto fallback gia' trovate non vanno perse
  // solo perche' il contorno e' ancora in corso.
  if (databaseConfigured()) {
    const persisted = await readManifestCache(id);
    if (persisted?.state?.manifest?.players) return clone(persisted.state.manifest.players);
  }
  const local = directStateCache.get(id);
  if (local?.state?.manifest?.players) return clone(local.state.manifest.players);
  return {};
}

async function readStepCheckpoint(id) {
  const local = refreshStepCache.get(id);
  if (local) return clone(local);
  if (!databaseConfigured()) return null;
  const persisted = await readRefreshCheckpoint(id);
  if (persisted?.v === REFRESH_CHECKPOINT_VERSION && persisted.id === id) {
    refreshStepCache.set(id, clone(persisted));
    return clone(persisted);
  }
  return null;
}

async function persistStepCheckpoint(cp) {
  const snapshot = clone(cp);
  snapshot.updatedAt = isoNow();
  refreshStepCache.set(cp.id, clone(snapshot));
  if (databaseConfigured()) {
    try {
      await writeRefreshCheckpoint(cp.id, snapshot);
    } catch (error) {
      // La persistenza e' best-effort: il processo locale continua comunque.
    }
  }
}

async function clearStepCheckpoint(id) {
  refreshStepCache.delete(id);
  if (databaseConfigured()) {
    try {
      await clearRefreshCheckpoint(id);
    } catch (error) {
      // Best-effort: senza Neon il checkpoint e' solo in-memory e sparisce col processo.
    }
  }
}

// Rinnova la directory delle squadre: identico codice di buildDirectState ma
// isolato per essere chiamato una volta sola durante la fase "teams".
async function stepProviderDirectory(cp, id) {
  if (String(cp.catalog.bsdDirectoryError || "") || cp.catalog.providerTeamsUpdatedAt) return cp.catalog.bsdDirectoryError;
  try {
    cp.catalog.providerTeams = await fetchProviderTeamDirectory(LEAGUE_CONFIG[id]?.country);
    cp.catalog.providerTeamsUpdatedAt = isoNow();
    return "";
  } catch (error) {
    cp.catalog.providerTeams = {};
    cp.catalog.bsdDirectoryError = String(error?.message || error || "Catalogo squadre BSD non disponibile");
    return cp.catalog.bsdDirectoryError;
  }
}

async function resumeDirectStep(rawLeagueId, options = {}) {
  const id = leagueId(rawLeagueId);
  const reset = Boolean(options.reset);
  const budgetMs = Math.max(1, Number(options.budgetMs || process.env.REFRESH_STEP_BUDGET_MS || DEFAULT_STEP_BUDGET_MS));
  const startedAt = Date.now();
  const deadline = startedAt + budgetMs;

  // 1. Bozza del checkpoint: nuovo (reset) o ripresa dalla persistenza.
  let cp = reset ? null : await readStepCheckpoint(id);
  if (!cp) {
    cp = stepSeed(id);
    cp.budgetMs = budgetMs;
    cp.previousPlayers = await stepLoadPrevious(id);
  }

  // 2. Le sorgenti si caricano una sola volta (input non presenti se il
  //    checkpoint e' appena stato creato ma non ancora inizializzato).
  if (!cp.assets) {
    const { assets } = await loadLeagueAssets(id);
    cp.assets = clone(assets);
    cp.players = listonePlayers(clone(assets));
    cp.clubs = uniqueClubs(cp.players);
    const [playerOverrides, teamOverrides] = await Promise.all([
      readPlayerOverrides(id),
      readTeamOverrides(id)
    ]);
    cp.playerOverrides = clone(playerOverrides);
    cp.teamOverrides = clone(teamOverrides);
  }
  const clubs = cp.clubs || [];

  // 3. Fase squadre: directory + rose BSD, una squadra alla volta con
  //    controllo budget dopo ognuna. In un colpo completo (budget basso o
  //    poche squadre) si deve arrivare tranquillamente alla fine: facciamo
  //    batch di 5 clubs come il monolite, ma con checkpoint intermedio.
  if (cp.phase === "teams") {
    cp.total = clubs.length;
    await stepProviderDirectory(cp, id);
    let cursor = cp.done;
    if (!cp.catalog.bsdDirectoryError) {
      while (cursor < clubs.length && Date.now() < deadline) {
        const batchEnd = Math.min(clubs.length, cursor + 5);
        const batch = clubs.slice(cursor, batchEnd);
        await mapWithConcurrency(batch, 5, async (club) => {
          try {
            const clubAssets = cp.players.filter((asset) => assetBelongsToClub(asset, club));
            await refreshTeamSquad(id, club, cp.catalog, clubAssets);
          } catch (error) {
            cp.failedTeams[clubKey(club)] = String(error?.message || error || "Rosa BSD non disponibile");
          }
        });
        cursor = batchEnd;
        cp.done = cursor;
        if (cursor < clubs.length) {
          await persistStepCheckpoint(cp); // progresso a meta' via
          return stepPending(cp);
        }
      }
      if (cursor < clubs.length) {
        // Il budget e' scaduto tra una batch e l'altra: si riprende la
        // prossima volta esattamente da qui (cp.done e' il cursore).
        await persistStepCheckpoint(cp);
        return stepPending(cp);
      }
    }
    if (databaseConfigured()) {
      const resolvedTeams = Object.values(cp.catalog.teams || {})
        .filter((team) => /^\d+$/.test(String(team?.id || "")) && !team.error)
        .map((team) => ({ teamKey: team.key, id: team.id, name: team.name }));
      await upsertTeamOverrides(id, resolvedTeams);
    }
    cp.phase = "manifest";
    cp.done = 0;
    cp.cursor = 0;
    await persistStepCheckpoint(cp);
  }

  // 4. Fase manifest: costruzione del manifest (sola lettura: veloce, ma
  //    include la ricerca stagione), poi si passa alla fase di ricerca per
  //    nome, che e' la parte piu' sottoposta a rete e la piu' longeva.
  if (cp.phase === "manifest") {
    const { manifest, pendingNameSearches } = await assembleDirectManifest(id, {
      catalog: cp.catalog,
      players: cp.players,
      playerOverrides: cp.playerOverrides,
      previousPlayers: cp.previousPlayers,
      failedTeams: cp.failedTeams
    });
    cp.manifest = clone(manifest);
    cp.pendingNameSearches = clone(pendingNameSearches);
    cp.total = pendingNameSearches.length;
    cp.phase = "search";
    cp.done = 0;
    cp.cursor = 0;
    await persistStepCheckpoint(cp);
  }

  // 5. Fase search: ricerche per nome in batch di 3 con checkpoint tra un
  //    batch e l'altro.
  if (cp.phase === "search") {
    const pending = cp.pendingNameSearches || [];
    const manifest = cp.manifest;
    while (cp.cursor < pending.length && Date.now() < deadline) {
      const batch = pending.slice(cp.cursor, cp.cursor + 3);
      await mapWithConcurrency(batch, 3, async ({ key, asset }) => {
        const hits = await searchPlayerByName(asset.displayName, LEAGUE_CONFIG[id]?.country || "");
        if (!hits.length) return;
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
      cp.cursor += batch.length;
      cp.done = cp.cursor;
      cp.manifest = clone(manifest); // le associazioni trovate sopravvivono al checkpoint
      await persistStepCheckpoint(cp);
      if (cp.cursor < pending.length) {
        return stepPending(cp);
      }
    }
    if (cp.cursor < pending.length) {
      // Budget scaduto tra una batch e l'altra: si riprende la prossima volta.
      cp.manifest = clone(manifest);
      await persistStepCheckpoint(cp);
      return stepPending(cp);
    }
    cp.phase = "faces";
    cp.done = 0;
    cp.cursor = 0;
    await persistStepCheckpoint(cp);
  }

  // 6. Fase faces: FaceBridge sugli ancora unresolved, con limite lookups a
  //    step. Il cantidate set ricalcolato a ogni rientro e' lo stesso di
  //    buildDirectState (previous fallback, miss recenti, budget), quindi i
  //    risultati sono identici al one-shot, solo piu' lenti in sicurezza.
  if (cp.phase === "faces") {
    if (Date.now() >= deadline) {
      // Il giro e' gia' esaurito: si riprova la prossima volta.
      return stepPending(cp);
    }
    const manifest = cp.manifest;
    await faceBridgeUnresolved(manifest, cp.previousPlayers, id, {
      deadlineAt: deadline,
      batchSize: Math.max(1, FACE_BRIDGE_MAX_LOOKUPS)
    });
    cp.manifest = clone(manifest);
    // Se e' avanzato il budget, il next step la chiarisce; altrimenti finisce qui.
    cp.phase = "finalize";
    await persistStepCheckpoint(cp);
  }

  // 7. Fase finale: assemble from scratch (senza rebuild del manifest) e
  //    persistenza come stato normale (cache diretta + Neon wallet).
  const manifest = cp.manifest;
  assertPublishableManifest(manifest);
  const state = directStateFromAssembly(id, {
    manifest,
    catalog: cp.catalog,
    players: cp.players,
    clubs,
    failedTeams: cp.failedTeams
  });
  const generatedAt = Date.now();
  const expiresAt = generatedAt + DIRECT_CACHE_TTL_MS;
  directStateCache.set(id, { expiresAt, generatedAt, state: clone(state) });
  if (databaseConfigured()) await writeManifestCache(id, state);
  await clearStepCheckpoint(id);
  return assembleStepResponse(id, state, { phase: "done" });
}

async function refreshDirectStep(rawLeagueId, options = {}) {
  return resumeDirectStep(rawLeagueId, options);
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
  refreshDirectStep,
  summary
};
