/* GK BLOCKS - One logical goalkeeper block, one selected goalkeeper */

const api = (function () {
  function getTeam() {
    return currentManager && db[currentManager]?.players
      ? db[currentManager].players
      : [];
  }

  function getGoalkeeperIndices() {
    const team = getTeam();
    return selectedPlayers.filter((index) => team[index]?.r === "P");
  }

  function getSelectedIndex() {
    return getGoalkeeperIndices()[0] ?? null;
  }

  function getSelectedPlayer() {
    const index = getSelectedIndex();
    const team = getTeam();
    return Number.isInteger(index) ? team[index] ?? null : null;
  }

  function getGroups(teamArg = null) {
    const team = teamArg || getTeam();
    const groups = new Map();

    team.forEach((player, index) => {
      if (player?.r !== "P") return;

      const key = player.gkBlock || `single:${index}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          blockName: player.gkBlock || null,
          players: []
        });
      }

      groups.get(key).players.push({ player, index });
    });

    return [...groups.values()];
  }

  function getGroup(blockName) {
    return getGroups().find((group) => group.blockName === blockName) || null;
  }

  function getSelectedIndexForBlock(blockName) {
    const team = getTeam();
    return getGoalkeeperIndices().find(
      (index) => team[index]?.gkBlock === blockName
    ) ?? null;
  }

  function resolve(team, selectedPlayers) {
    const groups = getGroups(team);
    const selectedIndex = (selectedPlayers || []).find((index) => team[index]?.r === "P") ?? null;
    const selectedPlayer = Number.isInteger(selectedIndex) ? team[selectedIndex] : null;
    const selectedBlock = selectedPlayer?.gkBlock || null;
    const disabledBlocks = selectedBlock
      ? groups.filter((group) => group.blockName && group.blockName !== selectedBlock).map((group) => group.blockName)
      : [];

    return { groups, selectedIndex, selectedPlayer, selectedBlock, disabledBlocks };
  }

  function isBlockDisabled(blockName) {
    return Boolean(blockName && disabledBlocks.has(blockName));
  }

  function isGoalkeeperSlot(slotKey) {
    return slotKey === "starter-GK1" || /^bench-P[12]$/.test(slotKey);
  }

  function clearGoalkeeperAssignments() {
    Object.keys(slotAssignments).forEach((slotKey) => {
      if (isGoalkeeperSlot(slotKey)) delete slotAssignments[slotKey];
    });
  }

  function syncDisabledBlocks() {
    disabledBlocks.clear();

    const selected = getSelectedPlayer();
    if (!selected?.gkBlock) return;

    getGroups().forEach((group) => {
      if (group.blockName && group.blockName !== selected.gkBlock) {
        disabledBlocks.add(group.blockName);
      }
    });
  }

  function select(index, { slotKey = null, allowReplace = false } = {}) {
    const team = getTeam();
    const player = team[index];

    if (!player || player.r !== "P") return false;

    const selected = getSelectedPlayer();
    const selectingDifferentBlock =
      selected?.gkBlock &&
      player.gkBlock &&
      selected.gkBlock !== player.gkBlock;

    if (selectingDifferentBlock && !allowReplace) {
      showToast("Rimuovi prima il blocco portieri già selezionato.", "error");
      return false;
    }

    if (!selected && selectedPlayers.length >= MAX_SELECTED) {
      showToast(`Puoi selezionare massimo ${MAX_SELECTED} giocatori.`, "error");
      return false;
    }

    selectedPlayers = selectedPlayers.filter((playerIndex) => team[playerIndex]?.r !== "P");
    clearGoalkeeperAssignments();
    selectedPlayers.push(index);

    if (slotKey && isGoalkeeperSlot(slotKey)) {
      slotAssignments[slotKey] = index;
    }

    syncDisabledBlocks();
    return true;
  }

  function remove(index = getSelectedIndex()) {
    const team = getTeam();
    if (!Number.isInteger(index) || !team[index] || team[index].r !== "P") {
      return false;
    }

    selectedPlayers = selectedPlayers.filter((playerIndex) => team[playerIndex]?.r !== "P");
    clearGoalkeeperAssignments();
    syncDisabledBlocks();
    return true;
  }

  function reset() {
    clearGoalkeeperAssignments();
    syncDisabledBlocks();
  }

  return Object.freeze({
    getGroups,
    getGroup,
    resolve,
    getSelectedIndex,
    getSelectedPlayer,
    getSelectedIndexForBlock,
    isBlockDisabled,
    syncDisabledBlocks,
    clearGoalkeeperAssignments,
    select,
    remove,
    reset
  });
})();

if (typeof module === "object" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.GkBlocks = api;
