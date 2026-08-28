import type {
  FormationModel,
  FormationPlayer,
  SlotAssignments,
  SlotDefinition
} from "./formationTypes";

type WindowWithFormation = Window & typeof globalThis & {
  FormationModel?: {
    build: (input?: Record<string, unknown>) => FormationModel | null;
    getSlotDefinitions: (module: string) => { starter: SlotDefinition[]; bench: SlotDefinition[] } | null;
    getBenchDisplayEntry: (model: FormationModel, definition: SlotDefinition) => SlotEntryLike | null;
    allowedModules: string[];
  };
  LineupDb?: { get: () => Record<string, { players: FormationPlayer[] }> };
};

interface SlotEntryLike {
  index: number | null;
  player: FormationPlayer | null;
}

export function buildFormationModel(input: {
  team?: FormationPlayer[];
  module?: string;
  selectedPlayers?: number[];
  slotAssignments?: SlotAssignments;
}): FormationModel | null {
  const fm = (window as WindowWithFormation).FormationModel;
  if (!fm || typeof fm.build !== "function") return null;
  return fm.build(input as Record<string, unknown>) ?? null;
}

export function getSlotDefinitions(module: string): { starter: SlotDefinition[]; bench: SlotDefinition[] } | null {
  const fm = (window as WindowWithFormation).FormationModel;
  if (!fm || typeof fm.getSlotDefinitions !== "function") return null;
  return fm.getSlotDefinitions(module) ?? null;
}

export function getBenchDisplayEntry(model: FormationModel, definition: SlotDefinition) {
  const fm = (window as WindowWithFormation).FormationModel;
  if (!fm || typeof fm.getBenchDisplayEntry !== "function") return null;
  return fm.getBenchDisplayEntry(model, definition);
}

export function getAllDefinitions(module: string): SlotDefinition[] {
  const defs = getSlotDefinitions(module);
  if (!defs) return [];
  return [...defs.starter, ...defs.bench];
}

export function getManagers(): string[] {
  const db = (window as WindowWithFormation).LineupDb?.get?.();
  if (!db) return [];
  return Object.keys(db).sort((a, b) => a.localeCompare(b, "it"));
}

export function getTeamForManager(manager: string | null): FormationPlayer[] {
  const db = (window as WindowWithFormation).LineupDb?.get?.();
  if (!manager || !db || !db[manager]?.players) return [];
  return db[manager].players as FormationPlayer[];
}

export function getAllowedModules(): string[] {
  const modules = (window as WindowWithFormation).FormationModel?.allowedModules;
  return Array.isArray(modules) ? modules.slice() : [];
}
