/* ROSTER - Roster rendering and player toggle */

function renderRoster() {
  const container = document.getElementById("roster");
  container.innerHTML = "";
  if (!currentManager) return;

  const team = db[currentManager];
  const shownBlocks = new Set();

  team.players.forEach((player, index) => {
    if (player.isGkBlock && shownBlocks.has(player.gkBlock)) return;
    if (player.isGkBlock) shownBlocks.add(player.gkBlock);

    const selectedGkIndex = player.isGkBlock
      ? window.GkBlocks?.getSelectedIndexForBlock(player.gkBlock)
      : null;
    const isDisabled = player.isGkBlock && window.GkBlocks?.isBlockDisabled(player.gkBlock);
    const cardPlayerIndex = Number.isInteger(selectedGkIndex) ? selectedGkIndex : index;

    const card = document.createElement("div");
    card.className = "player-card";
    card.id = `p-${index}`;
    card.dataset.playerIndex = String(cardPlayerIndex);

    if (player.isGkBlock) card.dataset.gkBlock = player.gkBlock;
    if (isDisabled) card.classList.add("disabled");

    const hasDraggablePlayer = !player.isGkBlock || Number.isInteger(selectedGkIndex);
    card.tabIndex = isDisabled ? -1 : 0;
    card.draggable = !isDisabled && hasDraggablePlayer;

    card.ondragstart = () => {
      draggedPlayerIndex = cardPlayerIndex;
      draggedPlayerRole = player.r;
      card.classList.add("dragging");
    };

    card.ondragend = () => {
      draggedPlayerIndex = null;
      draggedPlayerRole = null;
      card.classList.remove("dragging");
    };

    card.onclick = isDisabled ? null : () => togglePlayer(index);
    card.onkeydown = isDisabled
      ? null
      : (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            togglePlayer(index);
          }
        };

    const left = document.createElement("div");
    left.className = "player-left";

    const media = document.createElement("span");
    media.className = "player-card__photo";
    const mediaUrl = player.isGkBlock
      ? window.LineupPlayerMedia?.crest(player.t)
      : window.LineupPlayerMedia?.photo(player.n, player.t);
    const mediaLetter = (player.n || player.gkBlock || "?").trim().charAt(0).toUpperCase() || "?";
    if (mediaUrl) {
      const image = document.createElement("img");
      image.src = mediaUrl;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      if (player.isGkBlock) image.className = "is-crest";
      window.LineupPlayerMedia?.guardPhoto?.(image, { fallbackText: mediaLetter, mediaNode: media });
      media.appendChild(image);
    } else {
      media.textContent = mediaLetter;
    }

    const badge = document.createElement("div");
    badge.className = "badge " + (player.r || "U");
    badge.textContent = player.r || "?";

    const meta = document.createElement("div");
    const displayName = player.isGkBlock ? player.gkBlock : player.n;
    const nameEl = document.createElement("div");
    nameEl.className = "player-meta";
    nameEl.textContent = displayName;

    const teamEl = document.createElement("div");
    teamEl.className = "player-sub";
    teamEl.textContent = player.t || "";

    meta.appendChild(nameEl);
    meta.appendChild(teamEl);
    left.appendChild(media);
    left.appendChild(badge);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "player-card__status";

    if (isDisabled) {
      right.textContent = "🔒";
    } else if (player.isGkBlock && Number.isInteger(selectedGkIndex)) {
      right.textContent = "✓";
      right.setAttribute("aria-label", "Blocco portieri selezionato");
    }

    card.appendChild(left);
    card.appendChild(right);
    container.appendChild(card);
  });

  updateRosterUI();
}

function togglePlayer(index) {
  if (!currentManager) return;

  const player = db[currentManager].players[index];
  if (!player) return;

  if (player.r === "P" && player.isGkBlock) {
    const selectedGkIndex = window.GkBlocks?.getSelectedIndexForBlock(player.gkBlock);

    if (Number.isInteger(selectedGkIndex)) {
      window.GkBlocks.remove(selectedGkIndex);
      refreshAfterGkChange();
      return;
    }

    if (window.GkBlocks?.isBlockDisabled(player.gkBlock)) {
      showToast("Hai già selezionato un altro blocco portieri!", "error");
      return;
    }

    showGkChoiceModal(player.gkBlock);
    return;
  }

  if (selectedPlayers.includes(index)) {
    selectedPlayers = selectedPlayers.filter((playerIndex) => playerIndex !== index);
    renderRoster();
    renderFormation();
    if (isMobile) renderMobileSlots();
    return;
  }

  const module = document.getElementById("moduleSelect").value;
  const selection = window.FormationModel.canSelect({
    team: db[currentManager].players,
    selectedPlayers,
    playerIndex: index,
    module
  });

  if (!selection.allowed) {
    if (selection.reason === "max-selected") {
      showToast(`Puoi selezionare massimo ${MAX_SELECTED} giocatori.`, "error");
    } else if (selection.reason === "role-capacity") {
      const definitions = window.FormationModel.getSlotDefinitions(module);
      const starterMax = definitions.starter.filter(({ role }) => role === player.r).length;
      const benchMax = definitions.bench.filter(({ role }) => role === player.r).length;
      const roleName = player.r === "P" ? "portieri" : player.r === "D" ? "difensori" : player.r === "C" ? "centrocampisti" : "attaccanti";
      showToast(`Hai già raggiunto il massimo per i ${roleName} (${starterMax} titolari + ${benchMax} panchina)`, "error");
    } else {
      showToast("Ruolo giocatore sconosciuto.", "error");
    }
    return;
  }

  selectedPlayers.push(index);
  renderRoster();
  renderFormation();
  if (isMobile) renderMobileSlots();
}

function updateRosterUI() {
  document.querySelectorAll("#roster .player-card").forEach((card) => {
    card.classList.remove("selected");

    const isSelectedPlayer = selectedPlayers.includes(Number(card.dataset.playerIndex));
    const selectedGkForBlock =
      card.dataset.gkBlock &&
      Number.isInteger(window.GkBlocks?.getSelectedIndexForBlock(card.dataset.gkBlock));

    if (isSelectedPlayer || selectedGkForBlock) card.classList.add("selected");
  });
}

function loadTeam() {
  currentManager = document.getElementById("managerSelect").value;
  selectedPlayers = [];
  disabledBlocks.clear();
  slotAssignments = {};
  clearSwitch();
  renderRoster();
  renderFormation();
  if (isMobile) renderMobileSlots();
  updateSwitchUI();
}
