"use strict";

const { randomUUID } = require("node:crypto");

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
  acquireRefreshCheckpoint,
  clearRefreshCheckpoint,
  databaseConfigured,
  incrementBsdQuota,
  markBsdQuotaRateLimited,
  publishManifestAndClearRefreshCheckpoint,
  readBsdQuota,
  readManifestCache,
  readPlayerOverrides,
  readRefreshCheckpoint,
  readRuntimeSetting,
  renewRefreshCheckpoint,
  releaseRefreshCheckpoint,
  readTeamOverrides,
  upsertPlayerOverrideWithRefreshLease,
  upsertTeamOverridesWithRefreshLease,
  writeRefreshCheckpoint,
  writeRuntimeSetting
} = require("../neon.cjs");
const {
  CATALOG_VERSION,
  FULL_SYNC_DATES,
  LEAGUE_CONFIG,
  MANIFEST_VERSION,
  PROVIDER,
  SOURCE_MODE,
  acknowledgeBsdCaches,
  bsdCircuitOpen,
  bsdGet,
  candidatesForAsset,
  chooseCandidate,
  clubKey,
  clubKeysForValue,
  commitBsdCallCount,
  clone,
  drainBsdCallCount,
  dumpBsdCaches,
  collectBsdPlayers,
  fetchProviderTeamDirectory,
  isCurrentBsdEntry,
  isKnownExternalSourceUrl,
  isResolvedEntry,
  isoNow,
  isQuotaError,
  keepExistingOrUnresolved,
  nextQuotaResetIso,
  playerKey,
  providerImageUrl,
  providerTeamCandidates,
  pruneBsdCacheBlob,
  refreshTeamSquad,
  resolveProviderSeason,
  restoreBsdCaches,
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
const { FACE_BRIDGE_RETRY_MS, lookupFace } = require("./face-bridge.cjs");

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

function boundedEnvInteger(name, fallback, minimum, maximum) {
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.trunc(value)))
    : fallback;
}

function faceBridgeMaxLookups() {
  return boundedEnvInteger("FACE_BRIDGE_MAX_LOOKUPS", 60, 1, 300);
}

const FACE_BRIDGE_ENABLED = String(process.env.FACE_BRIDGE_ENABLED ?? "1").trim() !== "0";

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
  if (!FACE_BRIDGE_ENABLED || !manifest?.players) return { incomplete: false, lookups: 0, found: 0, remaining: 0, processedKeys: [] };
  const now = options.now || Date.now;
  const lookup = options.lookupFace || lookupFace;
  const excludedKeys = new Set(options.excludeKeys || []);
  const nowMs = now();
  const nowIso = new Date(nowMs).toISOString();
  const candidateEntries = [];
  Object.entries(manifest.players).forEach(([key, entry]) => {
    if (excludedKeys.has(key)) return;
    if (isResolvedEntry(entry) || String(entry.photoUrl || "")) return;
    if (String(entry.fallbackPhotoUrl || "")) return;
    const previous = previousPlayers?.[key] || {};
    if (String(previous.fallbackPhotoUrl || "")) {
      // La foto di fallback del build precedente continua a valere.
      entry.fallbackPhotoUrl = previous.fallbackPhotoUrl;
      entry.fallbackSource = previous.fallbackSource || "";
      entry.fallbackCheckedAt = previous.fallbackCheckedAt || nowIso;
      return;
    }
    const checkedAt = new Date(entry.fallbackCheckedAt || previous.fallbackCheckedAt || 0).getTime();
    if (Number.isFinite(checkedAt) && nowMs - checkedAt < FACE_BRIDGE_RETRY_MS) return; // miss recente: non riprovare
    candidateEntries.push({ key, entry });
  });
  if (!candidateEntries.length) return { incomplete: false, lookups: 0, found: 0, remaining: 0, processedKeys: [] };

  // Il budget evita raffiche lente (e rate-limit) in un singolo step.
  const deadlineAt = Number(options.deadlineAt) || 0;
  const batchSize = Math.max(1, Math.min(Number(options.batchSize) || candidateEntries.length, candidateEntries.length));
  const maxLookups = Math.max(0, Number(options.maxLookups ?? faceBridgeMaxLookups()));
  let found = 0;
  let used = 0;
  const processedKeys = [];
  const deadlineExpired = () => deadlineAt > 0 && now() >= deadlineAt;
  while (candidateEntries.length && used < maxLookups && !deadlineExpired()) {
    const batch = candidateEntries.splice(0, Math.min(batchSize, maxLookups - used));
    await mapWithConcurrency(batch, 2, async ({ key, entry }) => {
      try {
        const hit = await lookup(entry.listoneName, entry.realTeam || "");
        if (hit?.url) {
          entry.fallbackPhotoUrl = hit.url;
          entry.fallbackSource = hit.source || "";
          found += 1;
        }
        entry.fallbackCheckedAt = nowIso;
      } catch (error) {
        entry.fallbackCheckedAt = nowIso; // errore: riprova ad un prossimo giro
      } finally {
        processedKeys.push(key);
      }
    });
    used += batch.length;
  }
  if (found) {
    manifest.faceBridgeFound = Number(manifest.faceBridgeFound || 0) + found;
  }
  return { incomplete: candidateEntries.length > 0 || deadlineExpired(), lookups: used, found, remaining: candidateEntries.length, processedKeys };
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

function emptyNeverSyncedState(id) {
  const manifest = newManifest(id);
  manifest.degraded = true;
  manifest.degradedMessage = "Mai sincronizzato: premi «Ricalcola collegamenti» in admin.";
  const state = directStateFromAssembly(id, {
    manifest,
    catalog: newCatalog(id),
    players: [],
    clubs: [],
    failedTeams: {}
  });
  state.degraded = true;
  state.degradedMessage = manifest.degradedMessage;
  return state;
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
  if (fresh && databaseConfigured() && !options.lease) {
    return withRefreshLease(id, options, (lease) => buildDirectState(id, { ...options, lease }));
  }
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
  if (!fresh) {
    // Mai rebuild su semplice lettura: una visita non deve costare centinaia
    // di chiamate per tutti. Si serve l'ultimo stato noto anche se scaduto;
    // senza nulla, degraded vuoto senza toccare la rete (popola solo un
    // refresh esplicito da admin).
    if (databaseConfigured()) {
      try {
        const persisted = await readManifestCache(id);
        if (persisted?.state && validCachedState(persisted.state)) return clone(persisted.state);
      } catch {}
    }
    if (cached && validCachedState(cached.state)) return clone(cached.state);
    return emptyNeverSyncedState(id);
  }
  const freshQuota = await readQuotaRecord();
  if (isQuotaExhaustedRecord(freshQuota)) {
    throw quotaExhaustedError(fallbackQuota(freshQuota));
  }
  await restorePersistedBsdCaches();
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
    if (isQuotaError(error)) throw error;
    catalog.providerTeams = {};
    catalog.bsdDirectoryError = String(error?.message || error || "Catalogo squadre BSD non disponibile");
  }

  if (!catalog.bsdDirectoryError) {
    await mapWithConcurrency(clubs, 5, async (club) => {
      try {
        const clubAssets = players.filter((asset) => assetBelongsToClub(asset, club));
        await refreshTeamSquad(id, club, catalog, clubAssets);
      } catch (error) {
        if (isQuotaError(error) || bsdCircuitOpen()) throw error;
        failedTeams[clubKey(club)] = String(error?.message || error || "Rosa BSD non disponibile");
      }
    });
  }

  if (databaseConfigured()) {
    const resolvedTeams = Object.values(catalog.teams || {})
      .filter((team) => /^\d+$/.test(String(team?.id || "")) && !team.error)
      .map((team) => ({ teamKey: team.key, id: team.id, name: team.name }));
    const updated = await upsertTeamOverridesWithRefreshLease(
      id,
      options.lease?.owner,
      options.lease?.fencingToken,
      resolvedTeams
    );
    if (!updated) throw new Error("Lease refresh non piu' valida");
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
  if (databaseConfigured()) {
    const published = await publishManifestAndClearRefreshCheckpoint(
      id,
      options.lease?.owner,
      options.lease?.fencingToken,
      state
    );
    if (!published) throw new Error("Lease refresh non piu' valida");
  }
  directStateCache.set(id, { expiresAt, generatedAt, state: clone(state) });
  await recordQuotaCalls();
  await persistBsdCaches();
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
  payload.quota = await quotaPayload();
  payload.lastSyncAt = state.manifest?.updatedAt || null;
  if (state.degraded) {
    payload.degraded = true;
    payload.degradedMessage = state.degradedMessage || "";
  }
  return payload;
}

async function refreshDirectManifest(rawLeagueId) {
  const id = leagueId(rawLeagueId);
  try {
    return await directReadManifest(id, { fresh: true });
  } catch (error) {
    const quotaError = await classifyLiveQuotaError(error);
    throw quotaError || error;
  }
}

// --- Refresh a step (serverless-safe) ---------------------------------------
//
// Il refresh completo (20 rose BSD, ~500-700 chiamate HTTP tra directory,
// roster e transfer-detail per giocatore, piu' ricerche per nome e FaceBridge)
// puo' durare minuti: troppo per una funzione Vercel Hobby, che viene tagliata
// intorno ai 60s. refreshDirectStep fraziona la pipeline in fasi
// (teams -> manifest -> search -> faces) salvando il checkpoint nella tabella
// Neon con lease fenced dopo ogni scadenza di budget. Le chiamate
// successive riprendono da dov'erano rimaste fino a che il risultato finale
// viene persistito come manifest cache e il checkpoint rimosso.
//
// Forma del checkpoint (serializzabile, tenuto fuori dal manifest pubblico):
//   { v: 1, leagueId, phase, budgetMs, startedAt, updatedAt, source: {
//       assets, players, clubs, playerOverrides, teamOverrides,
//       previousPlayers, catalog, failedTeams, loaded
//     }, progress: { clubsLoaded, searchDone } }
// Senza DB il checkpoint vive nella cache di processo; con Neon ogni errore
// di persistenza interrompe lo step per non continuare senza fencing.

function refreshStepBudgetMs() {
  return boundedEnvInteger("REFRESH_STEP_BUDGET_MS", 45000, 1, 240000);
}

const DEFAULT_STEP_BUDGET_MS = refreshStepBudgetMs();
const REFRESH_CHECKPOINT_VERSION = 1;

async function withRefreshLease(id, options, work, busyResult) {
  if (!databaseConfigured()) return work(null);
  const owner = randomUUID();
  const requestedBudget = Math.max(1, Number(options.budgetMs || refreshStepBudgetMs()));
  const configuredDuration = Number(options.leaseDurationMs || process.env.REFRESH_LEASE_MS);
  const durationMs = Number.isFinite(configuredDuration) && configuredDuration > 0
    ? Math.max(10, Math.trunc(configuredDuration))
    : Math.max(60000, requestedBudget + 15000);
  const acquired = await acquireRefreshCheckpoint(id, owner, durationMs);
  if (!acquired) {
    if (busyResult !== undefined) return busyResult;
    throw new Error("Aggiornamento media gia' in corso");
  }
  const lease = { ...acquired, owner, durationMs };
  let renewal = Promise.resolve();
  let renewalError = null;
  const timer = setInterval(() => {
    renewal = renewal.then(async () => {
      if (renewalError) return;
      const renewed = await renewRefreshCheckpoint(id, owner, lease.fencingToken, durationMs);
      if (!renewed) throw new Error("Lease refresh non piu' valida");
    }).catch((error) => { renewalError ||= error; });
  }, Math.max(5, Math.floor(durationMs / 2)));
  timer.unref?.();
  try {
    const result = await work(lease);
    await renewal;
    if (renewalError) throw renewalError;
    return result;
  } finally {
    clearInterval(timer);
    await renewal;
    await releaseRefreshCheckpoint(id, owner, lease.fencingToken);
  }
}

// --- Quota BSD globale (condivisa tra dispositivi via Neon) ------------------
//
// Il provider limita le chiamate giornaliere con reset a mezzanotte UTC. Lo
// stato e' unico per chiave API, quindi unico per tutti i client: se un
// dispositivo aggiorna, l'altro trova cache fresca e non ricostruisce.
// Ogni step contabilizza le chiamate BSD effettuate; al primo 429 il circuito
// si apre (vedi bsd-provider) e il giro si interrompe subito, senza retry.
const QUOTA_ATTACH_FRESH_MS = 15 * 60 * 1000;

function quotaLimit() {
  return boundedEnvInteger("BSD_DAILY_QUOTA", 7500, 1, 50000);
}

let localQuotaRecord = null;

async function readQuotaRecord(today = new Date().toISOString().slice(0, 10)) {
  if (databaseConfigured()) return readBsdQuota(today);
  let record = localQuotaRecord;
  if (!record || record.date !== today) {
    record = { date: today, calls: 0, rateLimitedUntil: null };
  }
  return record;
}

function isQuotaExhaustedRecord(record, now = Date.now()) {
  if (record?.rateLimitedUntil && new Date(record.rateLimitedUntil).getTime() > now) return true;
  return Number(record?.calls || 0) >= quotaLimit();
}

// Scarica il contatore del provider nel record condiviso. Ritorna il record.
async function recordQuotaCalls() {
  const today = new Date().toISOString().slice(0, 10);
  if (databaseConfigured()) {
    let record = null;
    const committed = await commitBsdCallCount(async (delta) => {
      record = await incrementBsdQuota(delta, today);
    });
    return committed ? record : readBsdQuota(today);
  }
  const delta = drainBsdCallCount();
  const record = await readQuotaRecord(today);
  if (delta > 0) {
    record.calls = Number(record.calls || 0) + delta;
    localQuotaRecord = clone(record);
  }
  return record;
}

async function noteQuotaExhausted() {
  const today = new Date().toISOString().slice(0, 10);
  const until = nextQuotaResetIso();
  if (databaseConfigured()) return markBsdQuotaRateLimited(until, today);
  const record = await readQuotaRecord(today);
  record.rateLimitedUntil = until;
  localQuotaRecord = clone(record);
  return record;
}

async function quotaPayload() {
  const record = await readQuotaRecord();
  return {
    callsToday: Number(record.calls || 0),
    limit: quotaLimit(),
    exhausted: isQuotaExhaustedRecord(record),
    resetAt: nextQuotaResetIso(),
    rateLimitedUntil: record.rateLimitedUntil || null
  };
}

function quotaExhaustedMessage(quota) {
  const reset = String(quota?.resetAt || nextQuotaResetIso()).slice(11, 16);
  return `Quota BSD esaurita per oggi (${quota?.callsToday ?? "?"} richieste). Si resetta alle ${reset} UTC: i dati restano quelli dell'ultima sincronizzazione riuscita.`;
}

function quotaExhaustedError(quota, error = new Error(quotaExhaustedMessage(quota))) {
  const classified = error instanceof Error ? error : new Error(quotaExhaustedMessage(quota));
  return Object.assign(classified, { quotaExhausted: true, status: 429, quota });
}

function fallbackQuota(value = null) {
  const calls = Number(value?.callsToday ?? value?.calls);
  const limit = Number(value?.limit);
  const resetAt = Date.parse(value?.resetAt || "");
  const rateLimitedUntil = Date.parse(value?.rateLimitedUntil || "");
  return {
    callsToday: Number.isFinite(calls) && calls >= 0 ? Math.trunc(calls) : 0,
    limit: Number.isInteger(limit) && limit > 0 ? limit : quotaLimit(),
    exhausted: true,
    resetAt: Number.isFinite(resetAt) ? new Date(resetAt).toISOString() : nextQuotaResetIso(),
    rateLimitedUntil: Number.isFinite(rateLimitedUntil) ? new Date(rateLimitedUntil).toISOString() : null
  };
}

async function classifyLiveQuotaError(error) {
  if (!isQuotaError(error) && !bsdCircuitOpen()) return null;
  const existingQuota = error?.quota;
  const classified = quotaExhaustedError(existingQuota || fallbackQuota(), error);
  if (existingQuota) return classified;

  let record = null;
  try { record = await recordQuotaCalls(); } catch {}
  try { record = await noteQuotaExhausted() || record; } catch {}
  try { classified.quota = fallbackQuota(await quotaPayload()); } catch { classified.quota = fallbackQuota(record); }
  return classified;
}

const BSD_CACHE_KEY = "bsd-cache";
const BSD_CACHE_WRITE_ATTEMPTS = 4;

let localBsdCacheBlob = null;
let bsdCachePersistenceTail = Promise.resolve();

function mergeBsdCacheDumps(existing, fresh) {
  const out = {};
  const pruned = pruneBsdCacheBlob(existing);
  for (const section of ["transfers", "searches", "seasons"]) {
    const merged = { ...pruned[section] };
    for (const [key, entry] of Object.entries(fresh?.[section] || {})) {
      const prev = merged[key];
      if (!prev || Number(entry?.storedAt || 0) >= Number(prev?.storedAt || 0)) merged[key] = entry;
    }
    out[section] = merged;
  }
  return out;
}

function persistBsdCaches() {
  const persistence = bsdCachePersistenceTail.then(async () => {
    const snapshot = dumpBsdCaches();
    if (!snapshot) return;
    if (databaseConfigured()) {
      try {
        for (let attempt = 0; attempt < BSD_CACHE_WRITE_ATTEMPTS; attempt += 1) {
          const existing = await readRuntimeSetting(BSD_CACHE_KEY);
          const written = await writeRuntimeSetting(
            BSD_CACHE_KEY,
            mergeBsdCacheDumps(existing?.value || null, snapshot.value),
            existing?.version ?? null
          );
          if (!written) continue;
          acknowledgeBsdCaches(snapshot.revision);
          break;
        }
      } catch {}
    } else {
      localBsdCacheBlob = mergeBsdCacheDumps(localBsdCacheBlob, snapshot.value);
      acknowledgeBsdCaches(snapshot.revision);
    }
  });
  bsdCachePersistenceTail = persistence.catch(() => {});
  return persistence;
}

async function restorePersistedBsdCaches() {
  let blob = null;
  if (databaseConfigured()) {
    try { blob = (await readRuntimeSetting(BSD_CACHE_KEY))?.value || null; } catch { blob = null; }
  } else {
    blob = localBsdCacheBlob;
  }
  restoreBsdCaches(blob);
}

async function abortQuotaExhausted(id, cp, lease) {
  if (cp) await persistStepCheckpoint(cp, lease);
  else await recordQuotaCalls();
  await persistBsdCaches();
  await noteQuotaExhausted();
  const quota = await quotaPayload();
  return {
    id,
    pending: false,
    phase: cp?.phase || "teams",
    quotaExhausted: true,
    quota,
    ...(cp?.manifest ? { manifest: publicManifest(cp.manifest) } : {})
  };
}
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

async function readStepCheckpoint(id, lease) {
  if (!databaseConfigured()) return clone(refreshStepCache.get(id) || null);
  const persisted = lease ? lease.checkpoint : await readRefreshCheckpoint(id);
  if (persisted?.v === REFRESH_CHECKPOINT_VERSION && persisted.id === id) {
    return clone(persisted);
  }
  return null;
}

async function persistStepCheckpoint(cp, lease) {
  await recordQuotaCalls();
  const snapshot = clone(cp);
  snapshot.updatedAt = isoNow();
  if (databaseConfigured()) {
    const updated = await writeRefreshCheckpoint(
      cp.id,
      snapshot,
      lease?.owner,
      lease?.fencingToken,
      lease?.durationMs
    );
    if (!updated) throw new Error("Lease refresh non piu' valida");
  } else {
    refreshStepCache.set(cp.id, clone(snapshot));
  }
}

async function clearStepCheckpoint(id, lease) {
  if (databaseConfigured()) {
    const cleared = await clearRefreshCheckpoint(id, lease?.owner, lease?.fencingToken);
    if (!cleared) throw new Error("Lease refresh non piu' valida");
  } else {
    refreshStepCache.delete(id);
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
    if (isQuotaError(error)) throw error;
    cp.catalog.providerTeams = {};
    cp.catalog.bsdDirectoryError = String(error?.message || error || "Catalogo squadre BSD non disponibile");
    return cp.catalog.bsdDirectoryError;
  }
}

async function resumeDirectStep(rawLeagueId, options = {}) {
  const id = leagueId(rawLeagueId);
  const lease = options.lease;
  let reset = Boolean(options.reset);
  const budgetMs = Math.max(1, Number(options.budgetMs || refreshStepBudgetMs()));
  const startedAt = Date.now();
  const deadline = startedAt + budgetMs;

  // 0. Quota globale prima di qualsiasi rete: se esaurita, terminale subito.
  const quotaRecord = await readQuotaRecord();
  if (isQuotaExhaustedRecord(quotaRecord)) {
    return abortQuotaExhausted(id, null, lease);
  }
  await restorePersistedBsdCaches();

  // 1. Bozza del checkpoint: nuovo (reset) o ripresa dalla persistenza.
  //    Se un giro fresco esiste già (magari partito da un altro dispositivo),
  //    ci si aggancia invece di azzerarlo: i continue-sync avanzano lo stesso
  //    checkpoint condiviso.
  if (reset) {
    const existing = await readStepCheckpoint(id, lease);
    if (existing && Date.now() - new Date(existing.updatedAt || 0).getTime() < QUOTA_ATTACH_FRESH_MS) {
      reset = false;
    }
  }
  let cp = reset ? null : await readStepCheckpoint(id, lease);
  if (!cp) {
    cp = stepSeed(id);
    cp.budgetMs = budgetMs;
    cp.previousPlayers = await stepLoadPrevious(id);
  }

  // 2. Le sorgenti si caricano una sola volta (input non presenti se il
  //    checkpoint e' appena stato creato ma non ancora inizializzato).
  //    Qualsiasi errore quota da qui in poi interrompe il giro senza
  //    distruggere il progresso: l'ultimo manifest buono resta servito.
  let clubs = [];
  try {
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
  clubs = cp.clubs || [];

  // 3. Fase squadre: directory + rose BSD, una squadra alla volta con
  //    controllo budget dopo ognuna. In un colpo completo (budget basso o
  //    poche squadre) si deve arrivare tranquillamente alla fine: facciamo
  //    batch di 5 clubs come il monolite, ma con checkpoint intermedio.
  if (cp.phase === "teams") {
    cp.total = clubs.length;
    await stepProviderDirectory(cp, id);
    let cursor = cp.done;
    if (!cp.catalog.bsdDirectoryError) {
      while (cursor < clubs.length && Date.now() < deadline && !bsdCircuitOpen()) {
        const batchEnd = Math.min(clubs.length, cursor + 5);
        const batch = clubs.slice(cursor, batchEnd);
        await mapWithConcurrency(batch, 5, async (club) => {
          try {
            const clubAssets = cp.players.filter((asset) => assetBelongsToClub(asset, club));
            await refreshTeamSquad(id, club, cp.catalog, clubAssets);
          } catch (error) {
            if (isQuotaError(error)) throw error;
            cp.failedTeams[clubKey(club)] = String(error?.message || error || "Rosa BSD non disponibile");
          }
        });
        cursor = batchEnd;
        cp.done = cursor;
        if (bsdCircuitOpen()) {
          return abortQuotaExhausted(id, cp, lease);
        }
        if (cursor < clubs.length) {
          await persistStepCheckpoint(cp, lease); // progresso a meta' via
          return stepPending(cp);
        }
      }
      if (cursor < clubs.length) {
        // Il budget e' scaduto tra una batch e l'altra: si riprende la
        // prossima volta esattamente da qui (cp.done e' il cursore).
        await persistStepCheckpoint(cp, lease);
        return stepPending(cp);
      }
    }
    if (databaseConfigured()) {
      const resolvedTeams = Object.values(cp.catalog.teams || {})
        .filter((team) => /^\d+$/.test(String(team?.id || "")) && !team.error)
        .map((team) => ({ teamKey: team.key, id: team.id, name: team.name }));
      const updated = await upsertTeamOverridesWithRefreshLease(
        id,
        lease?.owner,
        lease?.fencingToken,
        resolvedTeams
      );
      if (!updated) throw new Error("Lease refresh non piu' valida");
    }
    cp.phase = "manifest";
    cp.done = 0;
    cp.cursor = 0;
    await persistStepCheckpoint(cp, lease);
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
    await persistStepCheckpoint(cp, lease);
  }

  // 5. Fase search: ricerche per nome in batch di 3 con checkpoint tra un
  //    batch e l'altro.
  if (cp.phase === "search") {
    const pending = cp.pendingNameSearches || [];
    const manifest = cp.manifest;
    while (cp.cursor < pending.length && Date.now() < deadline && !bsdCircuitOpen()) {
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
      if (bsdCircuitOpen()) {
        return abortQuotaExhausted(id, cp, lease);
      }
      await persistStepCheckpoint(cp, lease);
      if (cp.cursor < pending.length) {
        return stepPending(cp);
      }
    }
    if (cp.cursor < pending.length) {
      // Budget scaduto tra una batch e l'altra: si riprende la prossima volta.
      cp.manifest = clone(manifest);
      await persistStepCheckpoint(cp, lease);
      return stepPending(cp);
    }
    cp.phase = "faces";
    cp.done = 0;
    cp.cursor = 0;
    cp.faceDoneKeys = [];
    await persistStepCheckpoint(cp, lease);
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
    const faces = await faceBridgeUnresolved(manifest, cp.previousPlayers, id, {
      deadlineAt: deadline,
      batchSize: faceBridgeMaxLookups(),
      excludeKeys: cp.faceDoneKeys
    });
    cp.manifest = clone(manifest);
    cp.faceDoneKeys = [...new Set([...(cp.faceDoneKeys || []), ...(faces.processedKeys || [])])];
    cp.done = cp.faceDoneKeys.length;
    cp.total = cp.done + Number(faces.remaining || 0);
    if (faces.incomplete) {
      await persistStepCheckpoint(cp, lease);
      return stepPending(cp);
    }
    cp.phase = "finalize";
    await persistStepCheckpoint(cp, lease);
  }

  } catch (error) {
    if (!isQuotaError(error)) throw error;
    return abortQuotaExhausted(id, cp, lease);
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
  if (databaseConfigured()) {
    const published = await publishManifestAndClearRefreshCheckpoint(id, lease?.owner, lease?.fencingToken, state);
    if (!published) throw new Error("Lease refresh non piu' valida");
  } else {
    await clearStepCheckpoint(id, lease);
  }
  directStateCache.set(id, { expiresAt, generatedAt, state: clone(state) });
  await recordQuotaCalls();
  await persistBsdCaches();
  const done = assembleStepResponse(id, state, { phase: "done" });
  done.quota = await quotaPayload();
  return done;
}

async function refreshDirectStep(rawLeagueId, options = {}) {
  const id = leagueId(rawLeagueId);
  return withRefreshLease(
    id,
    options,
    (lease) => resumeDirectStep(id, lease ? { ...options, lease } : options),
    { pending: true, phase: "busy" }
  );
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
  const searchQuota = await readQuotaRecord();
  if (isQuotaExhaustedRecord(searchQuota)) {
    throw new Error(quotaExhaustedMessage(await quotaPayload()));
  }
  await restorePersistedBsdCaches();
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
  await recordQuotaCalls();
  return results.sort((a, b) => b.automatic - a.automatic || b.coverage - a.coverage || b.nameScore - a.nameScore || Number(a.id) - Number(b.id));
}

async function persistDirectState(id, state, lease) {
  state.version = DIRECT_STATE_VERSION;
  const generatedAt = Date.now();
  const expiresAt = generatedAt + DIRECT_CACHE_TTL_MS;
  if (databaseConfigured()) {
    const published = await publishManifestAndClearRefreshCheckpoint(id, lease?.owner, lease?.fencingToken, state);
    if (!published) throw new Error("Lease refresh non piu' valida");
  }
  directStateCache.set(id, { expiresAt, generatedAt, state: clone(state) });
}

async function directLinkManual(rawLeagueId, key, rawCandidate) {
  const id = leagueId(rawLeagueId);
  if (!databaseConfigured()) throw new Error("Neon non configurato: collegamento non persistibile");
  const candidate = sanitizeCandidate(rawCandidate);
  if (!candidate) throw new Error("Candidato BSD non valido");
  return withRefreshLease(id, {}, async (lease) => {
    const state = await buildDirectState(id);
    const existing = state.manifest.players[String(key || "")];
    if (!existing) throw new Error("Giocatore del Listone non trovato");
    const updated = await upsertPlayerOverrideWithRefreshLease(
      id,
      lease?.owner,
      lease?.fencingToken,
      existing.key,
      candidate.id,
      candidate.name || existing.listoneName
    );
    if (!updated) throw new Error("Lease refresh non piu' valida");
    state.manifest.players[existing.key] = directResolvedEntry({
      displayName: existing.listoneName,
      realTeam: existing.realTeam
    }, {
      ...candidate,
      teamName: candidate.teamName || existing.realTeam,
      teamKey: clubKey(existing.realTeam)
    }, "manual-neon");
    state.manifest.updatedAt = isoNow();
    await persistDirectState(id, state, lease);
    return state.manifest.players[existing.key];
  });
}

async function directLinkTeam(rawLeagueId, rawTeamName, externalId, externalName = "") {
  const id = leagueId(rawLeagueId);
  if (!databaseConfigured()) throw new Error("Neon non configurato: squadra non persistibile");
  const teamId = String(externalId || "").trim();
  if (!/^\d+$/.test(teamId)) throw new Error("ID squadra BSD non valido");
  const teamKey = clubKey(rawTeamName);
  return withRefreshLease(id, {}, async (lease) => {
    const updated = await upsertTeamOverridesWithRefreshLease(
      id,
      lease?.owner,
      lease?.fencingToken,
      [{ teamKey, id: teamId, name: String(externalName || rawTeamName) }]
    );
    if (!updated) throw new Error("Lease refresh non piu' valida");
    const state = await buildDirectState(id, { fresh: true, lease });
    return {
      teamKey,
      id: teamId,
      name: String(externalName || rawTeamName),
      manifest: publicManifest(state.manifest)
    };
  });
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
  faceBridgeUnresolved,
  faceBridgeMaxLookups,
  isFullSyncDate,
  newCatalog,
  newManifest,
  publicManifest,
  quotaLimit,
  refreshDirectManifest,
  refreshDirectStep,
  refreshStepBudgetMs,
  summary
};
