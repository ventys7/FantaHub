/* FORMATION MODEL - One source of truth for field, bench, output and Switch */

const api = (function () {
  const ROLE_ORDER = Object.freeze({ P: 0, D: 1, C: 2, A: 3 });
  const BENCH_CAPACITY = Object.freeze({ P: 2, D: 3, C: 3, A: 3 });

  function getModuleValue() {
    const module = document.getElementById("moduleSelect")?.value || "433";
    return ALLOWED_MODULES?.includes(module) ? module : "433";
  }

  function getRoleName(role) {
    return role === "P" ? "Portiere" : role === "D" ? "Difensore" : role === "C" ? "Centrocampista" : "Attaccante";
  }

  function getSlotDefinitions(module = getModuleValue()) {
    const starter = [
      { id: "GK1", key: "starter-GK1", role: "P", label: "POR" }
    ];

    [
      ["D", Number.parseInt(module[0], 10)],
      ["C", Number.parseInt(module[1], 10)],
      ["A", Number.parseInt(module[2], 10)]
    ].forEach(([role, count]) => {
      for (let position = 1; position <= count; position += 1) {
        starter.push({
          id: `${role}${position}`,
          key: `starter-${role}${position}`,
          role,
          label: getRoleName(role)
        });
      }
    });

    const bench = [];
    ["P", "D", "C", "A"].forEach((role) => {
      for (let position = 1; position <= BENCH_CAPACITY[role]; position += 1) {
        bench.push({
          id: `${role}${position}`,
          key: `bench-${role}${position}`,
          role,
          label: getRoleName(role)
        });
      }
    });

    return { starter, bench };
  }

  function entryForIndex(index, team) {
    if (!Number.isInteger(index) || !team[index]) return null;
    return { index, player: team[index] };
  }

  function roleMatches(definition, entry) {
    return Boolean(entry?.player) && entry.player.r === definition.role;
  }

  function getGoalkeeperBenchLabels(team, starters, selectedSet) {
    const starterGoalkeeper = starters.find((entry) => entry.player.r === "P");
    if (!starterGoalkeeper) return [];

    const labels = [starterGoalkeeper.player.t || "Portiere"];

    if (!starterGoalkeeper.player.gkBlock) return labels;

    const otherBlock = team.find((player, index) => {
      return (
        player?.r === "P" &&
        player.isGkBlock &&
        player.gkBlock !== starterGoalkeeper.player.gkBlock &&
        !selectedSet.has(index)
      );
    });

    if (otherBlock?.t) labels.push(otherBlock.t);
    return labels;
  }

  function build(input = {}) {
    const { team: teamArg, module: moduleArg, selectedPlayers: selectedArg, slotAssignments: assignmentsArg } = input;
    const team = teamArg || (typeof currentManager !== "undefined" && currentManager && db[currentManager]?.players) || null;
    if (!team) return null;

    const moduleRaw = moduleArg || getModuleValue();
    const definitions = getSlotDefinitions(moduleRaw);
    const selectedList = selectedArg != null
      ? selectedArg
      : (typeof selectedPlayers !== "undefined" ? selectedPlayers : []);
    const assignments = assignmentsArg != null
      ? assignmentsArg
      : (typeof slotAssignments !== "undefined" ? slotAssignments : {});

    const selectedSet = new Set(
      selectedList.filter((index) => Number.isInteger(index) && team[index])
    );
    const selectedIndices = [...selectedSet];
    const allDefinitions = [...definitions.starter, ...definitions.bench];
    const slots = { starter: {}, bench: {} };
    const usedIndices = new Set();
    let didCleanAssignments = false;

    // Honour manual positions first. A duplicate only survives in the first valid slot.
    allDefinitions.forEach((definition) => {
      const playerIndex = assignments[definition.key];
      const entry = entryForIndex(playerIndex, team);

      if (!selectedSet.has(playerIndex) || !roleMatches(definition, entry) || usedIndices.has(playerIndex)) {
        if (assignments[definition.key] !== undefined) {
          delete assignments[definition.key];
          didCleanAssignments = true;
        }
        return;
      }

      const side = definition.key.startsWith("starter-") ? "starter" : "bench";
      slots[side][definition.id] = entry;
      usedIndices.add(playerIndex);
    });

    const takeNextPlayer = (role) => {
      const nextIndex = selectedIndices.find((index) => !usedIndices.has(index) && team[index]?.r === role);
      if (!Number.isInteger(nextIndex)) return null;

      usedIndices.add(nextIndex);
      return entryForIndex(nextIndex, team);
    };

    definitions.starter.forEach((definition) => {
      if (!slots.starter[definition.id]) {
        const entry = takeNextPlayer(definition.role);
        if (entry) slots.starter[definition.id] = entry;
      }
    });

    definitions.bench.forEach((definition) => {
      if (!slots.bench[definition.id]) {
        const entry = takeNextPlayer(definition.role);
        if (entry) slots.bench[definition.id] = entry;
      }
    });

    const starters = definitions.starter
      .map((definition) => slots.starter[definition.id])
      .filter(Boolean);

    const bench = definitions.bench
      .map((definition) => slots.bench[definition.id])
      .filter(Boolean);

    const goalkeeperBenchLabels = getGoalkeeperBenchLabels(team, starters, selectedSet);

    const benchVisualCount = definitions.bench.filter((definition, index) => {
      return Boolean(slots.bench[definition.id]) || (definition.role === "P" && Boolean(goalkeeperBenchLabels[index]));
    }).length;

    const model = {
      manager: (typeof currentManager !== "undefined" ? currentManager : null),
      moduleRaw,
      module: [...moduleRaw].join("-"),
      team,
      selectedIndices,
      definitions,
      slots,
      starters,
      bench,
      goalkeeperBenchLabels,
      counts: {
        selected: selectedIndices.length,
        starters: starters.length,
        bench: benchVisualCount
      },
      changedAssignments: didCleanAssignments
    };

    return model;
  }

  function getSlotEntry(model, side, id) {
    return model?.slots?.[side]?.[id] || null;
  }

  function getBenchDisplayEntry(model, definition) {
    const entry = getSlotEntry(model, "bench", definition.id);
    if (entry) return entry;

    if (definition.role !== "P") return null;

    const labelIndex = Number.parseInt(definition.id.slice(1), 10) - 1;
    const label = model?.goalkeeperBenchLabels?.[labelIndex];
    if (!label) return null;

    return {
      index: null,
      player: {
        n: label,
        r: "P",
        t: "",
        isTeamLabel: true
      }
    };
  }

  function getSwitchLineup() {
    const model = build();
    return model
      ? { team: model.team, starters: model.starters, bench: model.bench }
      : { team: [], starters: [], bench: [] };
  }

  return Object.freeze({
    build,
    getSlotDefinitions,
    getSlotEntry,
    getBenchDisplayEntry,
    getSwitchLineup,
    roleOrder: ROLE_ORDER
  });
})();

if (typeof module === "object" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.FormationModel = api;
