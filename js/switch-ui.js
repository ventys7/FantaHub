/* SWITCH UI - Shared desktop/mobile rendering, rebuilt as a compact visual pair */

function updateSwitchUI() {
  const switchSection = document.getElementById("switchSection");
  const switchSectionMobile = document.getElementById("mobileSwitchSection");
  const isVisible = Boolean(currentManager);

  if (switchSection) switchSection.style.display = isVisible ? "block" : "none";
  if (switchSectionMobile) switchSectionMobile.style.display = isVisible ? "block" : "none";
  if (!isVisible || !db || !currentManager || !db[currentManager]) return;

  const team = db[currentManager].players || [];
  const state = window.LineupSwitch?.getState() || {
    starterIndex: switchStarterIndex,
    benchIndex: switchBenchIndex,
    plus: switchPlus
  };

  function renderSwitchSlot(slotEl, playerIndex) {
    if (!slotEl) return;

    const player = Number.isInteger(playerIndex) ? team[playerIndex] : null;
    slotEl.replaceChildren();
    slotEl.classList.toggle("has-player", Boolean(player));
    slotEl.dataset.role = player?.r || "";

    const content = document.createElement("span");
    content.className = "switch-slot-content";

    if (!player) {
      const placeholder = document.createElement("span");
      placeholder.className = "switch-slot-placeholder";
      placeholder.textContent = "＋";
      content.appendChild(placeholder);
    } else {
      const role = document.createElement("span");
      role.className = "switch-slot__role";
      role.dataset.role = player.r;
      role.textContent = player.r;

      const identity = document.createElement("span");
      identity.className = "switch-slot__identity";

      const name = document.createElement("span");
      name.className = "switch-slot__name";
      name.textContent = player.n || "Giocatore";

      const club = document.createElement("span");
      club.className = "switch-slot__team";
      club.textContent = player.t || "";

      identity.append(name, club);
      content.append(role, identity);
    }

    slotEl.appendChild(content);
  }

  renderSwitchSlot(document.getElementById("switchStarterSlot"), state.starterIndex);
  renderSwitchSlot(document.getElementById("switchBenchSlot"), state.benchIndex);
  renderSwitchSlot(document.getElementById("switchStarterSlotMobile"), state.starterIndex);
  renderSwitchSlot(document.getElementById("switchBenchSlotMobile"), state.benchIndex);

  function setClearVisibility(button, value) {
    if (button) button.style.display = Number.isInteger(value) ? "inline-flex" : "none";
  }

  setClearVisibility(document.getElementById("clearStarterSwitch"), state.starterIndex);
  setClearVisibility(document.getElementById("clearBenchSwitch"), state.benchIndex);
  setClearVisibility(document.getElementById("clearStarterSwitchMobile"), state.starterIndex);
  setClearVisibility(document.getElementById("clearBenchSwitchMobile"), state.benchIndex);

  [
    document.getElementById("switchPlusBtn"),
    document.getElementById("switchPlusBtnMobile")
  ].forEach((button) => {
    if (!button) return;
    button.classList.toggle("active", state.plus);
    button.dataset.mode = state.plus ? "plus" : "base";
    button.setAttribute("aria-pressed", String(state.plus));
    button.title = state.plus ? "Switch Plus attivo" : "Passa allo Switch Plus";
  });
}
