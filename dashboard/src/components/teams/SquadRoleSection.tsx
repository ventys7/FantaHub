import { useState } from "react";
import { ChevronDownIcon, ShieldIcon } from "../../icons";
import type { PlayerMediaEntry } from "../../media";
import type { DashboardAsset } from "../../types";
import type { RoleKey } from "./types";

type Props = {
  players: DashboardAsset[];
  role: RoleKey;
  label: string;
  media: {
    player: (name: string, team: string) => PlayerMediaEntry | null;
    crest: (team: string) => string;
  };
  /** Modalità "selezionabile" usata dallo Scambi: ogni riga diventa un bottone con check. */
  selectable?: boolean;
  selectedCodes?: ReadonlySet<string>;
  onToggleSelect?: (assetCode: string) => void;
};

function splitGoalkeepers(name: string) {
  return name.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function PlayerAvatar({ name, team, role, media }: {
  name: string; team: string; role: RoleKey; media: Props["media"];
}) {
  const photo = media.player(name, team)?.photoUrl;
  return (
    <div className={`lf-squad-avatar lf-squad-avatar--${role.toLowerCase()} ${photo ? "has-photo" : ""}`} aria-hidden="true">
      {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : initials(name)}
    </div>
  );
}

function SelectionCheck({ selected }: { selected: boolean }) {
  return (
    <span className={`lf-squad-check ${selected ? "is-checked" : ""}`} aria-hidden="true">
      {selected ? "✓" : ""}
    </span>
  );
}

export function SquadRoleSection({ players, role, label, media, selectable = false, selectedCodes, onToggleSelect }: Props) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const rolePlayers = players.filter((player) => player.role === role).sort((a, b) => {
    const priceDiff = b.purchasePrice - a.purchasePrice;
    if (priceDiff !== 0) return priceDiff;
    return a.displayName.localeCompare(b.displayName, "it");
  });

  const toggleBlock = (assetCode: string) => {
    setExpandedBlocks((current) => {
      const next = new Set(current);
      if (next.has(assetCode)) next.delete(assetCode);
      else next.add(assetCode);
      return next;
    });
  };

  return (
    <section className="lf-squad-section">
      <div className="lf-squad-section__title">{label}{role === "P" ? " (Blocchi)" : ""}</div>
      {rolePlayers.length === 0 ? (
        <div className="lf-squad-empty">—</div>
      ) : (
        <div className="lf-squad-list">
          {rolePlayers.map((player) => {
            const isBlock = role === "P" && (player.type === "goalkeeper_block" || /\s+-\s+/.test(player.displayName));
            const expanded = expandedBlocks.has(player.assetCode);
            const selected = selectable && (selectedCodes?.has(player.assetCode) ?? false);
            const goalkeepers = isBlock ? splitGoalkeepers(player.displayName) : [];
            const crest = media.crest(player.realTeam);

            const rowContent = (
              <>
                <div className="lf-squad-item__left">
                  {isBlock ? (
                    <div className={`lf-squad-block-crest ${crest ? "has-crest" : ""}`} aria-hidden="true">
                      {crest ? <img src={crest} alt="" loading="lazy" decoding="async" /> : <ShieldIcon size={17} />}
                    </div>
                  ) : <PlayerAvatar name={player.displayName} team={player.realTeam} role={role} media={media} />}
                  <div className="lf-squad-item__copy">
                    <div className="lf-squad-item__name">
                      {isBlock ? `Blocco ${player.realTeam || player.displayName}` : player.displayName}
                      {!player.active && " *"}
                      {isBlock && !selectable && <ChevronDownIcon size={14} className={expanded ? "lf-chevron-open" : ""} />}
                    </div>
                    <div className={`lf-squad-item__team ${isBlock ? "lf-squad-item__team--block" : ""}`}>
                      {!isBlock && crest && <img className="lf-squad-club-crest" src={crest} alt="" loading="lazy" decoding="async" />}
                      <span>{isBlock ? `${goalkeepers.length} portieri` : (player.realTeam || "—")}</span>
                    </div>
                  </div>
                </div>
                <div className="lf-squad-values">
                  <span><small>Q</small><strong>{player.quotation || "—"}</strong></span>
                  <span><small>P</small><strong className="lf-squad-price">{player.purchasePrice || "—"}</strong></span>
                </div>
              </>
            );

            // Riga selezionabile: giocatore singolo → bottone con check.
            if (selectable && !isBlock) {
              return (
                <button
                  key={player.assetCode}
                  type="button"
                  className={`lf-squad-item lf-squad-item--selectable ${selected ? "is-selected" : ""}`}
                  onClick={() => onToggleSelect?.(player.assetCode)}
                  aria-pressed={selected}
                >
                  <SelectionCheck selected={selected} />
                  {rowContent}
                </button>
              );
            }

            // Blocco selezionabile: il click seleziona il blocco e apre
            // subito la tendina dei portieri singoli (niente chevron).
            if (selectable && isBlock) {
              return (
                <div key={player.assetCode} className="lf-squad-item-wrap">
                  <button
                    type="button"
                    className={`lf-squad-item lf-squad-item--selectable ${selected ? "is-selected" : ""}`}
                    onClick={() => onToggleSelect?.(player.assetCode)}
                    aria-pressed={selected}
                  >
                    <SelectionCheck selected={selected} />
                    {rowContent}
                  </button>
                  {selected && (
                    <div className="lf-squad-goalkeepers">
                      {goalkeepers.map((goalkeeper) => {
                        const photo = media.player(goalkeeper, player.realTeam)?.photoUrl;
                        return (
                          <div key={goalkeeper} className="lf-squad-goalkeeper">
                            <div className={`lf-squad-goalkeeper__avatar ${photo ? "has-photo" : ""}`}>
                              {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : "P"}
                            </div>
                            <span>{goalkeeper}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={player.assetCode} className="lf-squad-item-wrap">
                {isBlock ? (
                  <button type="button" className="lf-squad-item lf-squad-item--clickable" onClick={() => toggleBlock(player.assetCode)} aria-expanded={expanded}>
                    {rowContent}
                  </button>
                ) : <div className="lf-squad-item">{rowContent}</div>}

                {isBlock && expanded && (
                  <div className="lf-squad-goalkeepers">
                    {goalkeepers.map((goalkeeper) => {
                      const photo = media.player(goalkeeper, player.realTeam)?.photoUrl;
                      return (
                        <div key={goalkeeper} className="lf-squad-goalkeeper">
                          <div className={`lf-squad-goalkeeper__avatar ${photo ? "has-photo" : ""}`}>
                            {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : "P"}
                          </div>
                          <span>{goalkeeper}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
