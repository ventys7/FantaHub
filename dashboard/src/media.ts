import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardAsset } from "./types";

export type PlayerMediaEntry = {
  key: string;
  listoneName: string;
  realTeam: string;
  status: "resolved" | "unresolved";
  photoUrl?: string;
  externalName?: string;
};

export type MediaPayload = {
  players: Record<string, PlayerMediaEntry>;
  summary?: { resolved?: number; unresolved?: number };
};

function emptyPayload(): MediaPayload { return { players: {} }; }

export function clubKey(value: string) {
  return window.LineupClubKeys?.key(value) || String(value || "").toLowerCase().trim();
}

export function playerMediaKey(name: string, team: string) {
  return window.LineupPlayerMedia?.playerKey(name, team)
    || `${String(name || "").toLowerCase().trim()}|${clubKey(team)}`;
}

export function usePlayerMedia(assets: DashboardAsset[], leagueId: string) {
  const [payload, setPayload] = useState<MediaPayload>(() => window.LineupPlayerMedia?.payload(leagueId) || emptyPayload());
  const [crestVersion, setCrestVersion] = useState(0);
  const assetFingerprint = useMemo(() => assets.map((asset) => `${asset.displayName}|${asset.realTeam}|${asset.type}`).join("\n"), [assets]);

  useEffect(() => {
    if (!leagueId || !assets.length) return;
    window.LineupPlayerMedia?.load(leagueId, assets);
    const current = window.LineupPlayerMedia?.payload(leagueId);
    if (current) setPayload(current);
  }, [assetFingerprint, assets, leagueId]);

  useEffect(() => {
    const onMedia = (event: Event) => {
      const detail = (event as CustomEvent<{ leagueId: string; payload: MediaPayload }>).detail;
      if (detail?.leagueId === leagueId) setPayload(detail.payload || emptyPayload());
    };
    const clubsTimer = { current: 0 };
    const onClubs = () => {
      if (clubsTimer.current) return;
      clubsTimer.current = window.setTimeout(() => {
        clubsTimer.current = 0;
        setCrestVersion((value) => value + 1);
      }, 120);
    };
    window.addEventListener("lineup:player-media-ready", onMedia as EventListener);
    window.addEventListener("lineup:kickoff-clubs-ready", onClubs as EventListener);
    return () => {
      window.removeEventListener("lineup:player-media-ready", onMedia as EventListener);
      window.removeEventListener("lineup:kickoff-clubs-ready", onClubs as EventListener);
      window.clearTimeout(clubsTimer.current);
    };
  }, [leagueId]);

  const player = useMemo(() =>
    (name: string, team: string) =>
      payload.players[playerMediaKey(name, team)] || window.LineupPlayerMedia?.player(name, team, leagueId) || null,
    [payload, leagueId]
  );

  const crest = useMemo(() =>
    (team: string) => {
      void crestVersion;
      return window.LineupPlayerMedia?.crest(team) || "";
    },
    [crestVersion]
  );

  return useMemo(() => ({ player, crest }), [player, crest]);
}
