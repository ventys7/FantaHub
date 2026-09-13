function handleDrop(event, targetType, targetSlot) {
  event.preventDefault();
  event.stopPropagation();

  document.querySelectorAll(".drag-over").forEach((element) => {
    element.classList.remove("drag-over");
  });

  const playerIndex = draggedPlayerIndex;
  if (playerIndex === null || draggedPlayerRole === null) return;

  const team = db[currentManager].players;
  const player = team[playerIndex];
  const slotKey = targetType + "-" + targetSlot;
  const selection = window.FormationModel.canSelect({
    team,
    selectedPlayers,
    playerIndex,
    module: document.getElementById("moduleSelect").value
  });

  if (!selection.allowed) {
    showToast("Impossibile selezionare questo giocatore.", "error");
    return;
  }

  const playerRole = player.r;
  const targetRole = targetSlot.startsWith("GK") ? "P" : targetSlot[0];

  if (playerRole === "P" && targetRole !== "P") {
    showToast("I portieri vanno solo nello slot GK", "error");
    return;
  }

  if (playerRole !== "P" && targetRole === "P") {
    showToast("Solo i portieri vanno nello slot GK", "error");
    return;
  }

  if (playerRole !== targetRole) {
    showToast(`Questo slot è per ${getRoleName(targetRole)}`, "error");
    return;
  }

  if (playerRole === "P" && player?.isGkBlock) {
    if (!window.GkBlocks?.select(playerIndex, { slotKey })) return;
    refreshAfterGkChange();
    return;
  }

  Object.keys(slotAssignments).forEach((key) => {
    if (slotAssignments[key] === playerIndex) delete slotAssignments[key];
  });

  if (!selectedPlayers.includes(playerIndex)) selectedPlayers.push(playerIndex);
  slotAssignments[slotKey] = playerIndex;

  renderRoster();
  renderFormation();
  if (isMobile) renderMobileSlots();
}
