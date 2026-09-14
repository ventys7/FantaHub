const csvLog = window.LineupDebug?.logger("csv") ?? console;
const { parseLeagueCsv } = window.LineupCsvParser;
const { buildFormationDb } = window.LineupFormationDb;

let db = {};
let leagueAssets = [];
let leagueCsvState = Object.freeze({ status: "idle", error: null, loadedAt: null });
let leagueCsvRequest = null;

window.LineupLeagueData = Object.freeze({
  getAssets: () => leagueAssets.slice(),
  getState: () => ({ ...leagueCsvState }),
  refresh: () => loadCSV({ silent: true })
});

// React-owned formation reads the shared team DB (lexical `db` is not on window).
window.LineupDb = Object.freeze({ get: () => db });

function updateLeagueCsvState(status, error = null) {
  leagueCsvState = Object.freeze({
    status,
    error: error ? String(error.message || error) : null,
    loadedAt: status === "ready" ? new Date().toISOString() : leagueCsvState.loadedAt
  });
}

function dispatchLeagueAssetsReady() {
  document.dispatchEvent(new CustomEvent("lineup:league-assets-ready", {
    detail: {
      leagueId: window.LINEUP_FANTA?.league?.id || null,
      assets: leagueAssets.slice(),
      state: { ...leagueCsvState }
    }
  }));
}

async function getCsvRequestUrl() {
  const runtime = await window.LineupRuntimeSettings?.get(window.LINEUP_FANTA?.leagueId);
  const csvBaseUrl = runtime?.listoneCsvUrl || window.LINEUP_FANTA?.league?.csvUrl || "";
  if (!csvBaseUrl) throw new Error("CSV non configurato");
  const url = new URL(csvBaseUrl, window.location.href);
  url.searchParams.set("_lf", String(Date.now()));
  return url.toString();
}

async function requestCsv() {
  const response = await fetch(await getCsvRequestUrl(), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, max-age=0",
      "Pragma": "no-cache"
    }
  });
  if (!response.ok) throw new Error(`CSV request failed (${response.status})`);

  const text = await response.text();
  if (/^\s*<!doctype html/i.test(text)) throw new Error("Risposta CSV non valida");
  return text;
}

async function loadCSV(options = {}) {
  const silent = Boolean(options.silent);
  if (leagueCsvRequest) return leagueCsvRequest;

  leagueCsvRequest = (async () => {
    try {
      if (!(silent && leagueCsvState.status === "ready")) updateLeagueCsvState("loading");

      const { assets } = parseLeagueCsv(await requestCsv(), {
        extraSlots: Boolean(window.LINEUP_FANTA?.league?.extraSlots)
      });
      leagueAssets = assets;
      db = buildFormationDb(assets);
      updateLeagueCsvState("ready");
      dispatchLeagueAssetsReady();
      populateManagers();

      const restoredDraft = window.LineupPersistence?.restoreAfterCsv?.();
      if (!restoredDraft) {
        renderFormation();
        if (isMobile && typeof renderMobileSlots === "function") renderMobileSlots();
        if (typeof updateSwitchUI === "function") setTimeout(updateSwitchUI, 100);
      }
      csvLog.debug?.("loaded", { assets: assets.length, managers: Object.keys(db).length });
    } catch (error) {
      csvLog.error?.("load failed", error);

      if (silent && leagueAssets.length > 0) {
        csvLog.warn?.("refresh failed; keeping last valid data");
        return;
      }

      updateLeagueCsvState("error", error);
      dispatchLeagueAssetsReady();
      const managerSelect = document.getElementById("managerSelect");
      if (managerSelect) managerSelect.innerHTML = "<option>Errore caricamento</option>";
      if (!silent) showToast("Errore caricamento CSV", "error");
      throw error;
    } finally {
      leagueCsvRequest = null;
    }
  })();

  return leagueCsvRequest;
}

function populateManagers() {
  const select = document.getElementById("managerSelect");
  if (!select) return;

  const previousValue = select.value;
  const names = Object.keys(db).sort((left, right) => left.localeCompare(right, "it"));
  select.replaceChildren(new Option("Seleziona squadra...", ""));
  names.forEach((name) => select.add(new Option(name, name)));
  if (previousValue && names.includes(previousValue)) select.value = previousValue;
  select.onchange = loadTeam;
}

(function setupLiveCsvRefresh() {
  const watchedSections = new Set(["formation", "listone", "rose"]);
  let lastRefreshAt = 0;

  function currentSection() {
    return document.documentElement.dataset.leagueSection || "formation";
  }

  function refreshIfNeeded(force = false) {
    if (!watchedSections.has(currentSection())) return;
    const now = Date.now();
    if (!force && now - lastRefreshAt < 15_000) return;
    lastRefreshAt = now;
    loadCSV({ silent: true }).catch((error) => csvLog.warn?.("live refresh failed", error));
  }

  window.addEventListener("lineup:league-section-change", (event) => {
    if (watchedSections.has(event.detail?.section)) refreshIfNeeded(true);
  });
  window.addEventListener("focus", () => refreshIfNeeded());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshIfNeeded();
  });
  window.setInterval(() => {
    if (!document.hidden) refreshIfNeeded(true);
  }, 30_000);
})();
