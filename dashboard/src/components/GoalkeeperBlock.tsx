import { memo } from "react";
import { ChevronDownIcon, ShieldIcon } from "../icons";
import type { PlayerMediaEntry } from "../media";
import type { DashboardAsset } from "../types";

function splitGoalkeepers(name: string) {
  return name.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
}

type Props = {
  asset: DashboardAsset;
  expanded: boolean;
  onToggle: () => void;
  crestUrl?: string;
  media: { player: (name: string, team: string) => PlayerMediaEntry | null };
};

export const GoalkeeperBlock = memo(function GoalkeeperBlock({ asset, expanded, onToggle, crestUrl, media }: Props) {
  const players = splitGoalkeepers(asset.displayName);

  return (
    <div className="lf-list-row">
      <button type="button" onClick={onToggle} className="tw-hidden tw-w-full tw-grid-cols-12 tw-gap-4 tw-px-6 tw-py-4 tw-text-left tw-transition hover:tw-bg-slate-50 md:tw-grid">
        <div className="tw-col-span-4 tw-flex tw-min-w-0 tw-items-center tw-gap-3">
          <div className={`lf-player-avatar ${crestUrl ? "has-photo lf-player-avatar--crest" : ""}`}>{crestUrl ? <img src={crestUrl} alt="" loading="lazy" decoding="async" /> : <ShieldIcon size={22} />}</div>
          <div className="tw-min-w-0">
            <div className="tw-truncate tw-font-semibold tw-text-slate-900">Blocco {asset.realTeam || asset.displayName}</div>
            <div className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-slate-500">
              {players.length} portieri
              <ChevronDownIcon size={15} className={`tw-transition ${expanded ? "tw-rotate-180" : ""}`} />
            </div>
          </div>
        </div>
        <div className="tw-col-span-2 tw-flex tw-items-center"><span className="lf-role-badge lf-role-badge--p">Portiere</span></div>
        <div className="tw-col-span-2 tw-flex tw-items-center tw-justify-center tw-text-xl tw-font-black tw-text-slate-900">{asset.quotation || "—"}</div>
        <div className="tw-col-span-2 tw-flex tw-items-center tw-justify-center tw-text-lg tw-font-bold tw-text-[var(--primary)]">{asset.purchasePrice || "—"}</div>
        <div className={`tw-col-span-2 tw-flex tw-items-center tw-truncate tw-text-sm ${asset.ownerTag ? "tw-text-slate-600" : "tw-italic tw-text-slate-400"}`}>{asset.ownerTag || "Svincolato"}</div>
      </button>

      <button type="button" onClick={onToggle} className="tw-flex tw-w-full tw-items-start tw-gap-3 tw-p-3 tw-text-left tw-transition hover:tw-bg-slate-50 md:tw-hidden">
        <div className={`lf-player-avatar lf-player-avatar--mobile ${crestUrl ? "has-photo lf-player-avatar--crest" : ""}`}>{crestUrl ? <img src={crestUrl} alt="" loading="lazy" decoding="async" /> : <ShieldIcon size={22} />}</div>
        <div className="tw-min-w-0 tw-flex-1">
          <div className="tw-mb-1 tw-flex tw-items-center tw-justify-between tw-gap-2">
            <strong className="tw-min-w-0 tw-truncate tw-text-slate-900">Blocco {asset.realTeam || asset.displayName}</strong>
            <span className="lf-role-badge lf-role-badge--p tw-shrink-0">Portiere</span>
          </div>
          <div className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-slate-500">{players.length} portieri <ChevronDownIcon size={14} className={`tw-transition ${expanded ? "tw-rotate-180" : ""}`} /></div>
          <div className="tw-mt-1 tw-flex tw-flex-wrap tw-gap-x-4 tw-gap-y-0.5 tw-text-xs">
            <span><span className="tw-text-slate-400">Quot:</span> <strong>{asset.quotation || "—"}</strong></span>
            <span><span className="tw-text-slate-400">Acq:</span> <strong className="tw-text-[var(--primary)]">{asset.purchasePrice || "—"}</strong></span>
          </div>
          <div className="tw-mt-1 tw-text-sm">
            <span className={`tw-truncate ${asset.ownerTag ? "tw-text-slate-500" : "tw-italic tw-text-slate-400"}`}>👤 {asset.ownerTag || "Svincolato"}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="lf-block-expanded">
          {players.map((player) => {
            const photo = media.player(player, asset.realTeam)?.photoUrl;
            return (
              <div key={player} className="tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-3 md:tw-px-6">
                <div className={`lf-mini-avatar ${photo ? "has-photo" : ""}`}>
                  {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : "P"}
                </div>
                <div className="tw-min-w-0"><div className="tw-truncate tw-font-medium tw-text-slate-800">{player}</div><div className="tw-text-xs tw-text-slate-500">{asset.realTeam || "Portiere"}</div></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
