import { useState } from "react";
import { useFormation } from "./formation/useFormation";
import { SlotGrid } from "./formation/SlotGrid";
import { PlayerPicker } from "./formation/PlayerPicker";
import { ModuleSelect, ManagerSelect, SwitchPanel } from "./formation/Controls";
import type { FormationRole } from "./formation/formationTypes";

function LoadingState({ status }: { status: string }) {
  return (
    <div className="lf-loading">
      {status === "loading" ? "Caricamento dati squadra…" : "Dati non disponibili."}
    </div>
  );
}

export default function FormationApp() {
  const {
    ready,
    status,
    managers,
    manager,
    module,
    team,
    definitions,
    model,
    actions,
    switch: switchState
  } = useFormation();
  const [pickerSlot, setPickerSlot] = useState<string | null>(null);

  if (!ready || !model) return <LoadingState status={status} />;

  const openSlot = pickerSlot ? definitions.find((d) => d.key === pickerSlot) : null;

  return (
    <div className="lf-formation">
      <div className="lf-controls-bar">
        <ModuleSelect module={module} onModule={actions.setModule} />
        <ManagerSelect managers={managers} manager={manager} onManager={actions.setManager} />
      </div>

      <div className="lf-formation-body">
        <div className="lf-formation-main">
          <SlotGrid model={model} onSlotClick={(slotKey) => setPickerSlot(slotKey)} />
        </div>
        <SwitchPanel
          model={model}
          switchState={switchState}
          onStarter={actions.setSwitchStarter}
          onBench={actions.setSwitchBench}
          onPlus={actions.setSwitchPlus}
        />
      </div>

      {openSlot && (
        <PlayerPicker
          role={openSlot.role as FormationRole}
          team={team}
          currentIndex={model.slots.starter[openSlot.id]?.index ?? model.slots.bench[openSlot.id]?.index ?? null}
          onSelect={(index) => {
            actions.assignSlot(openSlot.key, index);
            setPickerSlot(null);
          }}
          onRemove={() => {
            actions.removeSlot(openSlot.key);
            setPickerSlot(null);
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
