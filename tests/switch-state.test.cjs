"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { isPairValid } = require("../js/switch-state.js");

// Shared lineup used by every case: indices map into `team`; starters/bench
// declare which slots are eligible for Switch (portieri never eligible).
const lineup = {
  team: [
    { r: "D" }, // 0
    { r: "D" }, // 1
    { r: "C" }, // 2
    { r: "P" }, // 3  -> portiere, mai ammesso
    { r: "A" }, // 4
    { r: "A" }  // 5
  ],
  starters: [
    { index: 0, player: { r: "D" } },
    { index: 4, player: { r: "A" } }
  ],
  bench: [
    { index: 1, player: { r: "D" } },
    { index: 2, player: { r: "C" } },
    { index: 5, player: { r: "A" } }
  ]
};

test("isPairValid: non-integer indices are rejected", () => {
  assert.equal(isPairValid(0.5, 1, false, lineup), false);
  assert.equal(isPairValid(0, "x", false, lineup), false);
});

test("isPairValid: same index is rejected", () => {
  assert.equal(isPairValid(0, 0, false, lineup), false);
});

test("isPairValid: out-of-range index is rejected", () => {
  assert.equal(isPairValid(9, 1, false, lineup), false);
  assert.equal(isPairValid(0, 99, false, lineup), false);
});

test("isPairValid: goalkeeper on either side is rejected", () => {
  assert.equal(isPairValid(0, 3, false, lineup), false); // panchina = P
  assert.equal(isPairValid(3, 1, false, lineup), false); // titolare = P
});

test("isPairValid: non-candidate slot is rejected", () => {
  assert.equal(isPairValid(1, 2, false, lineup), false); // 1 non è tra i titolari
  assert.equal(isPairValid(0, 4, false, lineup), false); // 4 non è in panchina
});

test("isPairValid: Base requires same role", () => {
  assert.equal(isPairValid(0, 1, false, lineup), true);  // D == D
  assert.equal(isPairValid(4, 5, false, lineup), true);  // A == A
  assert.equal(isPairValid(0, 2, false, lineup), false); // D != C
});

test("isPairValid: Plus requires different role", () => {
  assert.equal(isPairValid(0, 2, true, lineup), true);   // D != C
  assert.equal(isPairValid(0, 1, true, lineup), false);  // D == D
  assert.equal(isPairValid(4, 5, true, lineup), false);  // A == A
});
