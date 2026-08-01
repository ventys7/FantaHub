#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];

function ok(message) { console.log(`✓ ${message}`); }
function fail(message) { errors.push(message); console.error(`✗ ${message}`); }
function warn(message) { warnings.push(message); console.warn(`! ${message}`); }
async function exists(relativePath) { try { await fs.access(path.join(ROOT, relativePath)); return true; } catch { return false; } }
async function read(relativePath) { return fs.readFile(path.join(ROOT, relativePath), "utf8"); }

async function checkRequiredFiles() {
  const required = [
    "index.html",
    "fp/index.html",
    "pd/index.html",
    "js/config.js",
    "js/fixtures.js",
    "js/csv-parser.js",
    "js/csv-formation-db.js",
    "assets/dashboard/dashboard.js",
    "assets/dashboard/dashboard.css",
    "data/fp/teams.json",
    "data/pd/teams.json",
    "dashboard/src/main.tsx",
    "fp/admin-links/index.html",
    "pd/admin-links/index.html",
    "js/admin-links.js",
    "css/admin-links.css",
    "js/club-keys.js",
    "js/player-media.js",
    "api/settings.js",
    "api/admin.js",
    "api/team-logo.js",
    "api/discipline.js",
    "api/player-media.js",
    "api/player-photo.js",
    "lib/neon.cjs",
    "lib/migrate-neon.cjs",
    "lib/storage.cjs",
    "data/settings.json"
  ];
  const missing = [];
  for (const file of required) if (!(await exists(file))) missing.push(file);
  if (missing.length) fail(`File obbligatori mancanti: ${missing.join(", ")}`);
  else ok(`${required.length} file obbligatori presenti`);
}

async function checkJson() {
  for (const file of ["data/fp/teams.json", "data/pd/teams.json", "data/settings.json", "package.json", "dashboard/package.json", "dashboard/tsconfig.json", "vercel.json"]) {
    try { JSON.parse(await read(file)); ok(`${file} valido`); }
    catch (error) { fail(`${file} non è JSON valido: ${error.message}`); }
  }
}

async function checkLeaguePages() {
  for (const page of ["fp/index.html", "pd/index.html"]) {
    if (!(await exists(page))) {
      fail(`${page} mancante (esegui prima: node scripts/generate-route-pages.mjs)`);
      continue;
    }
    const html = await read(page);
    for (const section of ["formation", "listone", "rose", "classifica"]) {
      if (!html.includes(`data-league-tab="${section}"`)) fail(`${page}: sezione ${section} mancante`);
    }
    if (html.includes('data-league-tab="calendario"') || html.includes("league-calendar-root")) {
      fail(`${page}: il Calendario non è stato rimosso completamente`);
    } else ok(`${page}: sezioni essenziali presenti`);
  }
}

async function checkGeneratedAssets() {
  if (!(await exists("assets/dashboard/dashboard.css")) || !(await exists("assets/dashboard/dashboard.js"))) {
    fail("Bundle dashboard mancanti (esegui prima: npm run build)");
    return;
  }
  const builtCss = await read("assets/dashboard/dashboard.css");
  const builtJs = await read("assets/dashboard/dashboard.js");
  if (builtCss.length < 8_000) fail("Bundle CSS dashboard sospettosamente piccolo");
  else ok(`Bundle CSS presente (${Math.round(builtCss.length / 1024)} KiB)`);
  if (builtJs.length < 30_000) fail("Bundle JS dashboard sospettosamente piccolo");
  else ok(`Bundle JS presente (${Math.round(builtJs.length / 1024)} KiB)`);
}

async function checkConfig() {
  const config = await read("js/config.js");
  for (const league of ["fp", "pd"]) {
    if (!config.includes(`${league}: Object.freeze({`)) fail(`Configurazione ${league.toUpperCase()} mancante`);
    else ok(`Configurazione ${league.toUpperCase()} presente`);
  }
  for (const key of ["csvUrl", "standingsCsvUrl", "teamProfilesUrl"]) {
    if (!config.includes(key)) fail(`${key} non trovato nella configurazione`);
  }
  if (/calendarCsvUrl|calendarDocUrl|matchdayLinks/.test(config)) fail("Configurazione ancora dipendente dal Calendario");
  else ok("Configurazione ridotta alle funzioni essenziali");
}

async function checkRemovedSystems() {
  const removed = [
    "data/matchday-links.json",
    "js/admin-matchday-snapshots.js",
    "dashboard/src/CalendarApp.tsx",
    "api/calendar.js",
    "api/matchday.js",
    "api/lineup-submissions.js"
  ];
  const leftovers = [];
  for (const item of removed) if (await exists(item)) leftovers.push(item);
  if (leftovers.length) fail(`Vecchi sistemi giornata ancora presenti: ${leftovers.join(", ")}`);
  else ok("Nessuna dipendenza dal vecchio sistema giornate");
}

async function main() {
  console.log("Lineup-Fanta · diagnosi essenziale con admin e media\n");
  await checkRequiredFiles();
  await checkJson();
  await checkLeaguePages();
  await checkGeneratedAssets();
  await checkConfig();
  await checkRemovedSystems();
  console.log(`\nRisultato: ${errors.length} errori, ${warnings.length} avvisi.`);
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
