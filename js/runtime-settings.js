/* Runtime URLs configured from the minimal admin panel, with static fallbacks. */
window.LineupRuntimeSettings = (function () {
  const cache = new Map();

  async function get(leagueId) {
    const id = String(leagueId || window.LINEUP_FANTA?.leagueId || "").toLowerCase();
    if (!id) return null;
    if (cache.has(id)) return cache.get(id);

    const request = fetch(`/api/settings?league=${encodeURIComponent(id)}&_lf=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" }
    }).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).catch(() => {
      cache.delete(id);
      const league = window.LINEUP_LEAGUES?.[id];
      return {
        leagueId: id,
        listoneCsvUrl: league?.csvUrl || "",
        standingsCsvUrl: league?.leagueData?.standingsCsvUrl || "",
        disciplineDocUrl: "",
        regolamentoDocUrl: league?.leagueData?.regolamentoDocUrl || "",
        calendarioDocUrl: league?.leagueData?.calendarioDocUrl || "",
        teams: {}
      };
    });

    cache.set(id, request);
    return request;
  }

  function clear(leagueId) {
    if (leagueId) cache.delete(String(leagueId).toLowerCase());
    else cache.clear();
  }

  return Object.freeze({ clear, get });
})();
