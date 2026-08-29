import { useCallback, useEffect, useMemo, useState } from "react";
import { useLeagueAssets } from "../hooks";
import type { FormationModel, FormationPlayer, FormationState, SlotAssignments } from "./formationTypes";
import { buildFormationModel, getAllDefinitions, getAllowedModules, getManagers, getTeamForManager } from "./formationModel";
import { assignToSlot, removeFromSlot, type PureFormationState } from "./formationLogic";

const EMPTY_STATE: FormationState = {
  manager: null,
  module: "433",
  selectedPlayers: [],
  slotAssignments: {},
  switchStarterIndex: null,
  switchBenchIndex: null,
  switchPlus: false
};

type WindowWithLineup = Window & typeof globalThis & {
  LineupState?: {
    getCurrentManager: () => string;
    getModule: () => string;
    getSelectedPlayers: () => number[];
    getSlotAssignments: () => SlotAssignments;
    setCurrentManager: (name: string) => void;
    setSelectedPlayers: (list: number[]) => void;
    setSlotAssignments: (map: SlotAssignments) => void;
    setModule: (value: string) => void;
    syncDisabledBlocks: () => void;
  };
  LineupSwitch?: {
    getState: () => { starterIndex: number | null; benchIndex: number | null; plus: boolean };
    setStarter: (index: number) => boolean;
    setBench: (index: number) => boolean;
    setPlus: (value: boolean) => boolean;
    clear: (target?: "starter" | "bench" | "all", opts?: { resetMode?: boolean }) => void;
  };
  LineupPersistence?: { queueDraftSave: () => void };
};

function readVanillaState(): Partial<FormationState> {
  const ls = (window as WindowWithLineup).LineupState;
  const sw = (window as WindowWithLineup).LineupSwitch;
  const swState = sw?.getState?.();
  return {
    manager: ls?.getCurrentManager?.() || null,
    module: ls?.getModule?.() || "433",
    selectedPlayers: ls?.getSelectedPlayers?.() || [],
    slotAssignments: ls?.getSlotAssignments?.() || {},
    switchStarterIndex: swState?.starterIndex ?? null,
    switchBenchIndex: swState?.benchIndex ?? null,
    switchPlus: Boolean(swState?.plus)
  };
}

function mirrorFormation(state: FormationState): void {
  const ls = (window as WindowWithLineup).LineupState;
  const persistence = (window as WindowWithLineup).LineupPersistence;
  ls?.setCurrentManager?.(state.manager ?? "");
  ls?.setSelectedPlayers?.(state.selectedPlayers);
  ls?.setSlotAssignments?.(state.slotAssignments);
  ls?.setModule?.(state.module);
  ls?.syncDisabledBlocks?.();
  persistence?.queueDraftSave?.();
}

function syncSwitchState(): Partial<FormationState> {
  const sw = (window as WindowWithLineup).LineupSwitch;
  const st = sw?.getState?.();
  return {
    switchStarterIndex: st?.starterIndex ?? null,
    switchBenchIndex: st?.benchIndex ?? null,
    switchPlus: Boolean(st?.plus)
  };
}

export function useFormation() {
  const { state } = useLeagueAssets();
  const [formation, setFormation] = useState<FormationState>(EMPTY_STATE);
  const [seeded, setSeeded] = useState(false);

  const seed = useCallback((): boolean => {
    const managers = getManagers();
    if (managers.length === 0) return false; // CSV not loaded yet
    const vanilla = readVanillaState();
    const manager = vanilla.manager && managers.includes(vanilla.manager) ? vanilla.manager : managers[0];
    const select = document.getElementById("moduleSelect") as HTMLSelectElement | null;
    const allowed = getAllowedModules();
    const module =
      vanilla.module || (select && allowed.includes(select.value) ? select.value : allowed[0] ?? "433");
    setFormation((prev) => ({
      ...prev,
      manager,
      module,
      selectedPlayers: vanilla.selectedPlayers || [],
      slotAssignments: vanilla.slotAssignments || {},
      ...syncSwitchState()
    }));
    return true;
  }, []);

  useEffect(() => {
    const trySeed = () => {
      if (seed()) setSeeded(true);
    };
    trySeed();
    const onMediaReady = () => trySeed();
    const onAssets = () => trySeed();
    window.addEventListener("lineup:player-media-ready", onMediaReady);
    window.addEventListener("lineup:league-assets-ready", onAssets);
    // Race-proof: vanilla restoreAfterCsv may populate the globals AFTER React
    // mounts, so the first seed can read an empty draft. Poll until managers are
    // present and any saved draft has been restored (or we hit a safe timeout).
    let tries = 0;
    const poll = window.setInterval(() => {
      tries += 1;
      const ok = seed();
      if (ok) setSeeded(true);
      const hasData = (readVanillaState().selectedPlayers || []).length > 0;
      if ((ok && (hasData || tries >= 24)) || tries >= 24) window.clearInterval(poll);
    }, 300);
    return () => {
      window.removeEventListener("lineup:player-media-ready", onMediaReady);
      window.removeEventListener("lineup:league-assets-ready", onAssets);
      window.clearInterval(poll);
    };
  }, [seed]);

  const team = useMemo<FormationPlayer[]>(
    () => (seeded ? getTeamForManager(formation.manager) : []),
    [seeded, formation.manager]
  );

  const definitions = useMemo(() => getAllDefinitions(formation.module), [formation.module]);

  const model = useMemo<FormationModel | null>(() => {
    if (!seeded || team.length === 0) return null;
    return buildFormationModel({
      team,
      module: formation.module,
      selectedPlayers: formation.selectedPlayers,
      slotAssignments: formation.slotAssignments
    });
  }, [seeded, team, formation.module, formation.selectedPlayers, formation.slotAssignments]);

  const assignSlot = useCallback(
    (slotKey: string, playerIndex: number) => {
      setFormation((prev) => {
        const next = assignToSlot(
          {
            module: prev.module,
            selectedPlayers: prev.selectedPlayers,
            slotAssignments: prev.slotAssignments
          },
          slotKey,
          playerIndex,
          definitions,
          team
        );
        if (next === prev) return prev; // rejected (role/block conflict)
        const merged: FormationState = { ...prev, ...next };
        mirrorFormation(merged);
        return merged;
      });
    },
    [definitions, team]
  );

  const removeSlot = useCallback(
    (slotKey: string) => {
      setFormation((prev) => {
        const next = removeFromSlot(
          { module: prev.module, selectedPlayers: prev.selectedPlayers, slotAssignments: prev.slotAssignments },
          slotKey
        );
        const merged: FormationState = { ...prev, ...next };
        mirrorFormation(merged);
        return merged;
      });
    },
    []
  );

  const setModule = useCallback((module: string) => {
    setFormation((prev) => {
      const merged: FormationState = { ...prev, module };
      mirrorFormation(merged);
      return merged;
    });
  }, []);

  const setManager = useCallback((manager: string) => {
    if (!manager) return;
    (window as WindowWithLineup).LineupSwitch?.clear?.("all", { resetMode: true });
    setFormation((prev) => {
      const merged: FormationState = { ...EMPTY_STATE, manager, module: prev.module, ...syncSwitchState() };
      mirrorFormation(merged);
      return merged;
    });
  }, []);

  const setSwitchStarter = useCallback((index: number | null) => {
    const sw = (window as WindowWithLineup).LineupSwitch;
    if (index === null) sw?.clear?.("starter");
    else sw?.setStarter?.(index);
    setFormation((prev) => ({ ...prev, ...syncSwitchState() }));
  }, []);

  const setSwitchBench = useCallback((index: number | null) => {
    const sw = (window as WindowWithLineup).LineupSwitch;
    if (index === null) sw?.clear?.("bench");
    else sw?.setBench?.(index);
    setFormation((prev) => ({ ...prev, ...syncSwitchState() }));
  }, []);

  const setSwitchPlus = useCallback((value: boolean) => {
    (window as WindowWithLineup).LineupSwitch?.setPlus?.(value);
    setFormation((prev) => ({ ...prev, ...syncSwitchState() }));
  }, []);

  const refreshFromVanilla = useCallback(() => {
    setFormation((prev) => {
      const vanilla = readVanillaState();
      const merged: FormationState = {
        ...prev,
        selectedPlayers: vanilla.selectedPlayers || prev.selectedPlayers,
        slotAssignments: vanilla.slotAssignments || prev.slotAssignments,
        ...syncSwitchState()
      };
      mirrorFormation(merged);
      return merged;
    });
  }, []);

  const confirmGk = useCallback(
    (index: number) => {
      const gk = (window as unknown as { GkBlocks?: { select?: (i: number) => boolean } }).GkBlocks;
      gk?.select?.(index);
      refreshFromVanilla();
    },
    [refreshFromVanilla]
  );

  const removeGk = useCallback(() => {
    const gk = (window as unknown as { GkBlocks?: { remove?: (i?: number | null) => boolean } }).GkBlocks;
    gk?.remove?.();
    refreshFromVanilla();
  }, [refreshFromVanilla]);

  return {
    ready: seeded,
    status: state.status,
    managers: getManagers(),
    manager: formation.manager,
    module: formation.module,
    team,
    definitions,
    model,
    selectedPlayers: formation.selectedPlayers,
    slotAssignments: formation.slotAssignments,
    switch: {
      starterIndex: formation.switchStarterIndex,
      benchIndex: formation.switchBenchIndex,
      plus: formation.switchPlus
    },
    actions: { assignSlot, removeSlot, setModule, setManager, setSwitchStarter, setSwitchBench, setSwitchPlus, confirmGk, removeGk }
  };
}
