/* SWITCH LOGIC - Formation adapters and legacy helpers */

function clearSwitch() {
  if (window.LineupSwitch) {
    window.LineupSwitch.clear("all", { resetMode: true });
    return;
  }

  switchStarterIndex = null;
  switchBenchIndex = null;
  switchPlus = false;
  if (typeof updateSwitchUI === "function") updateSwitchUI();
}

function getSwitchLineup() {
  if (window.FormationModel?.getSwitchLineup) {
    return window.FormationModel.getSwitchLineup();
  }

  return { team: [], starters: [], bench: [] };
}

function getStarters() {
  return getSwitchLineup().starters.map((entry) => entry.player);
}
