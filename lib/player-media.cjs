"use strict";

const { loadLeagueAssets } = require("./listone.cjs");
const { leagueId } = require("./settings.cjs");
const {
  databaseConfigured,
  readManifestCache,
  readPlayerOverrides,
  readTeamOverrides,
  upsertPlayerOverride,
  upsertTeamOverrides,
  writeManifestCache
} = require("./neon.cjs");
const TEAM_SEEDS = require("../data/bsd-team-seeds.json");

const FULL_SYNC_DATES = new Set(["01-15", "07-15"]);
const MANIFEST_VERSION = 8;
const CATALOG_VERSION = 9;
const PROVIDER = "bsd";
const SOURCE_MODE = "bsd-direct-images";
const API_BASE_URL = "https://sports.bzzoiro.com";
const LEAGUE_CONFIG = Object.freeze({
  fp: Object.freeze({ country: "England" }),
  pd: Object.freeze({ country: "Spain" })
});

const CLUB_ALIASES = Object.freeze({
  "man utd": "manchester united", "man united": "manchester united", "manchester utd": "manchester united",
  "man city": "manchester city", spurs: "tottenham", "tottenham hotspur": "tottenham",
  wolves: "wolverhampton", "wolverhampton wanderers": "wolverhampton", "brighton hove albion": "brighton",
  "brighton and hove albion": "brighton", "west ham united": "west ham", "newcastle united": "newcastle",
  "nottingham forest": "nottm forest", "notts forest": "nottm forest", "leeds united": "leeds",
  "atletico madrid": "atletico de madrid", "atletico": "atletico de madrid", "atl madrid": "atletico de madrid",
  "at madrid": "atletico de madrid", "club atletico de madrid": "atletico de madrid", "club atletico madrid": "atletico de madrid",
  "atletico de madrid sad": "atletico de madrid", "athletic bilbao": "athletic club", "ath bilbao": "athletic club",
  athletic: "athletic club", "athletic club bilbao": "athletic club", "athletic club de bilbao": "athletic club",
  "real betis balompie": "real betis", betis: "real betis", "betis sevilla": "real betis",
  "rc celta": "celta vigo", "celta de vigo": "celta vigo", "real club celta de vigo": "celta vigo", celta: "celta vigo",
  "deportivo alaves": "alaves", "deportivo alaves sad": "alaves", "rcd espanyol": "espanyol",
  "espanyol de barcelona": "espanyol", "rcd espanyol de barcelona": "espanyol", "real club deportivo espanyol": "espanyol",
  "espanyol barcelona": "espanyol", "rcd mallorca": "mallorca", "real club deportivo mallorca": "mallorca",
  "real mallorca": "mallorca", "ca osasuna": "osasuna", "club atletico osasuna": "osasuna",
  rayo: "rayo vallecano", "r vallecano": "rayo vallecano", "rayo vallecano de madrid": "rayo vallecano",
  "real sociedad de futbol": "real sociedad", "real sociedad san sebastian": "real sociedad", "r sociedad": "real sociedad",
  sociedad: "real sociedad", "sevilla fc": "sevilla", "valencia cf": "valencia", "villarreal cf": "villarreal",
  "girona fc": "girona", "girona futbol club": "girona", "getafe cf": "getafe", "levante ud": "levante",
  "real oviedo cf": "real oviedo", oviedo: "real oviedo", "elche cf": "elche", "ud las palmas": "las palmas",
  "fc barcelona": "barcelona", "futbol club barcelona": "barcelona", "barcelona fc": "barcelona", barca: "barcelona",
  "real madrid cf": "real madrid", "afc bournemouth": "bournemouth", "sunderland afc": "sunderland",
  "burnley fc": "burnley", "crystal palace fc": "crystal palace", "aston villa fc": "aston villa",
  "fulham fc": "fulham", "chelsea fc": "chelsea", "arsenal fc": "arsenal", "liverpool fc": "liverpool"
});

const PROVIDER_SEARCH_NAMES = Object.freeze({
  "manchester united": "Manchester United", "manchester city": "Manchester City", tottenham: "Tottenham Hotspur",
  wolverhampton: "Wolverhampton Wanderers", brighton: "Brighton and Hove Albion", "west ham": "West Ham United",
  newcastle: "Newcastle United", "nottm forest": "Nottingham Forest", leeds: "Leeds United",
  "atletico de madrid": "Atletico Madrid", "athletic club": "Athletic Club", "real betis": "Real Betis",
  "celta vigo": "Celta Vigo", alaves: "Deportivo Alaves", espanyol: "Espanyol", mallorca: "Mallorca",
  osasuna: "Osasuna", "rayo vallecano": "Rayo Vallecano", "real sociedad": "Real Sociedad",
  sevilla: "Sevilla", valencia: "Valencia", villarreal: "Villarreal", girona: "Girona", getafe: "Getafe",
  levante: "Levante", "real oviedo": "Real Oviedo", elche: "Elche", "las palmas": "Las Palmas",
  barcelona: "Barcelona", "real madrid": "Real Madrid"
});

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ł/g, "l")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/ß/g, "ss")
    .replace(/ı/g, "i")
    .replace(/đ/g, "d")
    .replace(/[’']/g, "")
    .replace(/[‐‑‒–—-]/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clubKey(value) {
  const key = normalize(value)
    .replace(/^(?:afc|fc|cf|rcd|rc|ca|ud)\s+/g, "")
    .replace(/\s+(?:afc|fc|cf|rcd|rc|ca|ud|sad|football club)$/g, "")
    .trim();
  return CLUB_ALIASES[key] || key;
}

// Squadre "namesake" del catalogo BSD che non vanno mai associate a una rosa
// maschile del Listone: settori femminili e formazioni giovanili/riserve.
const WOMEN_TEAM_MARKERS = new Set([
  "femenino", "femenina", "femeni", "feminino", "feminina",
  "femminile", "femminili", "women", "woman", "ladies", "female", "wfc", "fcw"
]);

const YOUTH_TEAM_MARKERS = new Set([
  "b", "ii", "iii", "castilla", "juvenil", "juveniles", "juventud", "promesas",
  "reserve", "reserves", "reserva", "reservas", "youth", "academy",
  "u19", "u20", "u21", "u23", "sub19", "sub20", "sub21", "sub23",
  "under19", "under20", "under21", "under23"
]);

function isNonFirstTeamName(value) {
  const tokens = clubKey(value).split(" ").filter(Boolean);
  if (!tokens.length) return false;
  return tokens.some((token, index) => {
    if (WOMEN_TEAM_MARKERS.has(token)) return true;
    // "Sevilla Atletico" e' la riserva; "Atletico Madrid" e' la prima squadra
    if (index > 0 && (token === "atletic" || token === "atletico")) return true;
    return YOUTH_TEAM_MARKERS.has(token);
  });
}

function clubNamesForValue(value) {
  const names = String(value || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return names.length ? names : [String(value || "").trim()].filter(Boolean);
}

function clubKeysForValue(value) {
  return [...new Set(clubNamesForValue(value).map(clubKey).filter(Boolean))];
}

function playerKey(name, team) {
  return `${normalize(name)}|${clubKey(team)}`;
}

function isoNow() { return new Date().toISOString(); }
function clone(value) { return structuredClone(value); }

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

function providerImageUrl(id) {
  const value = String(id || "").trim();
  return /^\d+$/.test(value) ? `${API_BASE_URL}/img/player/${value}/` : "";
}

function isKnownExternalSourceUrl(value) {
  try {
    const host = new URL(String(value || "")).hostname.toLowerCase();
    return host === "sports.bzzoiro.com" || host.endsWith("api-sports.io") || host.includes("fotmob") || host.includes("sofascore");
  } catch { return false; }
}

// Gli URL legacy del Vercel Blob restano leggibili nei manifest esistenti:
// vengono riconosciuti come gia' risolti senza scrivere mai piu' nel Blob.
function isKnownBlobUrl(value) {
  const url = String(value || "").trim();
  if (url.startsWith("/.lineup-runtime/")) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith("blob.vercel-storage.com") || host.includes("vercel-storage.com");
  } catch { return false; }
}

function isDirectBsdUrl(value, externalId = "") {
  const id = String(externalId || "").trim();
  if (!/^\d+$/.test(id)) return false;
  return String(value || "").trim() === providerImageUrl(id);
}

function isResolvedEntry(entry) {
  if (!entry || entry.status !== "resolved" || !entry.photoUrl) return false;
  if (entry.provider === PROVIDER && isDirectBsdUrl(entry.photoUrl, entry.externalId)) return true;
  if (isKnownExternalSourceUrl(entry.photoUrl)) return false;
  return entry.storageVerified === true || (entry.cached === true && isKnownBlobUrl(entry.photoUrl));
}

function isCurrentBsdEntry(entry) {
  return Boolean(entry?.provider === PROVIDER && isResolvedEntry(entry) && isDirectBsdUrl(entry.photoUrl, entry.externalId));
}

function sanitizeCandidate(candidate) {
  if (!candidate) return null;
  const id = String(candidate.id || candidate.externalId || "").trim();
  if (!/^\d+$/.test(id)) return null;
  return {
    id,
    name: String(candidate.name || candidate.externalName || "").trim(),
    names: [...new Set((candidate.names || []).map(String).map((name) => name.trim()).filter(Boolean))],
    teamName: String(candidate.teamName || candidate.externalTeam || "").trim(),
    teamId: String(candidate.teamId || "").trim(),
    teamKey: String(candidate.teamKey || clubKey(candidate.teamName || candidate.externalTeam)).trim(),
    score: Number(candidate.score || 0)
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

function bsdApiKey() {
  const value = String(process.env.BSD_API_KEY || "").trim();
  if (!value) throw new Error("BSD_API_KEY non configurata");
  return value;
}

function retryableBsdError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || error || "").toLowerCase();
  return error?.name === "AbortError"
    || status === 429
    || status >= 500
    || /aborted|timeout|fetch failed|econnreset|etimedout|socket|network/.test(message);
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bsdGet(pathname, params = {}, timeoutMs = 25000, maxAttempts = 3) {
  const url = new URL(pathname, API_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") url.searchParams.set(key, String(value));
  });

  let lastError = null;
  const attempts = Math.max(1, Number(maxAttempts || 1));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Token ${bsdApiKey()}`,
          "User-Agent": "Lineup-Fanta/2.0"
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = String(payload?.detail || payload?.message || "").trim();
        const error = new Error(`BSD HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error?.name === "AbortError"
        ? Object.assign(new Error(`BSD timeout dopo ${timeoutMs} ms`), { name: "AbortError" })
        : error;
      if (attempt >= attempts || !retryableBsdError(lastError)) throw lastError;
      // Exponential backoff: 500ms, 2s, 4.5s — gives rate-limited servers time to recover
      const backoffMs = Math.min(500 * attempt * attempt, 10000);
      await pause(backoffMs);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("Richiesta BSD non riuscita");
}

function payloadItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["results", "players", "teams", "data"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function nestedValue(value, keys) {
  for (const key of keys) {
    const candidate = value?.[key];
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) return candidate;
  }
  return "";
}

function countryName(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return String(value.name || value.code || "");
  return "";
}

function collectBsdTeams(payload) {
  const teams = {};
  payloadItems(payload).forEach((item) => {
    const team = item?.team && typeof item.team === "object" ? { ...item, ...item.team } : item;
    const id = String(nestedValue(team, ["id", "team_id", "teamId"])).trim();
    const name = String(nestedValue(team, ["name", "full_name", "fullName", "team_name", "teamName"])).trim();
    if (!/^\d+$/.test(id) || !name) return;
    const key = clubKey(name);
    teams[`${key}|${id}`] = {
      id,
      name,
      key,
      country: countryName(team.country || team.country_name || team.countryName)
    };
  });
  return teams;
}

function collectBsdPlayers(payload, team) {
  return payloadItems(payload).map((item) => {
    const nested = item?.player && typeof item.player === "object" ? item.player : {};
    const player = { ...item, ...nested };
    const id = String(nestedValue(player, ["id", "player_id", "playerId"])).trim();
    if (!/^\d+$/.test(id)) return null;
    const firstName = String(nestedValue(player, ["first_name", "firstName"])).trim();
    const lastName = String(nestedValue(player, ["last_name", "lastName"])).trim();
    const names = [...new Set([
      nestedValue(player, ["full_name", "fullName"]),
      nestedValue(player, ["name", "player_name", "playerName"]),
      nestedValue(player, ["short_name", "shortName", "common_name", "commonName"]),
      `${firstName} ${lastName}`.trim()
    ].map(String).map((name) => name.trim()).filter(Boolean))];
    const name = names[0] || `player-${id}`;
    const itemTeam = player.team && typeof player.team === "object" ? player.team : {};
    const teamName = String(team?.name || nestedValue(itemTeam, ["name", "full_name", "fullName"]) || nestedValue(player, ["team_name", "teamName"])).trim();
    const teamId = String(team?.id || nestedValue(itemTeam, ["id", "team_id", "teamId"]) || nestedValue(player, ["team_id", "teamId"])).trim();
    return {
      id,
      name,
      names,
      teamName,
      teamId,
      teamKey: String(team?.key || clubKey(teamName)),
      providerPosition: String(nestedValue(player, ["position", "position_name", "positionName"])),
      photoUrl: providerImageUrl(id)
    };
  }).filter(Boolean);
}

// Token generici che non identificano un club: condividere "Club"/"Futbol" non
// rende un candidato simile (es. "Athletic Club" vs "Club Portugalete").
const GENERIC_CLUB_TOKENS = new Set(["real", "club", "futbol", "football", "calcio"]);

function tokenSimilarity(first, second) {
  const left = new Set(clubKey(first).split(" ").filter((token) => token.length > 2 && !GENERIC_CLUB_TOKENS.has(token)));
  const right = new Set(clubKey(second).split(" ").filter((token) => token.length > 2 && !GENERIC_CLUB_TOKENS.has(token)));
  if (!left.size || !right.size) return 0;
  const common = [...left].filter((token) => right.has(token)).length;
  return common * 10 - Math.abs(left.size - right.size);
}

function providerTeamNameScore(targetName, team) {
  const target = clubKey(targetName);
  const preferred = clubKey(PROVIDER_SEARCH_NAMES[target] || targetName);
  const candidate = clubKey(team?.name || team?.key);
  if (!target || !candidate) return 0;

  let score = tokenSimilarity(target, candidate);
  if (candidate === target || candidate === preferred) score = 100;
  else if (candidate.startsWith(`${target} `) || candidate.startsWith(`${preferred} `)) score = Math.max(score, 82);
  else if (candidate.includes(target) || target.includes(candidate) || candidate.includes(preferred)) score = Math.max(score, 70);
  return score;
}

function providerTeamCandidates(targetName, map, country = "", limit = 12) {
  return Object.values(map || {})
    .filter((team) => !country || !team.country || normalize(team.country) === normalize(country))
    .map((team) => ({ ...team, nameScore: providerTeamNameScore(targetName, team) }))
    .filter((team) => team.nameScore >= 9)
    .sort((a, b) => b.nameScore - a.nameScore || String(a.name).localeCompare(String(b.name)) || Number(a.id) - Number(b.id))
    .slice(0, Math.max(1, Number(limit || 12)));
}

function bestProviderTeam(targetName, map, country = "") {
  // Il catalogo puo' contenere squadre femminili/giovanili con lo stesso nome:
  // non vanno mai scelte per una rosa maschile del Listone. Il filtro vale solo
  // nel percorso solo-nome (il percorso per-overlap disambigua sulle rose).
  const targetKey = clubKey(targetName);
  const filterNonFirstTeams = !isNonFirstTeamName(targetKey);
  const candidates = providerTeamCandidates(targetName, map, country, 12)
    .filter((team) => !filterNonFirstTeams || !isNonFirstTeamName(team.name));
  return candidates[0] || null;
}

function payloadTotal(payload) {
  const value = Number(payload?.count);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function fetchProviderTeamDirectory(country) {
  const requestedCountry = String(country || "").trim();
  if (!requestedCountry) throw new Error("Paese BSD non configurato per il catalogo squadre");

  const directory = {};
  const seenPages = new Set();
  let nextUrl = new URL("/api/teams/", API_BASE_URL);
  nextUrl.searchParams.set("country", requestedCountry);
  let expectedTotal = null;
  let pageCount = 0;

  while (nextUrl) {
    if (nextUrl.origin !== new URL(API_BASE_URL).origin) {
      throw new Error("BSD ha restituito una pagina squadre su un dominio inatteso");
    }
    const pageKey = nextUrl.toString();
    if (seenPages.has(pageKey)) throw new Error("Paginazione squadre BSD in ciclo");
    seenPages.add(pageKey);

    const payload = await bsdGet(pageKey);
    const items = payloadItems(payload);
    if (!items.length && pageCount === 0) throw new Error(`BSD non ha restituito squadre per ${requestedCountry}`);
    Object.assign(directory, collectBsdTeams(payload));
    if (expectedTotal === null) expectedTotal = payloadTotal(payload);

    const rawNext = String(payload?.next || "").trim();
    if (rawNext) {
      const candidate = new URL(rawNext, API_BASE_URL);
      if (!candidate.searchParams.get("country")) candidate.searchParams.set("country", requestedCountry);
      nextUrl = candidate;
    } else nextUrl = null;
    pageCount += 1;
    if (pageCount > 50) throw new Error("Troppe pagine nel catalogo squadre BSD");
  }

  const teams = Object.values(directory);
  if (!teams.length) throw new Error(`Catalogo squadre BSD vuoto per ${requestedCountry}`);
  const countryTeams = teams.filter((team) => !team.country || normalize(team.country) === normalize(requestedCountry));
  if (!countryTeams.length) throw new Error(`Catalogo BSD senza squadre del paese ${requestedCountry}`);
  if (expectedTotal !== null && teams.length < expectedTotal) {
    throw new Error(`Catalogo squadre BSD incompleto per ${requestedCountry}: ${teams.length}/${expectedTotal}`);
  }
  return directory;
}

async function ensureProviderTeamDirectory(id, catalog) {
  if (Object.keys(catalog.providerTeams || {}).length) return catalog.providerTeams;
  const country = LEAGUE_CONFIG[id]?.country;
  catalog.providerTeams = await fetchProviderTeamDirectory(country);
  catalog.providerTeamsUpdatedAt = isoNow();
  return catalog.providerTeams;
}

function seededProviderTeam(id, rawTeamName, directory) {
  const key = clubKey(rawTeamName);
  const seed = TEAM_SEEDS?.[id]?.[key];
  if (!seed?.id) return null;
  const found = Object.values(directory || {}).find((team) => String(team.id) === String(seed.id));
  return {
    ...(found || {}),
    id: String(seed.id),
    name: String(found?.name || seed.name || rawTeamName),
    country: String(found?.country || LEAGUE_CONFIG[id]?.country || ""),
    resolutionSource: "seed"
  };
}

async function searchProviderTeam(id, rawTeamName, catalog) {
  const config = LEAGUE_CONFIG[id];
  if (!config) throw new Error("Lega BSD non configurata");
  const directory = await ensureProviderTeamDirectory(id, catalog);
  const seeded = seededProviderTeam(id, rawTeamName, directory);
  if (seeded) return seeded;
  const found = bestProviderTeam(rawTeamName, directory, config.country);
  if (found) return found;
  const preferred = PROVIDER_SEARCH_NAMES[clubKey(rawTeamName)];
  if (preferred) {
    const preferredMatch = bestProviderTeam(preferred, directory, config.country);
    if (preferredMatch) return preferredMatch;
  }
  throw new Error(`Squadra BSD non trovata nel catalogo completo: ${rawTeamName}`);
}

async function resolveProviderTeamByOverlap(id, rawTeamName, catalog, assetRows) {
  const config = LEAGUE_CONFIG[id];
  const directory = await ensureProviderTeamDirectory(id, catalog);
  const candidates = providerTeamCandidates(rawTeamName, directory, config.country, 10);
  if (!candidates.length) throw new Error(`Nessuna squadra BSD candidata per ${rawTeamName}`);

  const candidateResults = await Promise.all(candidates.map(async (candidate) => {
    try {
      const payload = await bsdGet("/api/players/", { team: candidate.id, limit: 200 });
      const roster = collectBsdPlayers(payload, { ...candidate, key: clubKey(rawTeamName) });
      return { ...teamCandidateResult(assetRows, candidate, roster), roster };
    } catch (error) {
      return {
        id: String(candidate.id),
        name: String(candidate.name || ""),
        country: String(candidate.country || ""),
        nameScore: Number(candidate.nameScore || 0),
        rosterSize: 0,
        automatic: 0,
        ambiguous: 0,
        noNameMatch: assetRows.length,
        coverage: 0,
        matchedPlayers: [],
        roster: [],
        error: String(error?.message || error || "Rosa BSD non disponibile")
      };
    }
  }));

  const recommendation = recommendProviderTeam(candidateResults, assetRows.length);
  if (recommendation.status !== "recommended" || !recommendation.team) {
    const top = candidateResults
      .filter((candidate) => !candidate.error)
      .sort((a, b) => b.automatic - a.automatic || b.nameScore - a.nameScore)
      .slice(0, 3)
      .map((candidate) => `${candidate.name} [${candidate.id}] ${candidate.automatic}/${assetRows.length}`)
      .join("; ");
    throw new Error(`Squadra BSD da confermare per ${rawTeamName}${top ? `: ${top}` : ""}`);
  }

  const selected = recommendation.team;
  return {
    team: {
      id: String(selected.id),
      name: String(selected.name || rawTeamName),
      country: String(selected.country || config.country || ""),
      resolutionSource: "overlap",
      resolutionReason: recommendation.reason
    },
    roster: selected.roster || [],
    recommendation
  };
}

async function resolveProviderTeam(id, rawTeamName, catalog, assetRows = []) {
  const key = clubKey(rawTeamName);
  const existing = catalog.teams[key];
  // Una entry in cache che punta a una squadra femminile/giovanile e' stale:
  // va ri-risolta invece di persistere il match sbagliato.
  if (existing?.id && !isNonFirstTeamName(existing.name)) return { team: existing, roster: null };

  const directory = await ensureProviderTeamDirectory(id, catalog);
  const seeded = seededProviderTeam(id, rawTeamName, directory);
  let resolved;
  if (seeded) resolved = { team: seeded, roster: null };
  else if (Array.isArray(assetRows) && assetRows.length) resolved = await resolveProviderTeamByOverlap(id, rawTeamName, catalog, assetRows);
  else resolved = { team: await searchProviderTeam(id, rawTeamName, catalog), roster: null };

  const team = {
    ...resolved.team,
    id: String(resolved.team.id),
    name: String(resolved.team.name || rawTeamName),
    listoneName: rawTeamName,
    key,
    country: String(resolved.team.country || LEAGUE_CONFIG[id]?.country || ""),
    playerIds: [],
    checkedAt: null,
    error: ""
  };
  catalog.teams[key] = team;
  return { team, roster: resolved.roster || null };
}

function persistedTeamOverrideNeedsRepair(assetRows, team, roster) {
  if (team?.resolutionSource !== "neon" || !Array.isArray(assetRows) || assetRows.length < 5) return false;
  const result = teamCandidateResult(assetRows, team, roster || []);
  const minimumAutomatic = Math.max(2, Math.ceil(assetRows.length * 0.3));
  return result.automatic < minimumAutomatic && result.coverage < 0.35;
}

async function refreshTeamSquad(id, rawTeamName, catalog, assetRows = []) {
  const key = clubKey(rawTeamName);
  const resolved = await resolveProviderTeam(id, rawTeamName, catalog, assetRows);
  let team = resolved.team;
  let current = catalog.teams[key] || team;
  try {
    let candidates = resolved.roster;
    if (!Array.isArray(candidates) || !candidates.length) {
      const payload = await bsdGet("/api/players/", { team: team.id, limit: 200 });
      candidates = collectBsdPlayers(payload, { ...team, key });
    }
    if (!candidates.length) throw new Error(`BSD non ha restituito la rosa di ${team.name}`);

    // Un override persistito in Neon e' affidabile solo se la rosa combacia
    // ancora con il Listone corrente: altrimenti va riparato.
    if (persistedTeamOverrideNeedsRepair(assetRows, team, candidates)) {
      delete catalog.teams[key];
      const repaired = await resolveProviderTeam(id, rawTeamName, catalog, assetRows);
      team = {
        ...repaired.team,
        id: String(repaired.team.id),
        name: String(repaired.team.name || rawTeamName),
        listoneName: rawTeamName,
        key,
        country: String(repaired.team.country || LEAGUE_CONFIG[id]?.country || ""),
        playerIds: [],
        checkedAt: null,
        error: ""
      };
      current = team;
      const payload = await bsdGet("/api/players/", { team: team.id, limit: 200 });
      candidates = collectBsdPlayers(payload, { ...team, key });
      if (!candidates.length) throw new Error(`BSD non ha restituito la rosa corretta di ${team.name}`);
    }

    (current.playerIds || []).forEach((playerId) => {
      if (catalog.players[playerId]?.teamKey === key) delete catalog.players[playerId];
    });
    candidates.forEach((candidate) => { catalog.players[candidate.id] = { ...candidate, teamKey: key }; });
    catalog.teams[key] = {
      ...team,
      listoneName: rawTeamName,
      key,
      playerIds: candidates.map((candidate) => candidate.id),
      checkedAt: isoNow(),
      error: ""
    };
  } catch (error) {
    catalog.teams[key] = { ...current, ...team, key, listoneName: rawTeamName, checkedAt: isoNow(), error: error.message || "Rosa non disponibile" };
    throw error;
  }
  return catalog.teams[key];
}

function compactName(value) {
  return normalize(value).replace(/\s+/g, "");
}

function stripNameNotes(value) {
  return String(value || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assetNameVariants(asset) {
  return [...new Set([
    asset?.displayName,
    asset?.docsName,
    stripNameNotes(asset?.displayName),
    stripNameNotes(asset?.docsName)
  ].map(String).map((name) => name.trim()).filter(Boolean))];
}

function editDistance(first, second) {
  const left = String(first || "");
  const right = String(second || "");
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return previous[right.length];
}

function closeTokenScore(leftTokens, rightTokens) {
  const leftCandidates = leftTokens.length === 1 ? leftTokens : [leftTokens.at(-1), leftTokens.join("")];
  const rightCandidates = rightTokens.length === 1 ? rightTokens : [...rightTokens, rightTokens.join("")];
  let best = 0;
  leftCandidates.filter(Boolean).forEach((left) => {
    rightCandidates.filter(Boolean).forEach((right) => {
      const maximum = Math.max(left.length, right.length);
      if (maximum < 5 || Math.abs(left.length - right.length) > 2) return;
      const distance = editDistance(left, right);
      if (distance === 1) best = Math.max(best, 72);
      else if (distance === 2 && maximum >= 7) best = Math.max(best, 70);
      else if (distance === 2 && maximum >= 6 && left[0] === right[0] && left.at(-1) === right.at(-1)) {
        best = Math.max(best, 70);
      }
    });
  });
  return best;
}

function initialAndSurnameMatch(leftTokens, rightTokens) {
  if (leftTokens.length !== 2 || rightTokens.length < 2) return false;
  const initialIndex = leftTokens.findIndex((token) => token.length === 1);
  if (initialIndex === -1) return false;
  const initial = leftTokens[initialIndex];
  const surname = leftTokens[initialIndex === 0 ? 1 : 0];
  return rightTokens.includes(surname)
    && rightTokens.some((token) => token !== surname && token.startsWith(initial));
}

function nameScore(target, candidate) {
  const left = normalize(target);
  const right = normalize(candidate);
  if (!left || !right) return 0;
  if (left === right) return 84;

  const leftCompact = compactName(left);
  const rightCompact = compactName(right);
  if (leftCompact.length >= 5 && leftCompact === rightCompact) return 83;

  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);
  const leftLast = leftTokens.at(-1);
  const rightLast = rightTokens.at(-1);
  if (leftTokens.length > 1 && rightTokens.length > 1
      && [...leftTokens].sort().join(" ") === [...rightTokens].sort().join(" ")) return 82;
  if (initialAndSurnameMatch(leftTokens, rightTokens) || initialAndSurnameMatch(rightTokens, leftTokens)) return 82;
  if (leftTokens.length === 1 && rightTokens.includes(leftTokens[0])) return 76;
  if (rightTokens.length === 1 && leftTokens.includes(rightTokens[0])) return 76;
  if (leftLast && leftLast === rightLast) {
    if (leftTokens.length === 1 || rightTokens.length === 1) return 74;
    if (leftTokens[0]?.[0] === rightTokens[0]?.[0]) return 80;
  }
  if (leftTokens.length > 1 && leftTokens.every((token) => rightTokens.includes(token))) return 74;
  if (rightTokens.length > 1 && rightTokens.every((token) => leftTokens.includes(token))) return 74;
  if ((leftCompact.length >= 5 && rightCompact.includes(leftCompact))
      || (rightCompact.length >= 5 && leftCompact.includes(rightCompact))) return 73;
  return closeTokenScore(leftTokens, rightTokens);
}

function scoreCandidate(asset, candidate) {
  const providerNames = candidate.names?.length ? candidate.names : [candidate.name];
  const base = Math.max(0, ...assetNameVariants(asset).flatMap((target) => providerNames.map((name) => nameScore(target, name))));
  if (!base) return 0;
  const candidateClub = String(candidate.teamKey || clubKey(candidate.teamName));
  const sameClub = clubKeysForValue(asset.realTeam).includes(candidateClub);
  return base + (sameClub ? 18 : 0);
}

function chooseCandidate(asset, candidates) {
  const ranked = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(asset, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return { selected: null, candidates: [] };
  const onlyCandidate = ranked.length === 1;
  const clearLead = onlyCandidate || ranked[0].score >= ranked[1].score + 4;
  const safeScore = onlyCandidate ? ranked[0].score >= 88 : ranked[0].score >= 92;
  const selected = safeScore && clearLead ? ranked[0].candidate : null;
  return {
    selected,
    candidates: ranked.slice(0, 12).map(({ candidate, score }) => sanitizeCandidate({ ...candidate, score })).filter(Boolean)
  };
}

function candidatesForAsset(catalog, asset) {
  const targets = new Set(clubKeysForValue(asset.realTeam));
  let candidates = Object.values(catalog.players || {}).filter((candidate) => targets.has(String(candidate.teamKey || clubKey(candidate.teamName))));
  if (asset.type === "goalkeeper") {
    candidates = candidates.filter((c) => /^g/i.test(String(c.providerPosition || "")));
  }
  return candidates;
}

function keepExistingOrUnresolved(asset, existing, candidates, error) {
  if (isResolvedEntry(existing)) {
    return {
      ...existing,
      lastRefreshError: String(error || "Aggiornamento non riuscito"),
      lastRefreshAttemptAt: isoNow()
    };
  }
  return {
    key: playerKey(asset.displayName, asset.realTeam),
    listoneName: asset.displayName,
    realTeam: asset.realTeam,
    status: "unresolved",
    candidates: (candidates || []).map(sanitizeCandidate).filter(Boolean),
    checkedAt: isoNow(),
    error: String(error || ((candidates || []).length ? "Associazione da confermare" : "Giocatore non trovato nel catalogo BSD"))
  };
}

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
  return {
    version: MANIFEST_VERSION,
    leagueId: manifest.leagueId,
    provider: PROVIDER,
    sourceMode: SOURCE_MODE,
    updatedAt: manifest.updatedAt,
    players,
    refresh: manifest.refresh || idleRefresh(),
    summary: summary(manifest)
  };
}

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

function teamCandidateResult(assetRows, candidate, roster) {
  let automatic = 0;
  let ambiguous = 0;
  let noNameMatch = 0;
  const matchedPlayers = [];

  assetRows.forEach((asset) => {
    const result = chooseCandidate(asset, roster);
    if (result.selected) {
      automatic += 1;
      matchedPlayers.push({
        listoneName: asset.displayName,
        docsName: asset.docsName || "",
        bsdId: result.selected.id,
        bsdName: result.selected.name
      });
    } else if (result.candidates.length) ambiguous += 1;
    else noNameMatch += 1;
  });

  const total = assetRows.length;
  return {
    id: String(candidate.id),
    name: String(candidate.name || ""),
    country: String(candidate.country || ""),
    nameScore: Number(candidate.nameScore || 0),
    rosterSize: roster.length,
    automatic,
    ambiguous,
    noNameMatch,
    coverage: total ? automatic / total : 0,
    matchedPlayers
  };
}

function recommendProviderTeam(candidateResults, totalPlayers) {
  const successful = candidateResults
    .filter((candidate) => !candidate.error && candidate.rosterSize > 0)
    .sort((a, b) => b.automatic - a.automatic
      || b.coverage - a.coverage
      || b.nameScore - a.nameScore
      || Math.abs(a.rosterSize - totalPlayers) - Math.abs(b.rosterSize - totalPlayers));

  const best = successful[0] || null;
  const second = successful[1] || null;
  if (!best) return { status: "unresolved", team: null, reason: "Nessuna rosa BSD valida tra i candidati" };

  const minimumMatches = Math.min(totalPlayers, Math.max(3, Math.ceil(totalPlayers * 0.2)));
  const margin = best.automatic - Number(second?.automatic || 0);
  const clearByCoverage = best.coverage >= 0.65 && Number(second?.coverage || 0) < 0.35;
  const clearByMargin = margin >= 3;
  const exactAndUseful = best.nameScore >= 100 && best.automatic >= minimumMatches && !second;

  if (best.automatic >= minimumMatches && (clearByMargin || clearByCoverage || exactAndUseful)) {
    return {
      status: "recommended",
      team: best,
      reason: `${best.automatic}/${totalPlayers} match automatici${second ? `, vantaggio ${margin} sul secondo candidato` : ""}`
    };
  }

  return {
    status: "review",
    team: best,
    reason: `${best.automatic}/${totalPlayers} match automatici; margine insufficiente per fissare l'ID senza controllo`
  };
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
  if (!fresh && databaseConfigured()) {
    const persisted = await readManifestCache(id);
    const persistedAt = new Date(persisted?.generatedAt || 0).getTime();
    const localAt = Number(cached?.generatedAt || 0);
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
  catalog.providerTeams = await fetchProviderTeamDirectory(LEAGUE_CONFIG[id]?.country);
  catalog.providerTeamsUpdatedAt = isoNow();

  await mapWithConcurrency(clubs, 5, async (club) => {
    try {
      const clubAssets = players.filter((asset) => assetBelongsToClub(asset, club));
      await refreshTeamSquad(id, club, catalog, clubAssets);
    } catch (error) {
      failedTeams[clubKey(club)] = String(error?.message || error || "Rosa BSD non disponibile");
    }
  });

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

  players.forEach((asset) => {
    const key = playerKey(asset.displayName, asset.realTeam);
    const override = playerOverrides[key];
    if (override?.id) {
      manifest.players[key] = directResolvedEntry(asset, manualCandidate(asset, override), "manual-neon");
      return;
    }
    const failedTeamError = clubKeysForValue(asset.realTeam).map((value) => failedTeams[value]).find(Boolean) || "";
    const candidates = failedTeamError ? [] : candidatesForAsset(catalog, asset);
    const result = failedTeamError ? { selected: null, candidates: [] } : chooseCandidate(asset, candidates);
    manifest.players[key] = result.selected
      ? directResolvedEntry(asset, result.selected)
      : keepExistingOrUnresolved(
          asset,
          null,
          result.candidates,
          failedTeamError || (result.candidates.length ? "Associazione BSD da controllare" : "Giocatore non trovato nella rosa BSD")
        );
  });

  assertPublishableManifest(manifest);
  const state = {
    version: DIRECT_STATE_VERSION,
    manifest,
    catalog,
    total: players.length,
    teamIssues: Object.entries(failedTeams).map(([key, error]) => ({
      key,
      teamName: clubs.find((club) => clubKey(club) === key) || key,
      error
    }))
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

function rankedCandidates(query, candidates, extraScore = 0) {
  return (candidates || [])
    .map((candidate) => ({ candidate, score: queryScore(query, candidate) + extraScore }))
    .sort((a, b) => b.score - a.score || String(a.candidate.name).localeCompare(String(b.candidate.name)))
    .map(({ candidate, score }) => sanitizeCandidate({ ...candidate, score }))
    .filter(Boolean);
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

// ---------------------------------------------------------------------------
// Deprecated legacy entry points.
// The direct pipeline is the only implementation; these names are kept so the
// historical integration tests keep pinning the same behaviors. Thin wrappers,
// scheduled for removal together with the tests that exercise them.
// ---------------------------------------------------------------------------

async function legacyStartMissingSync(rawLeagueId) {
  return publicManifest(await refreshDirectManifest(rawLeagueId));
}

async function legacyProcessFullSync(rawLeagueId) {
  return publicManifest(await refreshDirectManifest(rawLeagueId));
}

module.exports = {
  CATALOG_VERSION,
  FULL_SYNC_DATES,
  MANIFEST_VERSION,
  PROVIDER,
  assertPublishableManifest,
  bestProviderTeam,
  chooseCandidate,
  clubKey,
  collectBsdPlayers,
  collectBsdTeams,
  diagnoseFreshMatching,
  diagnoseProviderTeamSelection,
  directLinkManual,
  directLinkTeam,
  directMediaStatus,
  directReadManifest,
  directSearchProvider,
  directSearchProviderTeams,
  directSyncMissing,
  isFullSyncDate,
  isCurrentBsdEntry,
  isNonFirstTeamName,
  isResolvedEntry,
  keepExistingOrUnresolved,
  linkTeamManual: directLinkTeam,
  playerKey,
  playerPhotoUrl: providerImageUrl,
  persistedTeamOverrideNeedsRepair,
  processFullSync: legacyProcessFullSync,
  providerTeamCandidates,
  publicManifest,
  readManifest: directReadManifest,
  refreshDirectManifest,
  refreshTeamSquad,
  resolveProviderTeam,
  searchProvider: directSearchProvider,
  searchProviderTeams: directSearchProviderTeams,
  startMissingSync: legacyStartMissingSync,
  summary,
  syncMissing: directSyncMissing
};
