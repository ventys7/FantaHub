"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadParser() {
  const source = fs.readFileSync(path.join(__dirname, "../js/csv-parser.js"), "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "csv-parser.js" });
  return context.window.LineupCsvParser;
}

test("CSV parser reads assets and live credits from columns O/P", () => {
  const parser = loadParser();
  const rows = [
    "metadata",
    "metadata",
    "metadata",
    "metadata",
    "metadata",
    "metadata",
    "Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto,,,,,,,,,Partecipante,Crediti",
    "Paolo,C,Tielemans,Aston Villa,15,20,,,,,,,,,Paolo,123",
    "Luca,A,Wissa,Newcastle,10,15,,,,,,,,,Luca,98"
  ];

  const result = parser.parseLeagueCsv(rows.join("\n"));

  assert.equal(result.assets.length, 2);
  assert.equal(result.assets[0].displayName, "Tielemans");
  assert.equal(result.assets[0].managerCredits, 123);
  assert.equal(result.assets[1].managerCredits, 98);
});

test("CSV parser accepts semicolon-delimited exports", () => {
  const parser = loadParser();
  const csv = [
    "Tag;Ruolo;Nome;Squadra;Quotazione;Prezzo Acquisto",
    "Paolo;D;Mukiele;Sunderland;7;9"
  ].join("\n");

  const result = parser.parseLeagueCsv(csv);
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].role, "D");
  assert.equal(result.assets[0].displayName, "Mukiele");
});

test("CSV parser applies tolerant Extra prefixes only when enabled", () => {
  const parser = loadParser();
  const csv = [
    "Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto",
    "  [e]   Paolo,D,Extra D,Inter,7,9",
    "[ e ] Luca,C,Extra C,Milan,8,10",
    "[ E ]   Anna,A,Extra A,Roma,9,11",
    "[E] Mario,P,Portiere,Napoli,6,8",
    "Paolo [E],D,Suffix D,Atalanta,5,7"
  ].join("\n");

  const disabled = parser.parseLeagueCsv(csv);
  assert.equal(disabled.assets[0].ownerTag, "[e]   Paolo");
  assert.equal(disabled.assets[0].isExtra, false);
  assert.equal(disabled.assets[4].ownerTag, "Paolo [E]");
  assert.equal(disabled.assets[4].isExtra, false);

  const enabled = parser.parseLeagueCsv(csv, { extraSlots: true });
  assert.equal(enabled.assets[0].ownerTag, "Paolo");
  assert.equal(enabled.assets[0].isExtra, true);
  assert.equal(enabled.assets[1].ownerTag, "Luca");
  assert.equal(enabled.assets[1].isExtra, true);
  assert.equal(enabled.assets[2].ownerTag, "Anna");
  assert.equal(enabled.assets[2].isExtra, true);
  assert.equal(enabled.assets[3].ownerTag, "Mario");
  assert.equal(enabled.assets[3].isExtra, false);
  assert.equal(enabled.assets[4].ownerTag, "Paolo [E]");
  assert.equal(enabled.assets[4].isExtra, false);
});
