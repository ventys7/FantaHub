let currentPickerSlot = null;

function createPickerPhoto(player) {
  const portrait = document.createElement("span");
  portrait.className = "picker-player__photo";
  const url = player?.isTeamLabel
    ? window.LineupPlayerMedia?.crest(player.n)
    : window.LineupPlayerMedia?.photo(player?.n, player?.t);
  const letter = String(player?.n || "?").trim().charAt(0).toUpperCase() || "?";
  if (url) {
    const image = document.createElement("img");
    image.src = url;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    window.LineupPlayerMedia?.guardPhoto?.(image, { fallbackText: letter, mediaNode: portrait });
    portrait.appendChild(image);
  } else {
    portrait.textContent = letter;
  }
  return portrait;
}

function setupModalClickOutside() {
  const modals = [
    "slotPickerModal",
    "gkChoiceModal",
    "switchStarterModal",
    "switchBenchModal",
    "outputModal"
  ];

  modals.forEach((modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const box = modal.querySelector(".box");
    if (box) {
      box.addEventListener("click", (event) => event.stopPropagation());
      box.addEventListener("touchmove", (event) => event.stopPropagation(), { passive: false });
    }

    modal.addEventListener("click", (event) => {
      if (event.target !== modal) return;

      if (modalId === "slotPickerModal") closeSlotPicker();
      else if (modalId === "gkChoiceModal") closeGkModal();
      else if (modalId === "switchStarterModal") closeSwitchStarterModal();
      else if (modalId === "switchBenchModal") closeSwitchBenchModal();
      else if (modalId === "outputModal") closeModal();
    });
  });
}

function showSlotPicker(role, currentPlayer) {
  const modal = document.getElementById("slotPickerModal");
  const roleLabel = document.getElementById("pickerRoleLabel");
  const currentDiv = document.getElementById("currentPlayerInPicker");
  const listDiv = document.getElementById("pickerPlayerList");
  const roleNames = { P: "Portiere", D: "Difensore", C: "Centrocampista", A: "Attaccante" };

  roleLabel.textContent = roleNames[role] || role;

  if (currentPlayer) {
    currentDiv.style.display = "block";
    currentDiv.innerHTML = `<div class="picker-player in-slot">
      <div class="badge" style="background:${roleColors[role]}">${role}</div>
      <div class="player-info">
        <span class="name"></span>
        <span class="team"></span>
      </div>
      <span class="picker-remove-btn">✕</span>
    </div>`;
    const currentRow = currentDiv.querySelector(".picker-player");
    currentRow?.insertBefore(createPickerPhoto(currentPlayer), currentRow.firstChild);
    currentDiv.querySelector(".name").textContent = currentPlayer.n;
    currentDiv.querySelector(".team").textContent = currentPlayer.t || "";
    currentDiv.onclick = () => removeFromPicker();
  } else {
    currentDiv.style.display = "none";
  }

  const team = db[currentManager].players;
  const rolePlayers = team.filter((player) => player.r === role && !player.isGkBlock);
  listDiv.innerHTML = "";

  rolePlayers.forEach((player) => {
    const index = team.indexOf(player);
    const isSelected = selectedPlayers.includes(index);
    const option = document.createElement("div");
    option.className = "picker-player" + (isSelected ? " selected" : "");

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.style.background = roleColors[role];
    badge.textContent = role;

    const info = document.createElement("div");
    info.className = "player-info";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = player.n;
    const teamName = document.createElement("span");
    teamName.className = "team";
    teamName.textContent = player.t || "";
    info.append(name, teamName);

    option.append(createPickerPhoto(player), badge, info);

    if (isSelected) {
      const selectedIcon = document.createElement("span");
      selectedIcon.style.color = "var(--accent)";
      selectedIcon.textContent = "✓";
      option.appendChild(selectedIcon);
    }

    option.onclick = () => selectFromPicker(index);
    listDiv.appendChild(option);
  });

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  setModalOpen(true);
}

function selectFromPicker(playerIndex) {
  if (!currentPickerSlot) return;

  const { slotId, isStarter, currentPlayer } = currentPickerSlot;
  const team = db[currentManager].players;
  const slotKey = (isStarter ? "starter-" : "bench-") + slotId;
  const assignedIndex = slotAssignments[slotKey];
  const currentIndex = Number.isInteger(assignedIndex)
    ? assignedIndex
    : currentPlayer?.n
      ? team.findIndex((player) => player.n === currentPlayer.n && player.r === currentPlayer.r)
      : -1;
  const selection = window.FormationModel.canSelect({
    team,
    selectedPlayers,
    playerIndex,
    module: document.getElementById("moduleSelect").value,
    replacingIndex: currentIndex
  });

  if (!selection.allowed) {
    showToast("Impossibile selezionare questo giocatore.", "error");
    return;
  }

  if (currentIndex > -1 && selectedPlayers.includes(currentIndex)) {
    selectedPlayers = selectedPlayers.filter((index) => index !== currentIndex);
  }

  if (selectedPlayers.includes(playerIndex)) {
    Object.keys(slotAssignments).forEach((key) => {
      if (slotAssignments[key] === playerIndex) delete slotAssignments[key];
    });
    selectedPlayers = selectedPlayers.filter((index) => index !== playerIndex);
  }

  selectedPlayers.push(playerIndex);
  slotAssignments[slotKey] = playerIndex;

  closeSlotPicker();
  renderMobileSlots();
  if (!isMobile) renderFormation();
}

function removeFromPicker() {
  if (!currentPickerSlot) return;

  const { slotId, currentPlayer, isStarter } = currentPickerSlot;
  const slotKey = (isStarter ? "starter-" : "bench-") + slotId;

  if (currentPlayer?.n) {
    const team = db[currentManager].players;
    const currentIndex = team.findIndex(
      (player) => player.n === currentPlayer.n && player.r === currentPlayer.r
    );
    if (currentIndex > -1 && selectedPlayers.includes(currentIndex)) {
      selectedPlayers = selectedPlayers.filter((index) => index !== currentIndex);
    }
  }

  delete slotAssignments[slotKey];
  closeSlotPicker();
  renderMobileSlots();
  if (!isMobile) renderFormation();
}

function closeSlotPicker() {
  const modal = document.getElementById("slotPickerModal");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  currentPickerSlot = null;
  setModalOpen(false);
}

function showGkChoiceModalForMobile(slotId, isStarter, currentPlayer) {
  if (!currentManager) return;

  const team = db[currentManager].players;
  const groups = window.GkBlocks?.getGroups().filter((group) => group.blockName) || [];
  if (groups.length === 0) return;

  currentPickerSlot = { slotId, role: "P", isStarter, currentPlayer };

  const modal = document.getElementById("gkChoiceModal");
  const choicesDiv = document.getElementById("gkChoices");
  const blockName = document.getElementById("gkBlockName");
  const selectedGoalkeeper = window.GkBlocks?.getSelectedPlayer();

  blockName.textContent = "Portiere";
  choicesDiv.innerHTML = "";

  if (selectedGoalkeeper) {
    const selectedRow = document.createElement("div");
    selectedRow.className = "gk-current-selection";

    const label = document.createElement("span");
    label.textContent = `${selectedGoalkeeper.n}${selectedGoalkeeper.t ? ` · ${selectedGoalkeeper.t}` : ""}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "gk-current-selection__remove";
    removeButton.setAttribute("aria-label", "Rimuovi portiere selezionato");
    removeButton.textContent = "✕";
    removeButton.onclick = () => removeCurrentGk();

    selectedRow.append(label, removeButton);
    choicesDiv.appendChild(selectedRow);
  }

  groups.forEach((group) => {
    const representative = group.players[0]?.player;
    const groupTeam = representative?.t || "";
    const selectedIndex = window.GkBlocks?.getSelectedIndexForBlock(group.blockName);
    const isDisabled = window.GkBlocks?.isBlockDisabled(group.blockName);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gk-block-btn";
    button.textContent = `${group.blockName}${groupTeam ? ` (${groupTeam})` : ""}`;

    if (isDisabled) {
      button.disabled = true;
      button.title = "Rimuovi prima il blocco portieri selezionato";
    }

    if (Number.isInteger(selectedIndex)) {
      button.classList.add("selected");
    }

    button.onclick = () => showGkChoiceModal(group.blockName, { mode: "mobile" });
    choicesDiv.appendChild(button);
  });

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  setModalOpen(true);
}

function removeCurrentGk() {
  if (!window.GkBlocks?.remove()) return;

  closeGkModal();
  renderRoster();
  renderFormation();
  if (isMobile) renderMobileSlots();
  updateSwitchUI();
}

function confirmGkSelectionMobile(index) {
  if (!window.GkBlocks?.select(index)) return;

  closeGkModal();
  renderRoster();
  renderFormation();
  if (isMobile) renderMobileSlots();
  updateSwitchUI();
}
