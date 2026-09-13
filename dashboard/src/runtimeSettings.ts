export type RuntimeLeagueSettings = {
  leagueId: string;
  listoneCsvUrl: string;
  standingsCsvUrl: string;
  disciplineDocUrl: string;
  teams: Record<string, { credits?: number | null; logoUrl?: string; displayName?: string }>;
};

const cache = new Map<string, Promise<RuntimeLeagueSettings>>();

export function loadRuntimeLeagueSettings(leagueId: string): Promise<RuntimeLeagueSettings> {
  const id = String(leagueId || "").toLowerCase();
  if (!id) return Promise.reject(new Error("Lega non disponibile"));
  const existing = cache.get(id);
  if (existing) return existing;

  const league = window.LINEUP_FANTA?.league;
  const request = fetch(`/api/settings?league=${encodeURIComponent(id)}&_lf=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" }
  }).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<RuntimeLeagueSettings>;
  }).catch(() => {
    cache.delete(id);
    return {
      leagueId: id,
      listoneCsvUrl: league?.csvUrl ?? "",
      standingsCsvUrl: league?.leagueData?.standingsCsvUrl ?? "",
      disciplineDocUrl: "",
      teams: {}
    };
  });

  cache.set(id, request);
  return request;
}

export function clearRuntimeSettingsCache(leagueId?: string) {
  if (leagueId) cache.delete(leagueId.toLowerCase());
  else cache.clear();
}
