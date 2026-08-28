import type { FormationPlayer } from "./formationTypes";

interface SwitchSlotContentProps {
  player: FormationPlayer;
}

function SwitchSlotContent({ player }: SwitchSlotContentProps) {
  return (
    <>
      <span className="switch-slot__name">{player.n}</span>
      <span className="switch-slot__team">{player.t}</span>
    </>
  );
}

export function SwitchSection({
  plus,
  starterPlayer,
  benchPlayer,
  onTogglePlus,
  onPickSwitch
}: {
  plus: boolean;
  starterPlayer: FormationPlayer | null;
  benchPlayer: FormationPlayer | null;
  onTogglePlus: () => void;
  onPickSwitch: (target: "starter" | "bench") => void;
}) {
  return (
    <aside className="switch-section switch-section--desktop" id="switchSection">
      <div className="switch-panel">
        <div className="switch-panel__header">
          <div className="switch-panel__title">
            <h3>Switch</h3>
            <p className="switch-panel__eyebrow">Opzionale</p>
          </div>
        </div>
        <button
          id="switchPlusBtn"
          className="switch-mode-toggle"
          type="button"
          aria-pressed={plus}
          title="Passa allo Switch Plus"
          onClick={onTogglePlus}
        >
          <span>Base</span>
          <span>Plus</span>
        </button>
        <div className="switch-pair">
          <div className="switch-picker-wrapper">
            <span className="switch-picker-label">Titolare</span>
            <button
              type="button"
              className="switch-slot"
              id="switchStarterSlot"
              aria-label="Scegli titolare per Switch"
              onClick={() => onPickSwitch("starter")}
            >
              <span className="switch-slot-content">
                {starterPlayer ? (
                  <SwitchSlotContent player={starterPlayer} />
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
            <button
              type="button"
              className="switch-slot"
              id="switchBenchSlot"
              aria-label="Scegli panchinaro per Switch"
              onClick={() => onPickSwitch("bench")}
            >
              <span className="switch-slot-content">
                {benchPlayer ? (
                  <SwitchSlotContent player={benchPlayer} />
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
