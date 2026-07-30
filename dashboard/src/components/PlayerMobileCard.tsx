import { memo } from "react";
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from "../constants";
import type { PlayerMediaEntry } from "../media";
import type { DashboardAsset } from "../types";

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"; }

export const PlayerMobileCard = memo(function PlayerMobileCard({ player, media, crestUrl }: { player: DashboardAsset; media?: PlayerMediaEntry | null; crestUrl?: string }) {
  return (
    <article className="tw-p-3 tw-transition hover:tw-bg-slate-50">
      <div className="tw-flex tw-items-start tw-gap-3">
        <div className={`lf-player-avatar lf-player-avatar--mobile ${media?.photoUrl ? "has-photo" : ""}`} aria-hidden="true">
          {media?.photoUrl ? <img src={media.photoUrl} alt="" loading="lazy" decoding="async" /> : initials(player.displayName)}
        </div>
        <div className="tw-min-w-0 tw-flex-1">
          <div className="tw-mb-1 tw-flex tw-items-center tw-justify-between tw-gap-2">
            <span className={`tw-min-w-0 tw-truncate tw-font-semibold ${player.active ? "tw-text-slate-900" : "tw-italic tw-text-slate-400"}`}>{player.displayName}{!player.active && " *"}</span>
            <span className={`${ROLE_BADGE_CLASSES[player.role] ?? ROLE_BADGE_CLASSES.U} tw-shrink-0`}>{ROLE_LABELS[player.role] ?? player.role ?? "?"}</span>
          </div>
          <div className="lf-player-club-line lf-player-club-line--mobile">
            {crestUrl && <img src={crestUrl} alt="" loading="lazy" decoding="async" />}
            <span>{player.realTeam || "—"}</span>
          </div>
          <div className="tw-mt-1 tw-flex tw-flex-wrap tw-items-center tw-gap-x-4 tw-gap-y-0.5 tw-text-xs">
            <span><span className="tw-text-slate-400">Quot:</span> <strong className="tw-text-slate-900">{player.quotation || "—"}</strong></span>
            <span><span className="tw-text-slate-400">Acq:</span> <strong className="tw-text-[var(--primary)]">{player.purchasePrice || "—"}</strong></span>
          </div>
          <div className="tw-mt-1 tw-text-sm">
            <span className={`tw-max-w-full tw-truncate ${player.ownerTag ? "tw-text-slate-500" : "tw-italic tw-text-slate-400"}`}>👤 {player.ownerTag || "Svincolato"}</span>
          </div>
        </div>
      </div>
    </article>
  );
});
