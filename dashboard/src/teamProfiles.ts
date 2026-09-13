export type TeamProfile = {
  credits: number | null;
  logoUrl: string;
  displayName: string;
};

export type TeamProfiles = Record<string, TeamProfile>;

export function normalizeSearchText(value: string): string {
  return value
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

export const normalizeTeamName = normalizeSearchText;

type RawTeamProfile = {
  credits?: unknown;
  logoUrl?: unknown;
  logo_url?: unknown;
  displayName?: unknown;
};

type RawProfilesDocument = {
  teams?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCredits(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeProfiles(document: unknown): TeamProfiles {
  if (!isObject(document)) return {};

  const root = isObject((document as RawProfilesDocument).teams)
    ? (document as RawProfilesDocument).teams as Record<string, unknown>
    : document;

  return Object.entries(root).reduce<TeamProfiles>((profiles, [managerName, rawProfile]) => {
    if (!isObject(rawProfile)) return profiles;
    const profile = rawProfile as RawTeamProfile;
    const rawLogo = profile.logoUrl ?? profile.logo_url;

    profiles[managerName] = {
      credits: normalizeCredits(profile.credits),
      logoUrl: typeof rawLogo === "string" ? rawLogo.trim() : "",
      displayName: typeof profile.displayName === "string" ? profile.displayName.trim() : ""
    };

    return profiles;
  }, {});
}

export async function loadTeamProfiles(leagueId: string, configuredUrl?: string): Promise<TeamProfiles> {
  if (!leagueId) return {};

  try {
    const response = await fetch(`/api/settings?league=${encodeURIComponent(leagueId)}&_lf=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, max-age=0", "Pragma": "no-cache" }
    });
    if (response.ok) {
      const payload = await response.json();
      return normalizeProfiles({ teams: payload.teams });
    }
  } catch {}

  const baseUrl = configuredUrl || `/data/${encodeURIComponent(leagueId)}/teams.json`;
  const separator = baseUrl.includes("?") ? "&" : "?";
  const url = `${baseUrl}${separator}_lf=${Date.now()}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, max-age=0", "Pragma": "no-cache" }
  });
  if (response.status === 404) return {};
  if (!response.ok) throw new Error(`Impossibile caricare i profili rose: HTTP ${response.status}`);
  return normalizeProfiles(await response.json());
}
