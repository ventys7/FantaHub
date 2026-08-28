export type FormationRole = "P" | "D" | "C" | "A";

export interface FormationPlayer {
  n: string;
  r: FormationRole;
  t?: string;
  gkBlock?: string | null;
  isGkBlock?: boolean;
  isTeamLabel?: boolean;
  [key: string]: unknown;
}

export interface SlotDefinition {
  key: string;
  id: string;
  role: FormationRole;
  label?: string;
}

export interface SlotEntry {
  index: number | null;
  player: FormationPlayer | null;
}

export type SlotAssignments = Record<string, number>;

export interface FormationModel {
  moduleRaw: string;
  module: string;
  team: FormationPlayer[];
  selectedIndices: number[];
  definitions: { starter: SlotDefinition[]; bench: SlotDefinition[] };
  slots: { starter: Record<string, SlotEntry>; bench: Record<string, SlotEntry> };
  starters: SlotEntry[];
  bench: SlotEntry[];
  goalkeeperBenchLabels: string[];
  counts: { selected: number; starters: number; bench: number };
}

export interface FormationState {
  manager: string | null;
  module: string;
  selectedPlayers: number[];
  slotAssignments: SlotAssignments;
  switchStarterIndex: number | null;
  switchBenchIndex: number | null;
  switchPlus: boolean;
}

export const ROLE_LABELS: Record<FormationRole, string> = {
  P: "Portiere",
  D: "Difensore",
  C: "Centrocampista",
  A: "Attaccante"
};
