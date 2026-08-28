import type { FormationPlayer, SlotAssignments, SlotDefinition } from "./formationTypes";

export interface PureFormationState {
  module: string;
  selectedPlayers: number[];
  slotAssignments: SlotAssignments;
}

export function selectedGkBlock(team: FormationPlayer[], selectedPlayers: number[]): string | null {
  for (const index of selectedPlayers) {
    const player = team[index];
    if (player?.r === "P" && player.gkBlock) return player.gkBlock;
  }
  return null;
}

export function definitionForSlot(definitions: SlotDefinition[], slotKey: string): SlotDefinition | undefined {
  return definitions.find((definition) => definition.key === slotKey);
}

/** Pure assignment: returns the next state (or the same reference if rejected). */
export function assignToSlot(
  state: PureFormationState,
  slotKey: string,
  playerIndex: number,
  definitions: SlotDefinition[],
  team: FormationPlayer[]
): PureFormationState {
  const def = definitionForSlot(definitions, slotKey);
  const player = team[playerIndex];
  if (!def || !player) return state;
  if (def.role !== player.r) return state; // role mismatch -> ignore

  // GK block constraint: cannot select two different keeper blocks at once.
  if (player.r === "P" && player.gkBlock) {
    const current = selectedGkBlock(team, state.selectedPlayers);
    if (current && current !== player.gkBlock) return state;
  }

  const assignments: SlotAssignments = { ...state.slotAssignments };
  // A player may occupy only one slot: drop it from any previous slot.
  for (const key of Object.keys(assignments)) {
    if (assignments[key] === playerIndex) delete assignments[key];
  }
  assignments[slotKey] = playerIndex;

  const selectedPlayers = state.selectedPlayers.includes(playerIndex)
    ? state.selectedPlayers
    : [...state.selectedPlayers, playerIndex];

  return { ...state, slotAssignments: assignments, selectedPlayers };
}

export function removeFromSlot(state: PureFormationState, slotKey: string): PureFormationState {
  const assignments: SlotAssignments = { ...state.slotAssignments };
  const idx = assignments[slotKey];
  delete assignments[slotKey];
  const selectedPlayers = Number.isInteger(idx)
    ? state.selectedPlayers.filter((i) => i !== idx)
    : state.selectedPlayers;
  return { ...state, slotAssignments: assignments, selectedPlayers };
}
