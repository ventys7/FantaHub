import { useState, type CSSProperties } from "react";
import type { FormationModel, SlotDefinition } from "./formationTypes";
import { getBenchDisplayEntry } from "./formationModel";

function photoSource(player: { n: string; t?: string; isTeamLabel?: boolean } | null): string | null {
  if (!player) return null;
  const media = (window as any).LineupPlayerMedia;
  if (player.isTeamLabel) return media?.crest?.(player.n) ?? null;
  return media?.photo?.(player.n, player.t) ?? null;
}

function SlotPhoto({ player }: { player: { n: string; t?: string; isTeamLabel?: boolean } | null }) {
  const [hidden, setHidden] = useState(false);
  const source = photoSource(player);
  if (!source || hidden) return <span className="formation-shirt__photo" hidden />;
  return (
    <span className="formation-shirt__photo">
      <img
        src={source}
        alt=""
        loading="lazy"
        decoding="async"
        className={player?.isTeamLabel ? "is-crest" : undefined}
        onError={() => setHidden(true)}
      />
    </span>
  );
}

function Slot({
  definition,
  entry,
  side,
  onSlotClick
}: {
  definition: SlotDefinition;
  entry: { index: number | null; player: any } | null;
  side: "starter" | "bench";
  onSlotClick: (slotKey: string) => void;
}) {
  const player = entry?.player ?? null;
  const isTeamLabel = Boolean(player?.isTeamLabel);
  const hasPhoto = Boolean(photoSource(player));

  const slotClasses = [
    "slot",
    "formation-slot",
    `formation-slot--${side}`,
    !player ? "empty" : "",
    isTeamLabel ? "formation-slot--team-label" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const shirtClasses = [
    "formation-shirt",
    player ? "formation-shirt--selected" : "formation-shirt--empty",
    hasPhoto ? "formation-shirt--has-photo" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={slotClasses}
      id={`${side}-${definition.id}`}
      data-role={definition.role}
      data-slot-key={definition.key}
      aria-label={`${definition.label ?? definition.role}: ${player?.n || "vuoto"}`}
      onClick={() => onSlotClick(definition.key)}
    >
      <div className="formation-slot__content">
        <div className={shirtClasses} data-role={definition.role}>
          <span className="formation-shirt__role">{definition.role}</span>
          <SlotPhoto player={player} />
          <span className="formation-shirt__name">{player?.n || "Scegli"}</span>
          <span className="formation-shirt__team">
            {side === "bench" && definition.role === "P" ? "" : player?.t || (player ? "" : "Tocca lo slot")}
          </span>
        </div>
      </div>
    </button>
  );
}

function groupByRole(definitions: SlotDefinition[]): SlotDefinition[][] {
  const groups: SlotDefinition[][] = [];
  definitions.forEach((definition) => {
    const previous = groups[groups.length - 1];
    if (!previous || previous[0].role !== definition.role) groups.push([]);
    groups[groups.length - 1].push(definition);
  });
  return groups;
}

export function SlotGrid({
  model,
  onSlotClick
}: {
  model: FormationModel;
  onSlotClick: (slotKey: string) => void;
}) {
  const starterGroups = groupByRole(model.definitions.starter);
  const benchKeepers = model.definitions.bench.filter((d) => d.role === "P");
  const benchColumns: { role: string; defs: SlotDefinition[] }[] = ["D", "C", "A"].map((role) => ({
    role,
    defs: model.definitions.bench.filter((d) => d.role === role)
  }));

  return (
    <div className="lf-formation-grid">
      <div className="lf-formation-starters">
        <div className="section-title-row">
          <span className="mt-8 font-600">
            Titolari <span style={{ color: "var(--muted)" }}>({model.counts.starters}/11)</span>
          </span>
        </div>
        {starterGroups.map((group) => (
          <div
            key={group[0].role}
            className={`formation-row formation-row--${group[0].role}`}
            data-count={String(group.length)}
            style={{ "--row-count": group.length } as CSSProperties}
          >
            {group.map((definition) => (
              <Slot
                key={definition.key}
                definition={definition}
                side="starter"
                entry={model.slots.starter[definition.id] || null}
                onSlotClick={onSlotClick}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="lf-formation-bench">
        <div className="mt-12 font-600">
          Panchina <span style={{ color: "var(--muted)" }}>({model.counts.bench}/11)</span>
        </div>
        {benchKeepers.length > 0 && (
          <div className="bench-keepers" style={{ "--row-count": benchKeepers.length } as CSSProperties}>
            {benchKeepers.map((definition) => (
              <Slot
                key={definition.key}
                definition={definition}
                side="bench"
                entry={getBenchDisplayEntry(model, definition)}
                onSlotClick={onSlotClick}
              />
            ))}
          </div>
        )}
        <div className="bench-matrix">
          {benchColumns.map((column) => (
            <div key={column.role} className={`bench-column bench-column--${column.role}`}>
              {column.defs.map((definition) => (
                <Slot
                  key={definition.key}
                  definition={definition}
                  side="bench"
                  entry={getBenchDisplayEntry(model, definition)}
                  onSlotClick={onSlotClick}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
