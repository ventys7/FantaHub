import type { CSSProperties } from "react";
import { getBenchDisplayEntry } from "./formationModel";
import type { FormationModel, FormationPlayer, SlotDefinition } from "./formationTypes";

export type SlotSide = "starter" | "bench";

export interface ActiveSlot {
  side: SlotSide;
  defId: string;
  role: string;
}

interface SlotEntryLike {
  index: number | null;
  player: FormationPlayer | null;
}

type Role = "P" | "D" | "C" | "A";

function groupByRole(defs: SlotDefinition[]): { role: string; defs: SlotDefinition[] }[] {
  const groups: { role: string; defs: SlotDefinition[] }[] = [];
  defs.forEach((def) => {
    const last = groups[groups.length - 1];
    if (!last || last.role !== def.role) groups.push({ role: def.role, defs: [] });
    groups[groups.length - 1].defs.push(def);
  });
  return groups;
}

interface PlayerMediaGlobal {
  photo?: (name: string, team?: string) => string | null | undefined;
  crest?: (name: string) => string | null | undefined;
}

function playerPhoto(player: FormationPlayer): string | null {
  const media = (window as unknown as { LineupPlayerMedia?: PlayerMediaGlobal }).LineupPlayerMedia;
  if (!media) return null;
  return player.isTeamLabel ? (media.crest?.(player.n) ?? null) : (media.photo?.(player.n, player.t) ?? null);
}

function SlotVisual({ role, player }: { role: string; player: FormationPlayer | null }) {
  const photo = player ? playerPhoto(player) : null;
  return (
    <div className="formation-slot__content">
      <div className={`formation-shirt ${player ? "formation-shirt--selected" : "formation-shirt--empty"}`} data-role={role}>
        <span className="formation-shirt__role">{role}</span>
        <span className="formation-shirt__photo" hidden={!photo}>
          {photo && (
            <img src={photo} alt="" loading="lazy" decoding="async" className={player?.isTeamLabel ? "is-crest" : undefined} />
          )}
        </span>
        <span className="formation-shirt__name">{player ? player.n : "Scegli"}</span>
        <span className="formation-shirt__team">{player ? player.t : "Tocca lo slot"}</span>
      </div>
    </div>
  );
}

interface SlotProps {
  side: SlotSide;
  def: SlotDefinition;
  entry: SlotEntryLike | null;
  selected: boolean;
  onSlotClick: (side: SlotSide, defId: string, role: string) => void;
}

function Slot({ side, def, entry, selected, onSlotClick }: SlotProps) {
  const player = entry?.player ?? null;
  return (
    <button
      type="button"
      className={`slot formation-slot formation-slot--${side}${player ? "" : " empty"}${selected ? " selected" : ""}`}
      id={`${side}-${def.id}`}
      data-role={def.role}
      data-slot-key={def.key}
      aria-label={`${def.label}: ${player?.n || "vuoto"}`}
      onClick={() => onSlotClick(side, def.key, def.role)}
    >
      <SlotVisual role={def.role} player={player} />
    </button>
  );
}

export function StartersGrid({
  model,
  selected,
  onSlotClick
}: {
  model: FormationModel;
  selected: ActiveSlot | null;
  onSlotClick: (side: SlotSide, defId: string, role: string) => void;
}) {
  const groups = groupByRole(model.definitions.starter);
  return (
    <div className="slot-grid" id="startersSlots">
      {groups.map((g) => (
        <div
          key={g.role}
          className={`formation-row formation-row--${g.role}`}
          data-count={g.defs.length}
          style={{ ["--row-count" as string]: g.defs.length } as CSSProperties}
        >
          {g.defs.map((def) => (
            <Slot
              key={def.id}
              side="starter"
              def={def}
              entry={model.slots.starter[def.id] || null}
              selected={selected?.side === "starter" && selected.defId === def.key}
              onSlotClick={onSlotClick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function BenchGrid({
  model,
  selected,
  onSlotClick
}: {
  model: FormationModel;
  selected: ActiveSlot | null;
  onSlotClick: (side: SlotSide, defId: string, role: string) => void;
}) {
  const benchDefs = model.definitions.bench;
  const keepers = benchDefs.filter((d) => d.role === "P");
  const movement: Role[] = ["D", "C", "A"];
  return (
    <div className="slot-grid" id="benchSlots">
      <div className="bench-keepers" style={{ ["--row-count" as string]: keepers.length } as CSSProperties}>
        {keepers.map((def) => (
          <Slot
            key={def.id}
            side="bench"
            def={def}
            entry={getBenchDisplayEntry(model, def)}
            selected={selected?.side === "bench" && selected.defId === def.key}
            onSlotClick={onSlotClick}
          />
        ))}
      </div>
      <div className="bench-matrix">
        {movement.map((role) => (
          <div key={role} className={`bench-column bench-column--${role}`}>
            {benchDefs
              .filter((d) => d.role === role)
              .map((def) => (
                <Slot
                  key={def.id}
                  side="bench"
                  def={def}
                  entry={getBenchDisplayEntry(model, def)}
                  selected={selected?.side === "bench" && selected.defId === def.key}
                  onSlotClick={onSlotClick}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
