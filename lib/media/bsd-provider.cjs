"use strict";

// ---------------------------------------------------------------------------
// BSD provider pipeline core.
//
// Standalone module (no internal dependencies): constants, normalization,
// URL/entry recognition, BSD HTTP API, payload collection, team directory and
// resolution, name scoring + candidate selection, team-candidate scoring and
// squad refresh. lib/media/name-matching.cjs and manifest-state.cjs build on
// top of it; lib/media/diagnostics.cjs and the player-media facade consume it.
// ---------------------------------------------------------------------------

const TEAM_SEEDS = require("../../data/bsd-team-seeds.json");

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

// Lega di listone -> id "league" dell'API stagioni BSD. Un id numerico
// passato senza mapping viene usato cosi' com'e'; id non mappabili (es. una
// lega non configurata) restituiscono null e disattivano il filtro.
const SEASON_LEAGUE_IDS = Object.freeze({
  fp: "1",
  pd: "3"
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

// --- Normalization and club keys -------------------------------------------------

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

// --- URL and entry recognition ---------------------------------------------------

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

// --- Quota BSD globale ------------------------------------------------------------
// Il provider limita a ~7500 richieste/giorno con reset a mezzanotte UTC: ogni
// tentativo fetch conta 1 unita'. Il circuito si apre al primo 429 e resta
// aperto fino al reset, cosi' non si brucia quota in retry a raffica.
// Modulo standalone: niente import interni; la persistenza Neon vive in
// manifest-state.cjs, qui solo stato di processo + drain per la contabilita'.
let bsdCallCount = 0;
let bsdCircuitUntil = 0;

function nextQuotaResetIso(date = new Date()) {
  const reset = new Date(date);
  reset.setUTCHours(24, 0, 0, 0);
  return reset.toISOString();
}

function quotaExhaustedError(resetAt) {
  return Object.assign(new Error(`Quota BSD esaurita fino a ${resetAt}`), {
    quotaExhausted: true,
    status: 429
  });
}

function bsdCircuitOpen() {
  return Date.now() < bsdCircuitUntil;
}

// --- Cache persistenti BSD (riduzione chiamate) ----------------------------------
// Directory, stagioni, transfer-detail e ricerche cambiano di rado: si tengono
// in memoria con timestamp e si riversano su Neon (chiave bsd-cache) a fine
// giro, cosi' i refresh successivi riusano senza rete. TTL default 7 giorni
// (env BSD_CACHE_TTL_MS); le ricerche senza risultati scadono dopo 24h per
// riprovare prima. Solo successi: gli errori non si cachano mai.
function bsdCacheTtlMs() {
  return Math.max(60 * 1000, Number(process.env.BSD_CACHE_TTL_MS || 7 * 24 * 3600 * 1000));
}

const BSD_SEARCH_MISS_TTL_MS = 24 * 3600 * 1000;

let bsdCachesDirty = false;

function cacheEntryFresh(entry, ttlMs) {
  const storedAt = Number(entry?.storedAt || 0);
  return storedAt > 0 && Date.now() - storedAt < ttlMs;
}

function dumpBsdCaches() {
  if (!bsdCachesDirty) return null;
  const pick = (map, ttlFor) => {
    const out = {};
    for (const [key, entry] of map.entries()) {
      const ttl = typeof ttlFor === "function" ? ttlFor(entry) : ttlFor;
      if (entry && cacheEntryFresh(entry, ttl)) out[key] = { value: entry.value, storedAt: entry.storedAt };
    }
    return out;
  };
  bsdCachesDirty = false;
  // Niente directory: un down totale deve restare visibile come degraded,
  // e la cache persistita lo mascherebbe. Transfer, ricerche e stagioni non
  // alterano i flag di stato.
  return {
    transfers: pick(transferDetailCache, bsdCacheTtlMs()),
    searches: pick(searchCache, (entry) => (entry?.value?.length ? bsdCacheTtlMs() : BSD_SEARCH_MISS_TTL_MS)),
    seasons: pick(seasonCache, bsdCacheTtlMs())
  };
}

function restoreBsdCaches(blob) {
  if (!blob || typeof blob !== "object") return;
  const load = (map, section) => {
    const data = blob[section];
    if (!data || typeof data !== "object") return;
    for (const [key, entry] of Object.entries(data)) {
      if (entry && typeof entry.storedAt === "number" && entry.value !== undefined) {
        map.set(String(key), { value: entry.value, storedAt: entry.storedAt });
      }
    }
  };
  load(transferDetailCache, "transfers");
  load(searchCache, "searches");
  load(seasonCache, "seasons");
}

function drainBsdCallCount() {
  const count = bsdCallCount;
  bsdCallCount = 0;
  return count;
}

function isQuotaError(error) {
  return Boolean(error?.quotaExhausted);
}

// --- BSD HTTP API -----------------------------------------------------------------

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

  if (bsdCircuitOpen()) throw quotaExhaustedError(new Date(bsdCircuitUntil).toISOString());

  let lastError = null;
  const attempts = Math.max(1, Number(maxAttempts || 1));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const apiKey = bsdApiKey();
      bsdCallCount += 1;
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Token ${apiKey}`,
          "User-Agent": "FantaHub/2.0"
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 429) {
        // Quota finita: apri il circuito fino al reset e NON riprovare,
        // altrimenti ogni tentativo brucia altra quota.
        bsdCircuitUntil = Date.parse(nextQuotaResetIso());
        throw quotaExhaustedError(new Date(bsdCircuitUntil).toISOString());
      }
      if (!response.ok) {
        const detail = String(payload?.detail || payload?.message || "").trim();
        const error = new Error(`BSD HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      if (isQuotaError(error)) throw error;
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

// --- Stagione corrente e filtro trasferimenti ---------------------------------------

const SEASON_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const seasonCache = new Map();
const transferDetailCache = new Map();

function clearSeasonCache() { seasonCache.clear(); }
function clearTransferCache() { transferDetailCache.clear(); }

function seasonLeagueId(rawLeagueId) {
  const value = String(rawLeagueId || "").trim();
  if (SEASON_LEAGUE_IDS[value]) return SEASON_LEAGUE_IDS[value];
  return /^\d+$/.test(value) ? value : null;
}

function pickCurrentSeason(items, today = new Date()) {
  const now = today.toISOString().slice(0, 10);
  // Se una stagione e' marcata is_current vince, anche se lo start e' futuro.
  const explicit = (items || [])
    .filter((item) => item && item.id != null && item.is_current);
  if (explicit.length) {
    explicit.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    return explicit[0];
  }
  const contenders = (items || [])
    .filter((item) => item && item.id != null && String(item.start_date || "") <= now);
  contenders.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
  return contenders[0] || null;
}

async function resolveProviderSeason(rawLeagueId) {
  const league = seasonLeagueId(rawLeagueId);
  if (league === null) return null;
  const cachedSeason = seasonCache.get(league);
  if (cachedSeason && cacheEntryFresh(cachedSeason, bsdCacheTtlMs())) return cachedSeason.value;
  let result = null;
  try {
    const payload = await bsdGet("/api/seasons/", { league });
    const picked = pickCurrentSeason(payloadItems(payload));
    if (picked) {
      result = {
        id: String(picked.id),
        name: String(picked.name || ""),
        year: Number(picked.year),
        startDate: String(picked.start_date || ""),
        source: PROVIDER
      };
      seasonCache.set(league, { value: result, storedAt: Date.now() });
      bsdCachesDirty = true;
    }
  } catch (error) {
    if (error?.quotaExhausted) throw error;
    result = null;
  }
  return result;
}

async function fetchPlayerTransferDetail(playerId) {
  const id = String(playerId || "").trim();
  if (!/^\d+$/.test(id)) return null;
  const cached = transferDetailCache.get(id);
  if (cached && cacheEntryFresh(cached, bsdCacheTtlMs())) return cached.value;
  const payload = await bsdGet(`/api/players/${id}/`);
  const detail = { id, transfers: Array.isArray(payload?.transfers) ? payload.transfers : [] };
  transferDetailCache.set(id, { value: detail, storedAt: Date.now() });
  bsdCachesDirty = true;
  return detail;
}

// Esegue la worker su ogni valore limitando le esecuzioni concorrenti, utile
// per non saturare l'API sui dettagli giocatore di una rosa intera.
function mapWithConcurrency(values, concurrency, worker) {
  const queue = [...values];
  const results = new Array(values.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(Number(concurrency || 1), queue.length)) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(queue[index], index);
    }
  });
  return Promise.all(runners).then(() => results);
}

function playerLatestTransfer(detail) {
  const transfers = Array.isArray(detail?.transfers) ? detail.transfers : [];
  let latest = null;
  transfers.forEach((transfer) => {
    const date = String(transfer?.transfer_date || "");
    const toTeamId = String(transfer?.to_team?.id ?? "");
    const fromTeamId = String(transfer?.from_team?.id ?? "");
    if (!date || !toTeamId) return;
    if (!latest || date > latest.date) latest = { toTeamId, fromTeamId, date };
  });
  return latest;
}

function isActiveInTeam(latest, teamId) {
  if (!latest) return true;
  return String(latest.toTeamId) === String(teamId);
}

// --- Ricerca giocatore per nome (fallback "cerca nella lega") -------------------
//
// Quando un giocatore del Listone non e' nella rosa attiva della sua squadra
// (es. trasferito nel mercato in corso, ma nel CSV anno precedente), BSD puo
// ancora conoscerlo: /api/players/?search=<nome> restituisce ogni giocatore
// con il club attuale (current_team). I risultati vengono filtrati per il
// country della lega (England/Spain) per scartare omonimi del resto del mondo.
//
// La ricerca BSD e' accent-sensitive ("gyokeres" non trova "Gyökeres"), mentre
// il Listone spesso e' scritto senza accenti: quando la query base non trova
// nulla si riprova con poche varianti accentate e, come ultima spiaggia, con
// il solo cognome (recupera "Andres Garcia" -> "Andrés García"; poi la
// normalizzazione accent-insensitive di nameScore fa il match esatto). Se il
// filtro per paese svuota risultati altrimenti validi (es. trasferito
// all'estero), i candidati vengono comunque esposti e decidera' lo scoring
// (sameClub/nameScore) se risolvere o lasciare da controllare.

const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const searchCache = new Map();

// Anti-429: al massimo una chiamata di ricerca avviata ogni intervallo, con
// gli avvii serializzati (le risposte restano concorrenti, il burst no).
const SEARCH_MIN_INTERVAL_MS = 120;
let searchGateTail = Promise.resolve();

// Diacritici piu' comuni nei nomi del calcio, in ordine di frequenza reale.
// Prima chiave: carattere base nel Listone; seconda: sostituzione accentata.
const ACCENT_PAIRS = [
  ["e", "é"], ["a", "á"], ["i", "í"], ["o", "ó"], ["u", "ú"],
  ["o", "ö"], ["u", "ü"], ["n", "ñ"], ["c", "ç"], ["o", "ø"],
  ["e", "è"], ["a", "à"], ["i", "ì"], ["o", "ò"], ["u", "ù"],
  ["a", "ä"], ["e", "ê"], ["a", "â"], ["i", "î"], ["o", "ô"],
  ["e", "ë"], ["i", "ï"], ["u", "û"], ["a", "ã"], ["o", "õ"],
  ["a", "å"], ["s", "š"], ["z", "ž"]
];

const ACCENT_MAX_VARIANTS = 12;

// Varianti accentate con UNA sostituzione alla volta, partendo dalla fine
// (le ultime sillabe, tipicamente il cognome, sono le piu' probabili porte
// degli accenti) e fermandosi al budget per non moltiplicare le chiamate.
function accentVariants(query) {
  const variants = [];
  for (const [base, accented] of ACCENT_PAIRS) {
    for (let i = query.length - 1; i >= 0 && variants.length < ACCENT_MAX_VARIANTS; i--) {
      if (query[i] !== base) continue;
      variants.push(query.slice(0, i) + accented + query.slice(i + 1));
      break;
    }
  }
  return variants;
}

function searchAttempts(rawName) {
  const tokens = rawName.split(" ").filter(Boolean);
  const lastName = tokens.length > 1 ? tokens.at(-1) : "";
  const attempts = [];
  for (const value of [rawName, ...accentVariants(rawName), lastName, ...accentVariants(lastName)]) {
    if (value && !attempts.includes(value)) attempts.push(value);
  }
  return attempts;
}

function searchGate() {
  const slot = searchGateTail.then(() => pause(SEARCH_MIN_INTERVAL_MS));
  searchGateTail = slot.catch(() => {});
  return slot;
}

function clearSearchCache() { searchCache.clear(); }

function collectSearchPlayers(payload) {
  return payloadItems(payload).map((item) => {
    const player = item && typeof item === "object" ? item : {};
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
    const itemTeam = currentTeamObject(player);
    return {
      id,
      name,
      names,
      teamName: String(itemTeam.name || ""),
      teamId: String(itemTeam.id ?? ""),
      teamKey: String(clubKey(itemTeam.name || "")),
      country: countryName(itemTeam.country || itemTeam.country_name || itemTeam.countryName),
      providerPosition: String(nestedValue(player, ["position", "position_name", "positionName"])),
      photoUrl: providerImageUrl(id)
    };
  }).filter(Boolean);
}

function currentTeamObject(player) {
  if (player?.current_team && typeof player.current_team === "object") return player.current_team;
  if (player?.team && typeof player.team === "object") return player.team;
  return {};
}

async function searchPlayerByName(rawName, country = "", options = {}) {
  const query = String(rawName || "").trim();
  if (!query) return [];
  const cacheKey = `${normalize(query)}|${normalize(country)}`;
  const cachedSearch = searchCache.get(cacheKey);
  if (cachedSearch && cacheEntryFresh(cachedSearch, cachedSearch.value.length ? bsdCacheTtlMs() : BSD_SEARCH_MISS_TTL_MS)) {
    return cachedSearch.value;
  }
  let hits = [];
  try {
    // Si provano le varianti in ordine e si tiene il blocco con lo score
    // locale migliore: fermarsi al PRIMO tentativo con risultati sbaglia
    // (es. "hincapie" trova gli omonimi prima che "hincapié" trovi Felipe
    // Hincapié). A parita' di score si preferisce l'ultima variante, a meno
    // che lo score non sia gia' da match esatto (>= 84, es. "ghost player").
    let best = null;
    for (const attempt of searchAttempts(query)) {
      await searchGate();
      const payload = await bsdGet("/api/players/", { search: attempt, limit: Math.max(1, Number(options.limit || 50)) });
      const raw = collectSearchPlayers(payload);
      if (raw.length === 0) continue;
      const chunk = country
        ? (() => {
          const byCountry = raw.filter((candidate) => !candidate.country || normalize(candidate.country) === normalize(country));
          return byCountry.length > 0 ? byCountry : raw;
        })()
        : raw;
      const score = Math.max(...chunk.map((candidate) => nameScore(query, candidate.name)));
      if (!best || score > best.score || (score === best.score && score < 84)) best = { score, hits: chunk };
    }
    hits = best ? best.hits : [];
  } catch (error) {
    if (error?.quotaExhausted) throw error;
    // La ricerca e' una cortesia: se BSD e' irraggiungibile il flusso resta
    // quello di oggi (giocatore non trovato nella rosa). L'errore NON viene
    // cacheato come "0 risultati": un cache di fallimento congelerebbe
    // il giocatore come introvabile anche quando l'API tornera' su.
    // (Le ricerche COMPLETATE senza risultati si cachano con TTL breve.)
    return [];
  }
  searchCache.set(cacheKey, { value: hits, storedAt: Date.now() });
  bsdCachesDirty = true;
  return hits;
}

// --- Payload collection ------------------------------------------------------------

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

// --- Name scoring and candidate selection ------------------------------------------

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

// --- Team-candidate scoring ----------------------------------------------------------

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

    const season = await resolveProviderSeason(id);
    let activeCandidates = candidates;
    let rosterStats = null;
    if (season) {
      const reviewed = await mapWithConcurrency(candidates, 6, async (candidate) => {
        try {
          const detail = await fetchPlayerTransferDetail(candidate.id);
          const latest = playerLatestTransfer(detail);
          if (!isActiveInTeam(latest, team.id)) return { candidate, removed: true };
        } catch (error) {
          if (error?.quotaExhausted) throw error;
          // Dettaglio non disponibile: nessuna prova di uscita -> conservato.
        }
        return { candidate, removed: false };
      });
      activeCandidates = reviewed.filter((entry) => !entry.removed).map((entry) => entry.candidate);
      rosterStats = {
        total: candidates.length,
        kept: activeCandidates.length,
        removedNames: reviewed
          .filter((entry) => entry.removed)
          .map((entry) => String(entry.candidate.name || ""))
      };
    }

    (current.playerIds || []).forEach((playerId) => {
      if (catalog.players[playerId]?.teamKey === key) delete catalog.players[playerId];
    });
    activeCandidates.forEach((candidate) => { catalog.players[candidate.id] = { ...candidate, teamKey: key }; });
    catalog.teams[key] = {
      ...team,
      listoneName: rawTeamName,
      key,
      playerIds: activeCandidates.map((candidate) => candidate.id),
      season: season || null,
      rosterStats,
      checkedAt: isoNow(),
      error: ""
    };
  } catch (error) {
    catalog.teams[key] = { ...current, ...team, key, listoneName: rawTeamName, checkedAt: isoNow(), error: error.message || "Rosa non disponibile" };
    throw error;
  }
  return catalog.teams[key];
}

module.exports = {
  CATALOG_VERSION,
  FULL_SYNC_DATES,
  LEAGUE_CONFIG,
  MANIFEST_VERSION,
  PROVIDER,
  SOURCE_MODE,
  bestProviderTeam,
  bsdCircuitOpen,
  bsdGet,
  candidatesForAsset,
  drainBsdCallCount,
  dumpBsdCaches,
  isQuotaError,
  chooseCandidate,
  clearSearchCache,
  clearSeasonCache,
  clearTransferCache,
  clubKey,
  clubKeysForValue,
  clubNamesForValue,
  clone,
  collectBsdPlayers,
  collectBsdTeams,
  ensureProviderTeamDirectory,
  fetchProviderTeamDirectory,
  isActiveInTeam,
  isCurrentBsdEntry,
  isKnownExternalSourceUrl,
  isNonFirstTeamName,
  isResolvedEntry,
  isoNow,
  keepExistingOrUnresolved,
  nextQuotaResetIso,
  normalize,
  persistedTeamOverrideNeedsRepair,
  playerKey,
  playerLatestTransfer,
  providerImageUrl,
  providerTeamCandidates,
  recommendProviderTeam,
  refreshTeamSquad,
  restoreBsdCaches,
  resolveProviderSeason,
  resolveProviderTeam,
  sanitizeCandidate,
  searchPlayerByName,
  teamCandidateResult
};
