(function exposePlayerMedia(global) {
  "use strict";

  const CACHE_VERSION = 13;
  const KICKOFF_CREST_ORIGIN = "https://kick-off-tau.vercel.app";
  const KICKOFF_TEAM_ID_FALLBACKS = Object.freeze({ "nottm forest": "351" });
  const memory = new Map();
  const networkRequests = new Map();
  const revalidated = new Set();
  let assets = [];
  let currentLeague = "";
  let kickoffClubs = global.LineupKickoffClubs || {};

  function normalize(value) {
    return global.LineupClubKeys?.normalize(value) || String(value || "").toLowerCase().trim();
  }

  function clubKey(value) {
    return global.LineupClubKeys?.key(value) || normalize(value);
  }

  function playerKey(name, team) {
    return `${normalize(name)}|${clubKey(team)}`;
  }

  function cacheKey(leagueId) {
    return `lineup-fanta-player-media-v${CACHE_VERSION}:${leagueId}`;
  }

  function readCache(leagueId) {
    try {
      const parsed = JSON.parse(localStorage.getItem(cacheKey(leagueId)) || "null");
      if (!parsed || parsed.version !== CACHE_VERSION || !parsed.payload) return null;
      return parsed;
    } catch { return null; }
  }

  function writeCache(leagueId, payload) {
    try {
      localStorage.setItem(cacheKey(leagueId), JSON.stringify({ version: CACHE_VERSION, savedAt: Date.now(), payload }));
    } catch {}
  }

  function publish(leagueId, payload) {
    if (!leagueId || !payload) return;
    memory.set(leagueId, payload);
    writeCache(leagueId, payload);
    global.dispatchEvent(new CustomEvent("lineup:player-media-ready", { detail: { leagueId, payload } }));
  }

  async function fetchManifest(leagueId, force = false) {
    if (!force && revalidated.has(leagueId)) return memory.get(leagueId) || readCache(leagueId)?.payload || { players: {} };
    if (!force && networkRequests.has(leagueId)) return networkRequests.get(leagueId);
    const request = fetch(`/api/player-media?league=${encodeURIComponent(leagueId)}&cv=${CACHE_VERSION}`, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    }).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      publish(leagueId, payload);
      revalidated.add(leagueId);
      return payload;
    }).finally(() => networkRequests.delete(leagueId));
    networkRequests.set(leagueId, request);
    return request;
  }

  async function requestManifest(leagueId, { force = false } = {}) {
    const cached = readCache(leagueId);
    if (cached && !force) {
      publish(leagueId, cached.payload);
      // Render immediately from localStorage, then refresh the small JSON once
      // in the background. BSD serves player images directly; browser caching and lazy loading avoid downloading the full Listone at once.
      void fetchManifest(leagueId, false).catch(() => {});
      return cached.payload;
    }
    return fetchManifest(leagueId, force);
  }

  async function load(leagueId, list) {
    currentLeague = String(leagueId || "").toLowerCase();
    assets = Array.isArray(list) ? list : [];
    if (!currentLeague || !assets.length) return;
    try {
      await requestManifest(currentLeague);
    } catch {
      const cached = readCache(currentLeague);
      if (cached?.payload) publish(currentLeague, cached.payload);
    }
  }

  function payloadFor(leagueId = currentLeague) {
    return memory.get(leagueId) || readCache(leagueId)?.payload || { players: {} };
  }

  function player(name, team, leagueId = currentLeague) {
    return payloadFor(leagueId)?.players?.[playerKey(name, team)] || null;
  }

  function photo(name, team, leagueId = currentLeague) {
    const entry = player(name, team, leagueId);
    return entry?.photoUrl || entry?.fallbackPhotoUrl || "";
  }

  function storyPhoto(name, team, leagueId = currentLeague) {
    const entry = player(name, team, leagueId);
    const id = String(entry?.externalId || "").trim();
    return /^\d+$/.test(id) ? `/api/player-photo?id=${encodeURIComponent(id)}` : "";
  }

  function guardPhoto(image, { fallbackText = "", mediaNode = null, onError = null } = {}) {
    if (!image || typeof image.addEventListener !== "function") return image;
    let used = false;
    image.addEventListener("error", () => {
      if (used) return;
      used = true;
      image.hidden = true;
      if (typeof onError === "function") { onError(image); return; }
      if (mediaNode) {
        mediaNode.hidden = false;
        mediaNode.removeAttribute("hidden");
        if (fallbackText) mediaNode.textContent = fallbackText;
      }
    });
    return image;
  }

  function crest(team) {
    const target = clubKey(team);
    if (!target) return "";
    if (kickoffClubs[target]?.crestUrl) return kickoffClubs[target].crestUrl;

    const targetTokens = new Set(target.split(" ").filter((token) => token.length > 2 && token !== "real"));
    let best = null;
    let bestScore = 0;
    Object.entries(kickoffClubs).forEach(([key, value]) => {
      const candidate = clubKey(key || value?.name);
      if (!candidate) return;
      if (candidate === target || candidate.includes(target) || target.includes(candidate)) {
        best = value;
        bestScore = 100;
        return;
      }
      const candidateTokens = new Set(candidate.split(" ").filter((token) => token.length > 2 && token !== "real"));
      const common = [...targetTokens].filter((token) => candidateTokens.has(token)).length;
      const score = common * 10 - Math.abs(targetTokens.size - candidateTokens.size);
      if (score > bestScore) { bestScore = score; best = value; }
    });
    if (bestScore >= 9 && best?.crestUrl) return best.crestUrl;
    const fallbackId = KICKOFF_TEAM_ID_FALLBACKS[target];
    return fallbackId ? `${KICKOFF_CREST_ORIGIN}/api/crest/${fallbackId}` : "";
  }

  global.LineupPlayerMedia = Object.freeze({ clubKey, guardPhoto, load, payload: payloadFor, photo, storyPhoto, player, playerKey, crest });

  document.addEventListener("lineup:league-assets-ready", (event) => {
    const detail = event.detail || {};
    if (detail.state?.status === "ready") load(detail.leagueId, detail.assets);
  });

  global.addEventListener("lineup:kickoff-clubs-ready", (event) => {
    kickoffClubs = event.detail?.clubs || {};
    global.dispatchEvent(new CustomEvent("lineup:player-media-ready", { detail: { leagueId: currentLeague, payload: payloadFor() } }));
  });
})(window);
