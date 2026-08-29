import { useMemo, useState } from "react";
import { Controls } from "./formation/Controls";
import { SwitchSection, MobileSwitchSection } from "./formation/SwitchSection";
import { PlayerPicker } from "./formation/PlayerPicker";
import {
  StartersGrid,
  BenchGrid,
  MobileStartersGrid,
  MobileBenchGrid,
  type ActiveSlot,
  type SlotSide
} from "./formation/SlotGrid";
import { GkModal } from "./formation/GkModal";
import { OutputModal } from "./formation/OutputModal";
import { useFormation } from "./formation/useFormation";
import { getAllowedModules } from "./formation/formationModel";
import type { FormationPlayer } from "./formation/formationTypes";

export default function FormationApp() {
  const f = useFormation();
  const [activeSlot, setActiveSlot] = useState<ActiveSlot | null>(null);
  const [activeSwitch, setActiveSwitch] = useState<"starter" | "bench" | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [gkOpen, setGkOpen] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);

  const modules = useMemo(() => getAllowedModules(), []);
  const teamOptions = useMemo(
    () => f.team.map((player, index) => ({ player, index })),
    [f.team]
  );

  if (!f.ready || !f.model) {
    return <div className="league-react-empty">Caricamento formazione…</div>;
  }

  const model = f.model;
  const counts = model.counts;
  const switchStarterPlayer: FormationPlayer | null =
    f.switch.starterIndex != null ? f.team[f.switch.starterIndex] ?? null : null;
  const switchBenchPlayer: FormationPlayer | null =
    f.switch.benchIndex != null ? f.team[f.switch.benchIndex] ?? null : null;

  const closeAll = () => {
    setActiveSlot(null);
    setActiveSwitch(null);
    setRosterOpen(false);
    setGkOpen(false);
  };

  const handleSlotClick = (side: SlotSide, defId: string, role: string) => {
    setActiveSwitch(null);
    setRosterOpen(false);
    if (role === "P") {
      setGkOpen(true);
      return;
    }
    setActiveSlot({ side, defId, role });
  };

  const openPickerForSwitch = (target: "starter" | "bench") => {
    setActiveSlot(null);
    setRosterOpen(false);
    setActiveSwitch(target);
  };

  const handlePick = (index: number) => {
    if (activeSlot) {
      f.actions.assignSlot(activeSlot.defId, index);
      setActiveSlot(null);
    } else if (activeSwitch === "starter") {
      f.actions.setSwitchStarter(index);
      setActiveSwitch(null);
    } else if (activeSwitch === "bench") {
      f.actions.setSwitchBench(index);
      setActiveSwitch(null);
    }
  };

  const handleReset = () => {
    if (f.manager) f.actions.setManager(f.manager);
    closeAll();
  };

  const firstEmptyStarterKey = (role: string): string | null => {
    const def = model.definitions.starter.find((d) => d.role === role && !model.slots.starter[d.id]);
    return def ? def.key : null;
  };

  const handleRosterPick = (index: number) => {
    const player = f.team[index];
    if (!player) return;
    const key = activeSlot && activeSlot.role === player.r ? activeSlot.defId : firstEmptyStarterKey(player.r);
    if (!key) return;
    f.actions.assignSlot(key, index);
    setRosterOpen(false);
  };

  const unassigned = teamOptions.filter(({ index }) => !f.selectedPlayers.includes(index));

  const pickerOpen = activeSlot !== null || activeSwitch !== null;
  const pickerRole = activeSlot ? activeSlot.role : null;
  const pickerTitle =
    activeSwitch === "starter"
      ? "Scegli titolare per Switch"
      : activeSwitch === "bench"
        ? "Scegli panchinaro per Switch"
        : `Titolare · ${activeSlot?.role ?? ""}`;

  return (
    <>
      <Controls
        manager={f.manager}
        managers={f.managers}
        module={f.module}
        modules={modules}
        onManagerChange={f.actions.setManager}
        onModuleChange={f.actions.setModule}
        onReset={handleReset}
        onToggleRoster={() => setRosterOpen((o) => !o)}
        onOpenOutput={() => setOutputOpen(true)}
      />

      <div className="content-wrapper">
        <div className="grid">
          <section className="column">
            <div className="desktop-formation-layout">
              <div className="desktop-formation-main">
                <div className="section-title-row">
                  <span className="mt-8 font-600">
                    Titolari <span id="starterCount" style={{ color: "var(--muted)" }}>({counts.starters}/11)</span>
                  </span>
                  <button id="resetBtn" className="reset-btn-small" onClick={handleReset}>
                    Reset
                  </button>
                </div>

                <StartersGrid model={model} selected={activeSlot} onSlotClick={handleSlotClick} />

                <SwitchSection
                  plus={f.switch.plus}
                  starterPlayer={switchStarterPlayer}
                  benchPlayer={switchBenchPlayer}
                  onTogglePlus={() => f.actions.setSwitchPlus(!f.switch.plus)}
                  onPickSwitch={openPickerForSwitch}
                />

                <div className="mt-12 font-600">
                  Panchina <span id="benchCount" style={{ color: "var(--muted)" }}>({counts.bench}/11)</span>
                </div>

                <BenchGrid model={model} selected={activeSlot} onSlotClick={handleSlotClick} />
              </div>
            </div>
          </section>
        </div>

        {/* Mobile-only layout (mirrors the vanilla #mobileLayout) */}
        <div id="mobileLayout" className="mobile-formation-root">
          <section className="mobile-section">
            <div className="mobile-title-row">
              <span className="mobile-title">Titolari</span>
              <span id="mobileStarterCount" className="mobile-count">
                ({counts.starters}/11)
              </span>
            </div>
            <MobileStartersGrid model={model} selected={activeSlot} onSlotClick={handleSlotClick} />
          </section>

          <MobileSwitchSection
            plus={f.switch.plus}
            starterPlayer={switchStarterPlayer}
            benchPlayer={switchBenchPlayer}
            onTogglePlus={() => f.actions.setSwitchPlus(!f.switch.plus)}
            onPickSwitch={openPickerForSwitch}
          />

          <section className="mobile-section">
            <div className="mobile-title-row">
              <span className="mobile-title">Panchina</span>
              <span id="mobileBenchCount" className="mobile-count">
                ({counts.bench}/11)
              </span>
            </div>
            <MobileBenchGrid model={model} selected={activeSlot} onSlotClick={handleSlotClick} />
          </section>

          <button id="resetBtnMobile" className="reset-btn-mobile" onClick={handleReset}>
            Reset
          </button>
        </div>

        {rosterOpen && (
          <div className="roster-drawer is-open">
            <div className="roster-drawer-header">
              <h2>La tua Rosa</h2>
              <button className="close-roster-btn" aria-label="Chiudi" onClick={() => setRosterOpen(false)}>
                ✕
              </button>
            </div>
            <div className="roster-drawer-inner">
              <div className="roster-list">
                {unassigned.length === 0 && <p className="lf-picker-empty">Tutti i giocatori sono in formazione.</p>}
                {unassigned.map(({ player, index }) => (
                  <button key={index} type="button" className="roster-item" onClick={() => handleRosterPick(index)}>
                    <span className="roster-item__role">{player.r}</span>
                    <span className="roster-item__name">{player.n}</span>
                    <span className="roster-item__team">{player.t}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {pickerOpen && (
        <PlayerPicker
          title={pickerTitle}
          players={teamOptions}
          role={pickerRole}
          exclude={f.selectedPlayers}
          onPick={handlePick}
          onClose={() => {
            setActiveSlot(null);
            setActiveSwitch(null);
          }}
        />
      )}

      {gkOpen && <GkModal onClose={() => setGkOpen(false)} onConfirm={(index) => { f.actions.confirmGk(index); setGkOpen(false); }} />}

      {outputOpen && (
        <OutputModal model={model} manager={f.manager || ""} onClose={() => setOutputOpen(false)} />
      )}
    </>
  );
}
