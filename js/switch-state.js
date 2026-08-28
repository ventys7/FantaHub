/* SWITCH STATE - One optional Switch, Base or Plus */

let switchStarterIndex = null;
let switchBenchIndex = null;
let switchPlus = false;

const api = (function () {
  function getTeam() {
    return currentManager && db[currentManager]?.players
      ? db[currentManager].players
      : [];
  }

  function getState() {
    return Object.freeze({
      starterIndex: switchStarterIndex,
      benchIndex: switchBenchIndex,
      plus: Boolean(switchPlus)
    });
  }

  function getLineup() {
    if (typeof getSwitchLineup === "function") {
      return getSwitchLineup();
    }

    return { team: getTeam(), starters: [], bench: [] };
  }

  function uniqueEntries(entries) {
    const seen = new Set();

    return (entries || []).filter((entry) => {
      if (!entry || !Number.isInteger(entry.index) || !entry.player) return false;
      if (seen.has(entry.index)) return false;
      seen.add(entry.index);
      return true;
    });
  }

  function getCandidates() {
    const lineup = getLineup();
    const withoutGoalkeepers = (entries) => uniqueEntries(entries).filter(({ player }) => player?.r !== "P");

    return {
      starters: withoutGoalkeepers(lineup.starters),
      bench: withoutGoalkeepers(lineup.bench)
    };
  }

  function getPlayer(index, team = getTeam()) {
    return Number.isInteger(index) ? team[index] || null : null;
  }

  function hasCandidate(entries, index) {
    return entries.some((entry) => entry.index === index);
  }

  function messageForInvalidPair(plus) {
    return plus
      ? "Nello Switch Plus devi usare due ruoli diversi. I portieri non sono ammessi."
      : "Nello Switch Base devi usare due giocatori dello stesso ruolo. I portieri non sono ammessi.";
  }

  function isPairValid(starterIndex, benchIndex, plus = switchPlus, lineup = getLineup()) {
    if (!Number.isInteger(starterIndex) || !Number.isInteger(benchIndex)) return false;
    if (starterIndex === benchIndex) return false;

    const team = lineup.team || getTeam();
    const starter = getPlayer(starterIndex, team);
    const bench = getPlayer(benchIndex, team);

    if (!starter || !bench) return false;
    if (starter.r === "P" || bench.r === "P") return false;

    const starters = uniqueEntries(lineup.starters);
    const benchEntries = uniqueEntries(lineup.bench);

    if (!hasCandidate(starters, starterIndex) || !hasCandidate(benchEntries, benchIndex)) {
      return false;
    }

    if (plus) return starter.r !== bench.r;
    return starter.r === bench.r;
  }

  function notify() {
    if (typeof updateSwitchUI === "function") updateSwitchUI();
    window.LineupPersistence?.queueDraftSave?.();
  }

  function setStarter(index) {
    const candidates = getCandidates();
    const team = getTeam();
    const starter = getPlayer(index, team);

    if (!starter || !hasCandidate(candidates.starters, index)) {
      showToast("Scegli un calciatore di movimento che risulta tra i titolari.", "error");
      return false;
    }

    if (starter.r === "P") {
      showToast("Lo Switch non può includere portieri.", "error");
      return false;
    }

    if (switchBenchIndex !== null && !isPairValid(index, switchBenchIndex, switchPlus)) {
      showToast(messageForInvalidPair(switchPlus), "error");
      return false;
    }

    switchStarterIndex = index;
    notify();
    return true;
  }

  function setBench(index) {
    const candidates = getCandidates();
    const team = getTeam();
    const bench = getPlayer(index, team);

    if (!bench || !hasCandidate(candidates.bench, index)) {
      showToast("Scegli un calciatore di movimento che risulta in panchina.", "error");
      return false;
    }

    if (bench.r === "P") {
      showToast("Lo Switch non può includere portieri.", "error");
      return false;
    }

    if (switchStarterIndex !== null && !isPairValid(switchStarterIndex, index, switchPlus)) {
      showToast(messageForInvalidPair(switchPlus), "error");
      return false;
    }

    switchBenchIndex = index;
    notify();
    return true;
  }

  function setPlus(nextValue) {
    const nextPlus = Boolean(nextValue);
    if (nextPlus === switchPlus) return true;

    const team = getTeam();
    const selectedPlayersForSwitch = [
      getPlayer(switchStarterIndex, team),
      getPlayer(switchBenchIndex, team)
    ].filter(Boolean);

    if (nextPlus && selectedPlayersForSwitch.some((player) => player.r === "P")) {
      showToast("Nello Switch Plus non puoi usare portieri.", "error");
      return false;
    }

    if (
      switchStarterIndex !== null &&
      switchBenchIndex !== null &&
      !isPairValid(switchStarterIndex, switchBenchIndex, nextPlus)
    ) {
      showToast(messageForInvalidPair(nextPlus), "error");
      return false;
    }

    switchPlus = nextPlus;
    notify();
    return true;
  }

  function togglePlus() {
    return setPlus(!switchPlus);
  }

  function clear(target = "all", { resetMode = false } = {}) {
    if (target === "starter") switchStarterIndex = null;
    if (target === "bench") switchBenchIndex = null;

    if (target === "all") {
      switchStarterIndex = null;
      switchBenchIndex = null;
    }

    if (resetMode) switchPlus = false;

    notify();
  }

  function reconcile() {
    const candidates = getCandidates();
    const team = getTeam();
    let changed = false;

    if (
      switchStarterIndex !== null &&
      (!getPlayer(switchStarterIndex, team) || !hasCandidate(candidates.starters, switchStarterIndex))
    ) {
      switchStarterIndex = null;
      changed = true;
    }

    if (
      switchBenchIndex !== null &&
      (!getPlayer(switchBenchIndex, team) || !hasCandidate(candidates.bench, switchBenchIndex))
    ) {
      switchBenchIndex = null;
      changed = true;
    }

    if (getPlayer(switchStarterIndex, team)?.r === "P") {
      switchStarterIndex = null;
      changed = true;
    }

    if (getPlayer(switchBenchIndex, team)?.r === "P") {
      switchBenchIndex = null;
      changed = true;
    }

    if (
      switchStarterIndex !== null &&
      switchBenchIndex !== null &&
      !isPairValid(switchStarterIndex, switchBenchIndex, switchPlus, {
        team,
        starters: candidates.starters,
        bench: candidates.bench
      })
    ) {
      switchStarterIndex = null;
      switchBenchIndex = null;
      changed = true;
    }

    if (changed) notify();
    return changed;
  }

  function getPairForModel(model) {
    if (!model || !isPairValid(switchStarterIndex, switchBenchIndex, switchPlus, model)) {
      return null;
    }

    return {
      starterIndex: switchStarterIndex,
      benchIndex: switchBenchIndex,
      starter: model.team[switchStarterIndex],
      bench: model.team[switchBenchIndex],
      type: switchPlus ? "plus" : "base"
    };
  }

  return Object.freeze({
    getState,
    getCandidates,
    getPairForModel,
    isPairValid,
    setStarter,
    setBench,
    setPlus,
    togglePlus,
    clear,
    reconcile
  });
})();

if (typeof module === "object" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.LineupSwitch = api;
