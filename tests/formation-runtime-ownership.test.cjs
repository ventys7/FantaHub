"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const PERSISTENCE_SOURCE = readFileSync(path.join(ROOT, "js/persistence.js"), "utf8");

test("formation runtime has no React ownership path", () => {
  const index = readFileSync(path.join(ROOT, "index.html"), "utf8");
  const main = readFileSync(path.join(ROOT, "dashboard/src/main.tsx"), "utf8");
  const css = readFileSync(path.join(ROOT, "css/league-dashboard.css"), "utf8");

  assert.doesNotMatch(index, /data-react-formation|__REACT_FORMATION_OWNED__|league-formation-root/);
  assert.doesNotMatch(main, /FormationApp|league-formation-root/);
  assert.equal(existsSync(path.join(ROOT, "dashboard/src/FormationApp.tsx")), false);

  for (const file of ["js/slots-render.js", "js/mobile-slots.js", "js/roster.js"]) {
    assert.doesNotMatch(readFileSync(path.join(ROOT, file), "utf8"), /__REACT_FORMATION_OWNED__/);
  }

  assert.doesNotMatch(css, /data-react-formation|league-formation-root|\.lf-picker-/);
  assert.match(css, /\.roster-drawer-header/);
  assert.match(css, /\.roster-list/);
});

function restore(leagueId, drafts) {
  const elements = {
    managerSelect: { value: "" },
    moduleSelect: { value: "343" }
  };
  const reads = [];
  const context = {
    console,
    document: {
      addEventListener() {},
      getElementById(id) {
        return elements[id] || null;
      }
    },
    localStorage: {
      getItem(key) {
        reads.push(key);
        return drafts[key] || null;
      },
      setItem() {}
    },
    setTimeout,
    clearTimeout
  };
  context.window = context;
  context.LINEUP_FANTA = { leagueId };

  vm.createContext(context);
  vm.runInContext(`
    const ALLOWED_MODULES = ["343", "352", "433", "442", "451", "532", "541"];
    const db = {
      "Manager FP": { players: [{ r: "D", n: "Rossi", t: "Inter" }] },
      "Manager PD": { players: [{ r: "A", n: "García", t: "Real Madrid" }] }
    };
    let currentManager = "";
    let selectedPlayers = [];
    let slotAssignments = {};
    let switchStarterIndex = null;
    let switchBenchIndex = null;
    let switchPlus = false;
    let isMobile = true;
    const disabledBlocks = new Set();
    const renders = [];
    function snapshot(name) {
      renders.push({
        name,
        manager: currentManager,
        selectedPlayers: selectedPlayers.slice(),
        slotAssignments: { ...slotAssignments },
        switchStarterIndex,
        switchBenchIndex,
        switchPlus
      });
    }
    function renderRoster() { snapshot("roster"); }
    function renderFormation() { snapshot("formation"); }
    function renderMobileSlots() { snapshot("mobile"); }
    function updateSwitchUI() { snapshot("switch"); }
  `, context);
  vm.runInContext(PERSISTENCE_SOURCE, context);

  const restored = vm.runInContext("LineupPersistence.restoreAfterCsv()", context);
  const renders = JSON.parse(vm.runInContext("JSON.stringify(renders)", context));
  return { elements, reads, renders, restored };
}

const drafts = {
  "lineup-fp:draft": JSON.stringify({
    version: 1,
    manager: "Manager FP",
    module: "433",
    selectedPlayerIds: ["d|rossi|inter|"],
    slotAssignments: { "starter-D1": "d|rossi|inter|" },
    switch: { starterId: "d|rossi|inter|", benchId: null, plus: true },
    updatedAt: "2026-09-08T00:00:00.000Z"
  }),
  "lineup-pd:draft": JSON.stringify({
    version: 1,
    manager: "Manager PD",
    module: "352",
    selectedPlayerIds: ["a|garcia|real madrid|"],
    slotAssignments: { "starter-A1": "a|garcia|real madrid|" },
    switch: { starterId: null, benchId: "a|garcia|real madrid|", plus: false },
    updatedAt: "2026-09-08T00:00:00.000Z"
  })
};

for (const expected of [
  {
    leagueId: "fp",
    key: "lineup-fp:draft",
    manager: "Manager FP",
    module: "433",
    slot: "starter-D1",
    switchStarterIndex: 0,
    switchBenchIndex: null,
    switchPlus: true
  },
  {
    leagueId: "pd",
    key: "lineup-pd:draft",
    manager: "Manager PD",
    module: "352",
    slot: "starter-A1",
    switchStarterIndex: null,
    switchBenchIndex: 0,
    switchPlus: false
  }
]) {
  test(`version-1 ${expected.key} restores through vanilla render seams`, () => {
    const result = restore(expected.leagueId, drafts);

    assert.equal(result.restored, true);
    assert.deepEqual(result.reads, [expected.key]);
    assert.equal(result.elements.managerSelect.value, expected.manager);
    assert.equal(result.elements.moduleSelect.value, expected.module);
    assert.deepEqual(result.renders.map(({ name }) => name), ["roster", "formation", "mobile", "switch"]);
    for (const render of result.renders) {
      assert.equal(render.manager, expected.manager);
      assert.deepEqual(render.selectedPlayers, [0]);
      assert.deepEqual(render.slotAssignments, { [expected.slot]: 0 });
      assert.equal(render.switchStarterIndex, expected.switchStarterIndex);
      assert.equal(render.switchBenchIndex, expected.switchBenchIndex);
      assert.equal(render.switchPlus, expected.switchPlus);
    }
  });
}
