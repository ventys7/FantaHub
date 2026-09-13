"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function loadScripts(files, setup) {
  const context = { console };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(setup, context);
  files.forEach((file) => vm.runInContext(readFileSync(path.join(ROOT, file), "utf8"), context));
  return context;
}

test("roster rejects a defender over capacity through the shared guard", () => {
  const context = loadScripts(["js/formation-model.js"], `
    const MAX_SELECTED = 22;
    const db = { manager: { players: Array.from({ length: 8 }, (_, index) => ({ r: "D", n: "D" + index })) } };
    let currentManager = "manager";
    let selectedPlayers = [0, 1, 2, 3, 4, 5, 6];
    let slotAssignments = {};
    let draggedPlayerIndex = null;
    let draggedPlayerRole = null;
    let isMobile = true;
    const disabledBlocks = new Set();
    const effects = [];
    const moduleSelect = { value: "433" };
    const document = {
      getElementById(id) { return id === "moduleSelect" ? moduleSelect : null; },
      querySelectorAll() { return []; }
    };
    function renderRoster() { effects.push("roster"); }
    function renderFormation() { effects.push("formation"); }
    function renderMobileSlots() { effects.push("mobile"); }
    function showToast(message, type) { effects.push(type + ":" + message); }
    function refreshAfterGkChange() {}
    function showGkChoiceModal() {}
    function clearSwitch() {}
    function updateSwitchUI() {}
  `);
  vm.runInContext(`
    const originalCanSelect = FormationModel.canSelect;
    const guardCalls = [];
    window.FormationModel = {
      ...FormationModel,
      canSelect(input) {
        guardCalls.push(input.playerIndex);
        return originalCanSelect(input);
      }
    };
  `, context);
  vm.runInContext(readFileSync(path.join(ROOT, "js/roster.js"), "utf8"), context);

  vm.runInContext("togglePlayer(7)", context);

  assert.deepEqual(
    JSON.parse(vm.runInContext("JSON.stringify({ selectedPlayers, effects, guardCalls })", context)),
    {
      selectedPlayers: [0, 1, 2, 3, 4, 5, 6],
      effects: ["error:Hai già raggiunto il massimo per i difensori (4 titolari + 3 panchina)"],
      guardCalls: [7]
    }
  );
});

test("picker checks replacement capacity before mutating selection or assignments", () => {
  const context = loadScripts(["js/formation-model.js"], `
    const team = [
      { r: "D", n: "D0" }, { r: "D", n: "D1" }, { r: "D", n: "D2" },
      { r: "D", n: "D3" }, { r: "D", n: "D4" }, { r: "D", n: "D5" },
      { r: "D", n: "D6" }, { r: "C", n: "C0" }, { r: "D", n: "D7" }
    ];
    const db = { manager: { players: team } };
    let currentManager = "manager";
    let selectedPlayers = [0, 1, 2, 3, 4, 5, 6, 7];
    let slotAssignments = { "starter-D1": 7 };
    let isMobile = false;
    const effects = [];
    const moduleSelect = { value: "433" };
    const modal = { classList: { remove() {} }, setAttribute() {} };
    const document = {
      getElementById(id) { return id === "moduleSelect" ? moduleSelect : modal; },
      createElement() { return {}; }
    };
    function setModalOpen(open) { effects.push("modal:" + open); }
    function renderMobileSlots() { effects.push("mobile"); }
    function renderFormation() { effects.push("formation"); }
    function showToast(message, type) { effects.push(type); }
  `);
  vm.runInContext(`
    const originalCanSelect = FormationModel.canSelect;
    const guardCalls = [];
    window.FormationModel = {
      ...FormationModel,
      canSelect(input) {
        guardCalls.push({
          playerIndex: input.playerIndex,
          replacingIndex: input.replacingIndex,
          selectedPlayers: input.selectedPlayers.slice(),
          slotAssignments: { ...slotAssignments }
        });
        return originalCanSelect(input);
      }
    };
  `, context);
  vm.runInContext(readFileSync(path.join(ROOT, "js/picker.js"), "utf8"), context);
  vm.runInContext(`currentPickerSlot = { slotId: "D1", isStarter: true, currentPlayer: team[7] }`, context);

  vm.runInContext("selectFromPicker(8)", context);

  assert.deepEqual(
    JSON.parse(vm.runInContext("JSON.stringify({ selectedPlayers, slotAssignments, effects, guardCalls })", context)),
    {
      selectedPlayers: [0, 1, 2, 3, 4, 5, 6, 7],
      slotAssignments: { "starter-D1": 7 },
      effects: ["error"],
      guardCalls: [{
        playerIndex: 8,
        replacingIndex: 7,
        selectedPlayers: [0, 1, 2, 3, 4, 5, 6, 7],
        slotAssignments: { "starter-D1": 7 }
      }]
    }
  );
});

function runDrop({ team, selectedPlayers, playerIndex, draggedRole }) {
  const context = loadScripts(["js/formation-model.js"], `
    const db = { manager: { players: ${JSON.stringify(team)} } };
    let currentManager = "manager";
    let selectedPlayers = ${JSON.stringify(selectedPlayers)};
    let slotAssignments = {};
    let draggedPlayerIndex = ${playerIndex};
    let draggedPlayerRole = ${JSON.stringify(draggedRole)};
    let isMobile = true;
    const effects = [];
    const moduleSelect = { value: "433" };
    const document = {
      getElementById(id) { return id === "moduleSelect" ? moduleSelect : null; },
      querySelectorAll() { return []; }
    };
    function showToast(message, type) { effects.push(type); }
    function renderRoster() { effects.push("roster"); }
    function renderFormation() { effects.push("formation"); }
    function renderMobileSlots() { effects.push("mobile"); }
    function refreshAfterGkChange() {}
    function getRoleName(role) { return role; }
  `);
  vm.runInContext(`
    const originalCanSelect = FormationModel.canSelect;
    const guardCalls = [];
    window.FormationModel = {
      ...FormationModel,
      canSelect(input) {
        guardCalls.push(input.playerIndex);
        return originalCanSelect(input);
      }
    };
  `, context);
  vm.runInContext(readFileSync(path.join(ROOT, "js/dragdrop.js"), "utf8"), context);
  vm.runInContext("handleDrop({ preventDefault() {}, stopPropagation() {} }, 'starter', 'D1')", context);
  return JSON.parse(vm.runInContext("JSON.stringify({ selectedPlayers, slotAssignments, effects, guardCalls })", context));
}

test("drag-drop checks role capacity before mutating selection or assignments", () => {
  assert.deepEqual(runDrop({
    team: Array.from({ length: 8 }, () => ({ r: "D" })),
    selectedPlayers: [0, 1, 2, 3, 4, 5, 6],
    playerIndex: 7,
    draggedRole: "D"
  }), {
    selectedPlayers: [0, 1, 2, 3, 4, 5, 6],
    slotAssignments: {},
    effects: ["error"],
    guardCalls: [7]
  });
});

test("drag-drop rejects the player's real unknown role even when drag state says defender", () => {
  assert.deepEqual(runDrop({
    team: [{ r: "X" }],
    selectedPlayers: [],
    playerIndex: 0,
    draggedRole: "D"
  }), {
    selectedPlayers: [],
    slotAssignments: {},
    effects: ["error"],
    guardCalls: [0]
  });
});

test("goalkeeper replacement uses the shared guard and preserves the one-keeper rule", () => {
  const context = loadScripts(["js/formation-model.js"], `
    const team = [
      { r: "P", gkBlock: "A" },
      ...Array.from({ length: 21 }, () => ({ r: "D" })),
      { r: "P", gkBlock: "B" }
    ];
    const db = { manager: { players: team } };
    let currentManager = "manager";
    let selectedPlayers = Array.from({ length: 22 }, (_, index) => index);
    let slotAssignments = { "starter-GK1": 0 };
    const disabledBlocks = new Set();
    const moduleSelect = { value: "433" };
    const document = { getElementById(id) { return id === "moduleSelect" ? moduleSelect : null; } };
    function showToast() {}
  `);
  vm.runInContext(`
    const originalCanSelect = FormationModel.canSelect;
    const guardCalls = [];
    window.FormationModel = {
      ...FormationModel,
      canSelect(input) {
        guardCalls.push({ playerIndex: input.playerIndex, replacingIndex: input.replacingIndex });
        return originalCanSelect(input);
      }
    };
  `, context);
  vm.runInContext(readFileSync(path.join(ROOT, "js/gk-blocks.js"), "utf8"), context);

  const accepted = vm.runInContext("GkBlocks.select(22, { slotKey: 'starter-GK1', allowReplace: true })", context);

  assert.deepEqual(
    {
      accepted,
      ...JSON.parse(vm.runInContext("JSON.stringify({ selectedPlayers, slotAssignments, guardCalls })", context))
    },
    {
      accepted: true,
      selectedPlayers: [...Array.from({ length: 21 }, (_, index) => index + 1), 22],
      slotAssignments: { "starter-GK1": 22 },
      guardCalls: [{ playerIndex: 22, replacingIndex: 0 }]
    }
  );
});

test("module changes reconcile obsolete assignments before desktop and mobile renders", () => {
  const context = loadScripts(["js/formation-model.js"], `
    const team = [{ r: "D" }, { r: "D" }];
    const db = { manager: { players: team } };
    let currentManager = "manager";
    let selectedPlayers = [0, 1];
    let slotAssignments = { "starter-D1": 0, "starter-D5": 1 };
    let isMobile = true;
    let isModalOpen = false;
    const disabledBlocks = new Set();
    const listeners = {};
    const renders = [];
    function element(id, value = "") {
      return {
        value,
        addEventListener(type, listener) { listeners[id + ":" + type] = listener; }
      };
    }
    const elements = {
      moduleSelect: element("moduleSelect", "433"),
      resetBtn: element("resetBtn")
    };
    const document = {
      body: { addEventListener() {}, classList: { toggle() {} } },
      documentElement: { classList: { toggle() {} }, style: { setProperty() {} } },
      getElementById(id) { return elements[id] || null; },
      querySelector() { return null; }
    };
    window.matchMedia = () => ({ matches: true, addEventListener() {} });
    window.addEventListener = () => {};
    function snapshot(name) { renders.push({ name, slotAssignments: { ...slotAssignments } }); }
    function renderFormation() { snapshot("formation"); }
    function renderMobileSlots() { snapshot("mobile"); }
    function renderRoster() {}
    function clearSwitch() {}
    function updateSwitchUI() {}
    function closeModal() {}
    function closeSwitchStarterModal() {}
    function closeSwitchBenchModal() {}
  `);
  vm.runInContext(`
    const originalReconcileAssignments = FormationModel.reconcileAssignments;
    const reconcileCalls = [];
    window.FormationModel = {
      ...FormationModel,
      reconcileAssignments(input) {
        reconcileCalls.push(input.module);
        return originalReconcileAssignments(input);
      }
    };
  `, context);
  vm.runInContext(readFileSync(path.join(ROOT, "js/app-events.js"), "utf8"), context);

  vm.runInContext("listeners['moduleSelect:change']()", context);

  assert.deepEqual(
    JSON.parse(vm.runInContext("JSON.stringify({ slotAssignments, renders, reconcileCalls })", context)),
    {
      slotAssignments: { "starter-D1": 0 },
      renders: [
        { name: "formation", slotAssignments: { "starter-D1": 0 } },
        { name: "mobile", slotAssignments: { "starter-D1": 0 } }
      ],
      reconcileCalls: ["433"]
    }
  );
});
