/* SWITCH SETUP - Bind controls once for desktop and mobile */

function bindSwitchClick(element, handler) {
  if (!element || element.dataset.switchBound === "true") return;

  element.dataset.switchBound = "true";
  element.addEventListener("click", handler);
}

function setupSwitchListeners() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupSwitchListeners, { once: true });
    return;
  }

  bindSwitchClick(document.getElementById("switchStarterSlot"), openSwitchStarterModal);
  bindSwitchClick(document.getElementById("switchBenchSlot"), openSwitchBenchModal);
  bindSwitchClick(document.getElementById("switchStarterSlotMobile"), openSwitchStarterModal);
  bindSwitchClick(document.getElementById("switchBenchSlotMobile"), openSwitchBenchModal);

  [
    document.getElementById("switchPlusBtn"),
    document.getElementById("switchPlusBtnMobile")
  ].forEach((button) => {
    bindSwitchClick(button, () => window.LineupSwitch?.togglePlus());
  });
}
