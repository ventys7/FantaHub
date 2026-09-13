"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

const REQUIRED_IDS = [
  "loginView", "adminView", "loginForm", "adminPassword", "leagueSettings", "logoCodes",
  "adminFeedback", "saveSettings", "logoutButton", "mediaRefresh",
  "mediaStatus", "unresolvedTeams", "unresolvedPlayers"
];

const RUNTIME_REQUIRED_IDS = REQUIRED_IDS.filter((id) => id !== "unresolvedTeams");

function runAdmin(missingId = null) {
  const listeners = [];
  const requests = [];
  const elements = Object.fromEntries(REQUIRED_IDS
    .filter((id) => id !== missingId)
    .map((id) => [id, {
      addEventListener(type) { listeners.push(`${id}:${type}`); },
      classList: { toggle() {} }
    }]));
  const context = {
    document: {
      documentElement: { dataset: { league: "fp" } },
      getElementById(id) { return elements[id] || null; },
      querySelectorAll() { return []; },
      createElement() { return {}; }
    },
    fetch(url) {
      requests.push(url);
      return new Promise(() => {});
    },
    structuredClone,
    URLSearchParams
  };

  vm.runInNewContext(source("js/admin-links.js"), context);
  return { listeners, requests };
}

test("FP and PD admin redesign preserve every functional hook", () => {
  for (const file of ["fp/admin-links/index.html", "pd/admin-links/index.html"]) {
    const html = source(file);
    for (const id of REQUIRED_IDS) assert.match(html, new RegExp(`id=["']${id}["']`), `${file}: ${id}`);
    assert.match(html, /admin-toolbar/);
    assert.match(html, /admin-dashboard-grid/);
    assert.match(html, /admin-card--media/);
    assert.doesNotMatch(html, /Migra Blob|media-direct-note|ADMIN_LINKS_PASSWORD_HASH/);
  }
});

test("admin panel remains responsive and accessible after the visual redesign", () => {
  const css = source("css/admin-links.css");
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /admin-card--codes/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /admin-feedback:empty/);
});

test("admin initialization has no side effects when any required element is missing", () => {
  for (const missingId of RUNTIME_REQUIRED_IDS) {
    let result;
    assert.doesNotThrow(() => { result = runAdmin(missingId); }, missingId);
    assert.deepEqual(result, { listeners: [], requests: [] }, missingId);
  }
});

test("admin initialization binds once and requests state with its complete DOM", () => {
  const result = runAdmin();

  assert.deepEqual(result.listeners, [
    "loginForm:submit",
    "saveSettings:click",
    "logoutButton:click",
    "mediaRefresh:click"
  ]);
  assert.equal(result.requests.length, 1);
  assert.match(result.requests[0], /^\/api\/admin\?league=fp&_lf=\d+$/);
});

test("unresolved teams remains optional during admin initialization", () => {
  const result = runAdmin("unresolvedTeams");

  assert.equal(result.listeners.length, 4);
  assert.equal(result.requests.length, 1);
});
