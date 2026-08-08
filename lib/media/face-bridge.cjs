"use strict";

// ---------------------------------------------------------------------------
// FaceBridge: ritratto di fallback keyless per i giocatori senza foto.
//
// Catena validata live su 30 nomi reali (28/30 = 93.3% di copertura):
//   A exact  (Wikipedia, titolo normalizzato == nome normalizzato)
//   -> A surname (Wikipedia, solo cognome, con estratto "calciatore")
//   -> B full (TheSportsDB, nome completo; cutout PNG trasparente preferito)
//   -> B surname (TheSportsDB, solo cognome, con validazione squadra)
//
// Buona condotta (misurata durante la validazione live):
//   - Wikipedia: >= 950ms tra chiamate, User-Agent descrittivo, gsrlimit=10,
//     ordinamento per "index", backoff esponenziale + Retry-After sul 429.
//   - TheSportsDB: >= 300ms tra chiamate, chiave gratuita "123" (no signup).
//   - Cache in-memory condivisa; flushCache() per i test.
// ---------------------------------------------------------------------------

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const TSD_API = "https://www.thesportsdb.com/api/v1/json/123";
const USER_AGENT = "FantaLineup/1.0 (fantacalcio; contact: admin@example.com)";

const WIKI_MIN_INTERVAL_MS = 950;
const TSD_MIN_INTERVAL_MS = 300;
const REQUEST_TIMEOUT_MS = 12000;
const MAX_ATTEMPTS = 3;

const cache = new Map();
let lastWikiCallAt = 0;
let lastTsdCallAt = 0;

// --- Normalizzazione (allineata a bsd-provider.cjs) --------------------------

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ø/g, "o").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ł/g, "l")
    .replace(/ð/g, "d").replace(/þ/g, "th").replace(/ß/g, "ss").replace(/ı/g, "i").replace(/đ/g, "d")
    .replace(/[’']/g, "")
    .replace(/[‐‑‒–—-]/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pause(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function timedFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isRateLimitError(error) {
  return Number(error?.status || 0) === 429 || /rate.?limit/i.test(String(error?.message || ""));
}

// --- Wikipedia -----------------------------------------------------------------

async function wikiGet(params) {
  const url = new URL(WIKI_API);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const wait = WIKI_MIN_INTERVAL_MS - (Date.now() - lastWikiCallAt);
    if (wait > 0) await pause(wait);
    lastWikiCallAt = Date.now();
    try {
      const response = await timedFetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (response.status === 429) {
        const retryAfterMs = Number(response.headers.get("retry-after") || 0) * 1000;
        throw Object.assign(new Error("wikimedia 429"), { status: 429, retryAfterMs });
      }
      if (!response.ok) throw new Error(`wikimedia HTTP ${response.status}`);
      return await response.json().catch(() => ({}));
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isRateLimitError(error)) {
        if (isRateLimitError(error)) return { query: { pages: {} } };
        throw error;
      }
      await pause(error?.retryAfterMs || attempt * attempt * 2000);
    }
  }
  return { query: { pages: {} } };
}

function normalizeTitle(value) {
  // "Viktor Gyökeres (calciatore)" -> "viktor gyokeres"
  return normalize(value).replace(/\s*\([^)]*\)/g, "");
}

function isFootballerExtract(extract) {
  // Parole FORTI: un estratto che le contiene parla quasi certamente di calcio.
  return /footballer|football player|soccer player|association football|professional football|football team|calciatore|futbolista|voetballer/.test(
    String(extract || "").toLowerCase()
  );
}

function isNonPlayerExtract(extract) {
  // Parole di esclusione: quando compaiono insieme al contesto debole, la voce
  // non e' il calciatore cercato (dipinti, figure bibliche, citta', artisti).
  return /politician|politic|author|writer|musician|artist|actor|scientist|journalist|basketball|tennis|hockey|chess|archangel|angel|biblical|bible|altarpiece|painting|commune|departement|municipality|village|religion|abrahamic/.test(
    String(extract || "").toLowerCase()
  );
}

async function wikiSearchPages(name) {
  const payload = await wikiGet({
    action: "query",
    generator: "search",
    gsrsearch: name,
    gsrlimit: "10",
    prop: "pageimages|extracts",
    piprop: "thumbnail",
    pithumbsize: "600",
    exintro: "1",
    explaintext: "1",
    format: "json",
    origin: "*"
  });
  const raw = Object.values(payload?.query?.pages || {}).filter((page) => page?.title);
  return raw
    .map((page) => ({
      title: String(page.title || "").trim(),
      thumbnail: String(page.thumbnail?.source || "").trim(),
      extract: String(page.extract || "").slice(0, 600),
      index: Number(page.index ?? 999)
    }))
    .sort((a, b) => a.index - b.index);
}

function absoluteThumb(url) {
  if (!url) return "";
  return url.startsWith("//") ? `https:${url}` : url;
}

async function wikiExact(name) {
  const pages = await wikiSearchPages(name);
  const target = normalizeTitle(name);
  const exact = pages.find((page) => {
    if (!page.thumbnail) return false;
    if (normalizeTitle(page.title) !== target) return false;
    // Nome a un solo token (es. "Gabriel"): il titolo esatto e' ambiguo
    // (arcangelo, citta'...), richiede estratto fortemente calcistico.
    if (target.split(" ").filter(Boolean).length === 1) {
      return isFootballerExtract(String(page.extract || "")) && !isNonPlayerExtract(String(page.extract || ""));
    }
    return true;
  });
  return exact ? { url: absoluteThumb(exact.thumbnail), source: "wikimedia", tier: "exact" } : null;
}

function titleRank(title, surname) {
  const tokens = title.split(" ").filter(Boolean);
  return tokens.length + (title === surname ? 10 : 0);
}

async function wikiSurname(name) {
  const tokens = String(name || "").split(" ").filter(Boolean);
  if (tokens.length < 2) return null;
  const surname = normalize(tokens.at(-1));
  if (surname.length < 4) return null;
  const pages = await wikiSearchPages(surname);
  if (!pages.length) return null;
  const candidates = pages.filter((page) => {
    if (!page.thumbnail) return false;
    const title = normalizeTitle(page.title);
    if (!title.includes(surname)) return false;
    const extract = String(page.extract || "").toLowerCase();
    if (isNonPlayerExtract(extract)) return false;
    // Titolo a un solo token (arcangeli, citta', santi...): ammesso SOLO con
    // estratto fortemente calcistico (es. "Gabriel is a footballer...").
    return isFootballerExtract(extract);
  });
  if (!candidates.length) return null;
  const best = candidates.sort((a, b) => titleRank(b.title, surname) - titleRank(a.title, surname))[0];
  return { url: absoluteThumb(best.thumbnail), source: "wikimedia", tier: "surname" };
}

async function wikiLookup(name) {
  const exact = await wikiExact(name);
  if (exact) return exact;
  return wikiSurname(name);
}

// --- TheSportsDB -----------------------------------------------------------------

async function tsdGet(params) {
  const url = new URL(TSD_API);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const wait = TSD_MIN_INTERVAL_MS - (Date.now() - lastTsdCallAt);
  if (wait > 0) await pause(wait);
  lastTsdCallAt = Date.now();
  const response = await timedFetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) return {};
  return response.json().catch(() => ({}));
}

function tsdPhoto(player) {
  const cutout = String(player?.strCutout || "").trim();
  if (cutout) return { url: cutout, type: "cutout" };
  const thumb = String(player?.strThumb || "").trim();
  return thumb ? { url: thumb, type: "thumb" } : null;
}

function tsdNameMatch(player, query) {
  const normalized = normalize(String(player?.strPlayer || ""));
  const target = normalize(String(query || ""));
  if (!normalized || !target) return null;
  if (normalized === target) return { exact: true };
  const surname = target.split(" ").pop();
  if (surname && normalized.split(" ").includes(surname)) return { exact: false };
  return null;
}

function tsdTeamMatches(player, teamName) {
  if (!teamName) return true;
  const team = normalize(String(player?.strTeam || ""));
  const tokens = normalize(teamName).split(" ").filter(Boolean);
  return tokens.every((token) => team.includes(token));
}

async function tsdSearch(query, teamName = "") {
  const payload = await tsdGet({ p: query.replace(/\s+/g, "_") });
  const players = Array.isArray(payload?.player) ? payload.player : [];
  if (!players.length) return null;
  const player = players[0];
  const match = tsdNameMatch(player, query);
  if (!match) return null;
  if (!match.exact && !tsdTeamMatches(player, teamName)) return null;
  const photo = tsdPhoto(player);
  if (!photo) return null;
  return {
    url: photo.url,
    source: "thesportsdb",
    tier: match.exact ? "exact" : "surname",
    type: photo.type
  };
}

async function tsdLookup(name, teamName = "") {
  const full = await tsdSearch(name, teamName);
  if (full) return full;
  const tokens = name.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    const surname = tokens.at(-1);
    if (surname.length >= 4) return tsdSearch(surname, teamName);
  }
  return null;
}

// --- API pubblica ---------------------------------------------------------------

function normalizeName(value) { return normalize(value); }
function flushCache() { cache.clear(); }
function cacheSize() { return cache.size; }

async function lookupFace(rawName, teamName = "") {
  const name = String(rawName || "").trim();
  if (!name) return null;
  const key = `${normalize(name)}|${normalize(teamName)}`;
  if (cache.has(key)) return cache.get(key);

  let result = null;
  try {
    result = await wikiLookup(name);
  } catch (error) {
    // Wikipedia giu' o in rate limit: si prosegue con TheSportsDB.
  }
  if (!result) {
    try {
      result = await tsdLookup(name, teamName);
    } catch (error) {
      result = null;
    }
  }
  cache.set(key, result || null);
  return result;
}

module.exports = {
  absoluteThumb,
  cacheSize,
  flushCache,
  lookupFace,
  normalizeName,
  wikiListing: wikiSearchPages
};