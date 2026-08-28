import { useMemo, useState } from "react";
import type { FormationPlayer, FormationRole } from "./formationTypes";
import { ROLE_LABELS } from "./formationTypes";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function PlayerPicker({
  role,
  team,
  currentIndex,
  onSelect,
  onRemove,
  onClose
}: {
  role: FormationRole;
  team: FormationPlayer[];
  currentIndex: number | null;
  onSelect: (index: number) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const candidates = useMemo(() => {
    const q = normalize(query.trim());
    return team
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => player.r === role)
      .filter(({ player }) =>
        q ? normalize(`${player.n} ${player.t ?? ""}`).includes(q) : true
      )
      .sort((a, b) => a.player.n.localeCompare(b.player.n, "it"));
  }, [team, role, query]);

  const current = currentIndex != null ? team[currentIndex] : null;

  return (
    <div className="modal lf-picker-modal" role="dialog" aria-modal="true" aria-label={`Scegli ${ROLE_LABELS[role]}`}>
      <div className="output-modal-content lf-picker-content">
        <div className="output-modal-header lf-picker-header">
          <h3>Scegli {ROLE_LABELS[role].toLowerCase()}</h3>
          <button type="button" className="output-close-btn" aria-label="Chiudi" onClick={onClose}>
            ✕
          </button>
        </div>

        {current && (
          <div className="lf-picker-current">
            <span>
              Selezionato: <strong>{current.n}</strong> {current.t ? `(${current.t})` : ""}
            </span>
            {onRemove && (
              <button type="button" className="lf-picker-remove" onClick={onRemove}>
                Rimuovi
              </button>
            )}
          </div>
        )}

        <div className="lf-picker-search">
          <input
            type="search"
            autoFocus
            placeholder={`Cerca tra ${candidates.length} ${ROLE_LABELS[role].toLowerCase()}...`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="lf-picker-list" role="listbox">
          {candidates.length === 0 && <p className="lf-picker-empty">Nessun giocatore disponibile.</p>}
          {candidates.map(({ player, index }) => (
            <button
              key={index}
              type="button"
              role="option"
              aria-selected={index === currentIndex}
              className={`lf-picker-item${index === currentIndex ? " is-current" : ""}`}
              onClick={() => onSelect(index)}
            >
              <span className="lf-picker-item-name">{player.n}</span>
              {player.t && <span className="lf-picker-item-team">{player.t}</span>}
              {player.gkBlock && <span className="lf-picker-item-block">Blocco {player.gkBlock}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
