import { useState } from "react";
import type { FormationModel, FormationRole } from "./formationTypes";
import { getAllowedModules } from "./formationModel";
import { ROLE_LABELS } from "./formationTypes";

export function ModuleSelect({
  module,
  onModule
}: {
  module: string;
  onModule: (value: string) => void;
}) {
  const modules = getAllowedModules();
  return (
    <label className="lf-control lf-control--module">
      <span className="lf-control__label">Modulo</span>
      <select value={module} onChange={(event) => onModule(event.target.value)}>
        {modules.map((m) => (
          <option key={m} value={m}>
            {[...m].join("-")}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ManagerSelect({
  managers,
  manager,
  onManager
}: {
  managers: string[];
  manager: string | null;
  onManager: (value: string) => void;
}) {
  return (
    <label className="lf-control lf-control--manager">
      <span className="lf-control__label">Squadra</span>
      <select value={manager ?? ""} onChange={(event) => onManager(event.target.value)}>
        {managers.length === 0 && <option value="">—</option>}
        {managers.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function roleOfEntry(entry: { player?: { r?: FormationRole } | null } | null): FormationRole | null {
  return (entry?.player?.r as FormationRole) ?? null;
}

export function SwitchPanel({
  model,
  switchState,
  onStarter,
  onBench,
  onPlus
}: {
  model: FormationModel;
  switchState: { starterIndex: number | null; benchIndex: number | null; plus: boolean };
  onStarter: (index: number | null) => void;
  onBench: (index: number | null) => void;
  onPlus: (value: boolean) => void;
}) {
  const [picking, setPicking] = useState<"starter" | "bench" | null>(null);
  const movement = (entries: { index: number | null; player: any }[]) =>
    entries.filter((e) => e.player && e.player.r !== "P" && Number.isInteger(e.index));

  const starterCandidates = movement(model.starters);
  const benchCandidates = movement(model.bench);

  if (picking) {
    const candidates = picking === "starter" ? starterCandidates : benchCandidates;
    const role = picking === "starter" ? "Titolare" : "Panchinaro";
    return (
      <div className="lf-switch-pick">
        <div className="lf-switch-pick__header">
          <span>Switch {role}</span>
          <button type="button" className="lf-picker-remove" onClick={() => setPicking(null)}>
            Annulla
          </button>
        </div>
        <div className="lf-picker-list">
          {candidates.length === 0 && <p className="lf-picker-empty">Nessun candidato disponibile.</p>}
          {candidates.map((entry) => (
            <button
              key={entry.index}
              type="button"
              className="lf-picker-item"
              onClick={() => {
                if (picking === "starter") onStarter(entry.index as number);
                else onBench(entry.index as number);
                setPicking(null);
              }}
            >
              <span className="lf-picker-item-name">{entry.player.n}</span>
              <span className="lf-picker-item-team">{entry.player.t ?? ""}</span>
              <span className="lf-picker-item-block">{ROLE_LABELS[entry.player.r as FormationRole]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const starterPlayer = switchState.starterIndex != null ? model.team[switchState.starterIndex] : null;
  const benchPlayer = switchState.benchIndex != null ? model.team[switchState.benchIndex] : null;

  return (
    <aside className="switch-section lf-switch-section" aria-label="Switch facoltativo">
      <div className="switch-panel">
        <div className="switch-panel__header">
          <div className="switch-panel__title">
            <h3>Switch</h3>
            <p className="switch-panel__eyebrow">Opzionale</p>
          </div>
        </div>
        <button
          type="button"
          className={`switch-mode-toggle${switchState.plus ? " is-plus" : ""}`}
          aria-pressed={switchState.plus}
          onClick={() => onPlus(!switchState.plus)}
        >
          <span>Base</span>
          <span>Plus</span>
        </button>
        <div className="switch-pair">
          <div className="switch-picker-wrapper">
            <span className="switch-picker-label">Titolare</span>
            <button type="button" className="switch-slot" onClick={() => setPicking("starter")}>
              <span className="switch-slot-content">
                {starterPlayer ? (
                  <span>
                    {starterPlayer.n}
                    {starterPlayer.t ? ` (${starterPlayer.t})` : ""}
                  </span>
                ) : (
                  <span className="switch-slot-placeholder">＋</span>
                )}
              </span>
            </button>
          </div>
          <div className="switch-connector" aria-hidden="true">
            <span>↔</span>
          </div>
          <div className="switch-picker-wrapper">
            <span className="switch-picker-label">Panchinaro</span>
            <button type="button" className="switch-slot" onClick={() => setPicking("bench")}>
              <span className="switch-slot-content">
                {benchPlayer ? (
                  <span>
                    {benchPlayer.n}
                    {benchPlayer.t ? ` (${benchPlayer.t})` : ""}
                  </span>
                ) : (
                  <span className="switch-slot-placeholder">＋</span>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
