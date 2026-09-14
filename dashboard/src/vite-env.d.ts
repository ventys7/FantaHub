/// <reference types="vite/client" />

type LeagueAsset = {
  assetCode: string;
  displayName: string;
  docsName: string;
  role: "P" | "D" | "C" | "A" | string;
  realTeam: string;
  quotation: number;
  purchasePrice?: number;
  ownerTag: string | null;
  managerCredits?: number | null;
  type: string;
  active: boolean;
  isFreeAgent: boolean;
  isExtra?: boolean;
};

type LeagueDataState = {
  status: "idle" | "loading" | "ready" | "error";
  error?: unknown;
};

type LineupLeague = {
  id: "fp" | "pd";
  name: string;
  label: string;
  csvUrl: string;
  extraSlots?: boolean;
  identity?: {
    logo?: string;
    flag?: string;
    color?: string;
  };
  leagueData?: {
    teamProfilesUrl?: string;
    standingsCsvUrl?: string;
    standingsFallbackUrl?: string;
  };
};

declare global {
  interface Window {
    LineupKickoffClubs?: Record<string, { name: string; teamId: string; crestUrl: string }>;
    showToast?: (message: string, type?: "error" | "success") => void;
    LineupClubKeys?: { normalize: (value: string) => string; key: (value: string) => string };
    LineupPlayerMedia?: {
      load: (leagueId: string, assets: LeagueAsset[]) => Promise<void> | void;
      payload: (leagueId?: string) => { players: Record<string, any> };
      player: (name: string, team: string, leagueId?: string) => any;
      photo: (name: string, team: string, leagueId?: string) => string;
      storyPhoto: (name: string, team: string, leagueId?: string) => string;
      crest: (team: string) => string;
      playerKey: (name: string, team: string) => string;
    };
    LINEUP_FANTA?: {
      league?: LineupLeague;
    };
    LineupLeagueData?: {
      getState?: () => LeagueDataState;
      getAssets?: () => LeagueAsset[];
    };
  }

  interface DocumentEventMap {
    "lineup:league-assets-ready": CustomEvent<{
      leagueId: string;
      assets: LeagueAsset[];
      state: LeagueDataState;
    }>;
  }
}

export {};
