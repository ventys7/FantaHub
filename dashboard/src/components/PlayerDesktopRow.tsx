import { memo } from "react";
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from "../constants";
import type { PlayerMediaEntry } from "../media";
import type { DashboardAsset } from "../types";

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"; }

export const PlayerDesktopRow = memo(function PlayerDesktopRow({ player, media, crestUrl }: { player: DashboardAsset; media?: PlayerMediaEntry | null; crestUrl?: string }) {
  return (
    <div className="lf-list-row tw-group tw-grid tw-grid-cols-12 tw-gap-4 tw-px-6 tw-py-4 tw-transition hover:tw-bg-slate-50">
      <div className="tw-col-span-4 tw-flex tw-min-w-0 tw-items-center tw-gap-3">
        <div className={`lf-player-avatar ${media?.photoUrl ? "has-photo" : ""}`} aria-hidden="true">
          {media?.photoUrl ? <img src={media.photoUrl} alt="" loading="lazy" decoding="async" /> : initials(player.displayName)}
        </div>
        <div className="tw-min-w-0">
          <div className="tw-flex tw-items-center tw-gap-2">
            <span className={`tw-truncate tw-font-semibold tw-transition group-hover:tw-text-[var(--primary)] ${player.active ? "tw-text-slate-900" : "tw-italic tw-text-slate-400"}`}>{player.displayName}{!player.active && " *"}</span>
            {player.isExtra && (
              <span className="tw-inline-flex tw-shrink-0 tw-items-center tw-rounded-full tw-border tw-border-[var(--primary-border)] tw-bg-[var(--primary-bg)] tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-black tw-uppercase tw-tracking-wide tw-text-[var(--primary)]">Extra</span>
            )}
          </div>
          <div className="lf-player-club-line">{crestUrl && <img src={crestUrl} alt="" loading="lazy" decoding="async" />}<span>{player.realTeam || "—"}</span></div>
        </div>
      </div>
      <div className="tw-col-span-2 tw-flex tw-items-center"><span className={ROLE_BADGE_CLASSES[player.role] ?? ROLE_BADGE_CLASSES.U}>{ROLE_LABELS[player.role] ?? "?"}</span></div>
      <div className="tw-col-span-2 tw-flex tw-items-center tw-justify-center"><span className="tw-text-xl tw-font-black tw-text-slate-900">{player.quotation || "—"}</span></div>
      <div className="tw-col-span-2 tw-flex tw-items-center tw-justify-center"><span className={player.purchasePrice ? "tw-text-lg tw-font-bold tw-text-[var(--primary)]" : "tw-text-slate-400"}>{player.purchasePrice || "—"}</span></div>
      <div className="tw-col-span-2 tw-flex tw-items-center tw-min-w-0"><span className={`tw-truncate tw-text-sm ${player.ownerTag ? "tw-text-slate-600" : "tw-italic tw-text-slate-400"}`}>{player.ownerTag || "Svincolato"}</span></div>
    </div>
  );
});
