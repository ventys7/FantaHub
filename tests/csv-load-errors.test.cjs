"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

test("app initialization handles the CSV rejection after one visible error transition", () => {
  let handled = 0;
  let visibleErrors = 0;
  const context = {
    currentManager: "",
    isMobile: false,
    loadCSV() {
      visibleErrors += 1;
      return {
        catch(handler) {
          handled += 1;
          handler(new Error("CSV unavailable"));
        }
      };
    },
    renderFormation() {},
    setupModalClickOutside() {},
    setupSwitchListeners() {},
    window: {
      LINEUP_FANTA: { route: "league" },
      LineupFixtures: { setup() {} },
      LineupPersistence: { setup() {} },
      addEventListener() {}
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "js/app.js"), "utf8"), context, { filename: "app.js" });

  assert.equal(visibleErrors, 1);
  assert.equal(handled, 1);
});

test("silent CSV refresh keeps the last valid assets and records the failure", async () => {
  const warnings = [];
  let request = 0;
  const window = {
    LINEUP_FANTA: { leagueId: "fp", league: { id: "fp", csvUrl: "https://example.test/list.csv" } },
    LineupCsvParser: { parseLeagueCsv: () => ({ assets: [{ ownerTag: "Paolo" }] }) },
    LineupFormationDb: { buildFormationDb: () => ({ Paolo: { players: [] } }) },
    LineupRuntimeSettings: { get: async () => ({ listoneCsvUrl: "https://example.test/list.csv" }) },
    LineupDebug: { logger: () => ({ debug() {}, error() {}, warn: (...args) => warnings.push(args) }) },
    addEventListener() {},
    location: { href: "https://example.test/fp/" },
    setInterval() {}
  };
  const document = {
    addEventListener() {},
    dispatchEvent() {},
    documentElement: { dataset: {} },
    getElementById: () => null,
    hidden: false
  };
  const context = {
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    Date,
    Option: class {},
    URL,
    document,
    fetch: async () => {
      request += 1;
      if (request === 2) throw new Error("temporary outage");
      return { ok: true, text: async () => "csv" };
    },
    isMobile: false,
    populateManagers() {},
    renderFormation() {},
    setTimeout,
    showToast() {},
    window
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "js/csv.js"), "utf8"), context, { filename: "csv.js" });

  await window.LineupLeagueData.refresh();
  await window.LineupLeagueData.refresh();

  assert.equal(window.LineupLeagueData.getAssets().length, 1);
  assert.equal(window.LineupLeagueData.getState().status, "ready");
  assert.equal(warnings.length, 1);
});
