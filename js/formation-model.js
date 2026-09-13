/* FORMATION MODEL - One source of truth for field, bench, output and Switch */

const formationModelApi = (function () {
  const ROLE_ORDER = Object.freeze({ P: 0, D: 1, C: 2, A: 3 });
  const BENCH_CAPACITY = Object.freeze({ P: 2, D: 3, C: 3, A: 3 });
  const STANDARD_MODULES = Object.freeze(["343", "352", "433", "442", "451", "532", "541"]);
  const MAX_SELECTED = 22;

  function normalizeModule(module) {
    return STANDARD_MODULES.includes(module) ? module : "433";
  }

  function getModuleValue() {
    const module = typeof document === "undefined"
      ? "433"
      : document.getElementById("moduleSelect")?.value || "433";
    return normalizeModule(module);
  }

  function getRoleName(role) {
    return role === "P" ? "Portiere" : role === "D" ? "Difensore" : role === "C" ? "Centrocampista" : role === "A" ? "Attaccante" : "Ruolo sconosciuto";
  }

  function canSelect({ team, selectedPlayers = [], playerIndex, module, replacingIndex } = {}) {
    const player = team?.[playerIndex];
    if (!player || ROLE_ORDER[player.r] === undefined) return { allowed: false, reason: "unknown-role" };

    const selected = new Set(selectedPlayers.filter((index) => Number.isInteger(index) && team[index]));
    if (selected.has(playerIndex)) return { allowed: true };
    selected.delete(replacingIndex);

    if (selected.size >= MAX_SELECTED) return { allowed: false, reason: "max-selected" };

    const normalizedModule = normalizeModule(module);
    const roleCapacity = getSlotDefinitions(normalizedModule).starter.filter(({ role }) => role === player.r).length + BENCH_CAPACITY[player.r];
    const selectedInRole = [...selected].filter((index) => team[index].r === player.r).length;
    if (selectedInRole >= roleCapacity) return { allowed: false, reason: "role-capacity" };

    return { allowed: true };
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

  function reconcileAssignments({ team = [], selectedPlayers = [], slotAssignments = {}, module } = {}) {
    const selectedSet = new Set(
      selectedPlayers.filter((index) => Number.isInteger(index) && team[index])
    );
    const assignments = {};
    const usedIndices = new Set();
    const definitions = getSlotDefinitions(normalizeModule(module));

    [...definitions.starter, ...definitions.bench].forEach((definition) => {
      const playerIndex = slotAssignments[definition.key];
      const entry = entryForIndex(playerIndex, team);
      if (!selectedSet.has(playerIndex) || !roleMatches(definition, entry) || usedIndices.has(playerIndex)) return;

      assignments[definition.key] = playerIndex;
      usedIndices.add(playerIndex);
    });

    return {
      assignments,
      changed: Object.keys(assignments).length !== Object.keys(slotAssignments).length
    };
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

    const moduleRaw = normalizeModule(moduleArg || getModuleValue());
    const definitions = getSlotDefinitions(moduleRaw);
    const selectedList = selectedArg != null
      ? selectedArg
      : (typeof selectedPlayers !== "undefined" ? selectedPlayers : []);
    const inputAssignments = assignmentsArg != null
      ? assignmentsArg
      : (typeof slotAssignments !== "undefined" ? slotAssignments : {});
    const reconciledAssignments = reconcileAssignments({
      team,
      selectedPlayers: selectedList,
      slotAssignments: inputAssignments,
      module: moduleRaw
    });
    const assignments = reconciledAssignments.assignments;

    const selectedSet = new Set(
      selectedList.filter((index) => Number.isInteger(index) && team[index])
    );
    const selectedIndices = [...selectedSet];
    const allDefinitions = [...definitions.starter, ...definitions.bench];
    const slots = { starter: {}, bench: {} };
    const usedIndices = new Set();

    // Honour manual positions first. A duplicate only survives in the first valid slot.
    allDefinitions.forEach((definition) => {
      const playerIndex = assignments[definition.key];
      if (!Number.isInteger(playerIndex)) return;

      const entry = entryForIndex(playerIndex, team);

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
      changedAssignments: reconciledAssignments.changed
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
    canSelect,
    getRoleName,
    reconcileAssignments,
    getSlotDefinitions,
    getSlotEntry,
    getBenchDisplayEntry,
    getSwitchLineup,
    allowedModules: typeof ALLOWED_MODULES !== "undefined" ? ALLOWED_MODULES : STANDARD_MODULES,
    roleOrder: ROLE_ORDER
  });
})();

if (typeof module === "object" && module.exports) module.exports = formationModelApi;
if (typeof window !== "undefined") window.FormationModel = formationModelApi;
