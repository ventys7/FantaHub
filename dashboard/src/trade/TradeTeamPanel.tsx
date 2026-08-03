import { useState } from "react";
import { ROLE_ORDER } from "../constants";
import { ShieldIcon } from "../icons";
import type { PlayerMediaEntry } from "../media";
import type { DashboardAsset } from "../types";
import { isGoalkeeperBlock } from "./tradeModel";

export type PlayerMedia = {
  player: (name: string, team: string) => PlayerMediaEntry | null;
  crest: (team: string) => string;
};

type Props = {
  managerName: string;
  assets: readonly DashboardAsset[];
  selected: ReadonlySet<string>;
  onToggle: (assetCode: string) => void;
  media: PlayerMedia;
};

const FILTERS = ["Tutti", "P", "D", "C", "A"] as const;
type Filter = (typeof FILTERS)[number];

function splitGoalkeepers(name: string) {
  return name.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function PlayerAvatar({ name, team, role, media }: {
  name: string; team: string; role: string; media: PlayerMedia;
}) {
  const photo = media.player(name, team)?.photoUrl;
  return (
    <span className={`lf-squad-avatar lf-squad-avatar--${role.toLowerCase()} ${photo ? "has-photo" : ""}`} aria-hidden="true">
      {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : initials(name)}
    </span>
  );
}

export function TradeTeamPanel({ managerName, assets, selected, onToggle, media }: Props) {
  const [filter, setFilter] = useState<Filter>("Tutti");

  const rows = assets
    .filter((asset) => filter === "Tutti" || asset.role === filter)
    .sort((a, b) => {
      const roleDiff = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
      if (roleDiff !== 0) return roleDiff;
      const priceDiff = b.purchasePrice - a.purchasePrice;
      if (priceDiff !== 0) return priceDiff;
      return a.displayName.localeCompare(b.displayName, "it");
    });

  return (
    <section className="lf-trade-panel" aria-label={`Rosa di ${managerName}`}>
      <header className="lf-trade-panel__header">
        <h2>{managerName}</h2>
        <span className={`lf-trade-count ${selected.size > 0 ? "is-selected" : ""}`}>
          {selected.size > 0 ? `${selected.size} selezionati` : "Nessuna selezione"}
        </span>
      </header>

      <div className="lf-trade-filters" role="group" aria-label="Filtra per ruolo">
        {FILTERS.map((label) => (
          <button
            key={label}
            type="button"
            className={`lf-trade-filter ${filter === label ? "is-active" : ""}`}
            onClick={() => setFilter(label)}
            aria-pressed={filter === label}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="lf-squad-empty">—</div>
      ) : (
        <ul className="lf-trade-list">
          {rows.map((asset) => {
            const isBlock = isGoalkeeperBlock(asset);
            const isSelected = selected.has(asset.assetCode);
            const crest = media.crest(asset.realTeam);

            return (
              <li key={asset.assetCode}>
                <button
                  type="button"
                  className={`lf-trade-row ${isSelected ? "is-selected" : ""}`}
                  onClick={() => onToggle(asset.assetCode)}
                  aria-pressed={isSelected}
                >
                  <span className={`lf-trade-check ${isSelected ? "is-checked" : ""}`} aria-hidden="true">
                    {isSelected ? "✓" : ""}
                  </span>
                  {isBlock ? (
                    <span className={`lf-squad-block-crest ${crest ? "has-crest" : ""}`} aria-hidden="true">
                      {crest ? <img src={crest} alt="" loading="lazy" decoding="async" /> : <ShieldIcon size={17} />}
                    </span>
                  ) : (
                    <PlayerAvatar name={asset.displayName} team={asset.realTeam} role={asset.role} media={media} />
                  )}
                  <span className="lf-trade-row__copy">
                    <span className="lf-squad-item__name">
                      {isBlock ? `Blocco ${asset.realTeam || asset.displayName}` : asset.displayName}
                      {!asset.active && " *"}
                    </span>
                    <span className="lf-squad-item__team">
                      {isBlock ? `${splitGoalkeepers(asset.displayName).length} portieri` : (asset.realTeam || "—")}
                    </span>
                  </span>
                  <span className="lf-squad-values">
                    <span><small>Q</small><strong>{asset.quotation || "—"}</strong></span>
                    <span><small>P</small><strong className="lf-squad-price">{asset.purchasePrice || "—"}</strong></span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
