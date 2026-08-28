import { useMemo, useState } from "react";
import type { FormationPlayer } from "./formationTypes";

interface PlayerOption {
  player: FormationPlayer;
  index: number;
}

const ROLE_ORDER = ["P", "D", "C", "A"];
const ROLE_LABEL: Record<string, string> = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };

export function PlayerPicker({
  title,
  players,
  role,
  exclude,
  onPick,
  onClose
}: {
  title: string;
  players: PlayerOption[];
  role: string | null;
  exclude?: number[];
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const excludeSet = exclude ? new Set(exclude) : null;
    const filtered = players.filter(({ player, index }) => {
      if (excludeSet && excludeSet.has(index)) return false;
      if (role && player.r !== role) return false;
      if (q && !player.n.toLowerCase().includes(q)) return false;
      return true;
    });
    const byRole = new Map<string, PlayerOption[]>();
    filtered.forEach((opt) => {
      const list = byRole.get(opt.player.r) ?? [];
      list.push(opt);
      byRole.set(opt.player.r, list);
    });
    return ROLE_ORDER.filter((r) => byRole.has(r)).map((r) => ({ role: r, label: ROLE_LABEL[r], items: byRole.get(r)! }));
  }, [players, role, query]);

  return (
    <div className="lf-picker-overlay" onClick={onClose}>
      <div className="lf-picker-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="lf-picker-header">
          <h3 className="lf-picker-title">{title}</h3>
          <input
            className="lf-picker-search"
            type="search"
            placeholder="Cerca giocatore…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button type="button" className="lf-picker-close" aria-label="Chiudi" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="lf-picker-body">
          {grouped.length === 0 && <p className="lf-picker-empty">Nessun giocatore disponibile.</p>}
          {grouped.map((group) => (
            <div key={group.role} className="lf-picker-group">
              <div className="lf-picker-group__label">{group.label}</div>
              {group.items.map(({ player, index }) => (
                <button
                  key={index}
                  type="button"
                  className="lf-picker-item"
                  onClick={() => onPick(index)}
                >
                  <span className="lf-picker-item__role">{player.r}</span>
                  <span className="lf-picker-item__name">{player.n}</span>
                  <span className="lf-picker-item__team">{player.t}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
