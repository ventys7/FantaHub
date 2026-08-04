"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const {
  databaseConfigured,
  listTeamLogoMetadata,
  readFantasyTeams,
  readRuntimeSetting,
  writeFantasyTeams,
  writeRuntimeSetting
} = require("./neon.cjs");
const { readJson, writeJson } = require("./storage.cjs");

const LEAGUES = new Set(["fp", "pd"]);

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

function requireNeonForVercelWrite() {
  if (isVercelRuntime() && !databaseConfigured()) {
    throw new Error("DATABASE_URL non configurata: scrittura runtime bloccata per evitare fallback Blob");
  }
}

function leagueId(value) {
  const id = String(value || "").trim().toLowerCase();
  if (!LEAGUES.has(id)) throw new Error("Lega non valida");
  return id;
}

function cleanUrl(value, { allowEmpty = true } = {}) {
  const raw = String(value || "").trim();
  if (!raw && allowEmpty) return "";
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error("URL non valido"); }
  if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("URL non valido");
  return parsed.toString();
}

function normalizeLeagueSettings(raw = {}) {
  return {
    listoneCsvUrl: cleanUrl(raw.listoneCsvUrl || raw.csvUrl || ""),
    standingsCsvUrl: cleanUrl(raw.standingsCsvUrl || ""),
    disciplineDocUrl: cleanUrl(raw.disciplineDocUrl || ""),
    regolamentoDocUrl: cleanUrl(raw.regolamentoDocUrl || "")
  };
}

function normalizeSettings(raw = {}, fallback = {}) {
  return {
    version: 1,
    leagues: {
      fp: normalizeLeagueSettings(raw?.leagues?.fp || fallback?.leagues?.fp || {}),
      pd: normalizeLeagueSettings(raw?.leagues?.pd || fallback?.leagues?.pd || {})
    },
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null
  };
}

async function repositorySettings() {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "settings.json"), "utf8"));
    return normalizeSettings(raw);
  } catch {
    return normalizeSettings({});
  }
}

async function readSettings() {
  const fallback = await repositorySettings();
  if (databaseConfigured()) {
    const row = await readRuntimeSetting("settings");
    return normalizeSettings(row?.value || fallback, fallback);
  }
  if (isVercelRuntime()) return fallback;
  const runtime = await readJson("settings.json", null);
  return normalizeSettings(runtime || fallback, fallback);
}

async function saveSettings(raw) {
  const current = await readSettings();
  const normalized = normalizeSettings(raw, current);
  normalized.updatedAt = new Date().toISOString();
  if (databaseConfigured()) {
    const saved = await writeRuntimeSetting("settings", normalized);
    return { document: normalizeSettings(saved.value, normalized), source: "neon" };
  }
  requireNeonForVercelWrite();
  return writeJson("settings.json", normalized);
}

async function saveLeagueSettings(rawLeagueId, rawLeagueSettings) {
  const id = leagueId(rawLeagueId);
  const current = await readSettings();
  const next = structuredClone(current);
  next.leagues[id] = normalizeLeagueSettings(rawLeagueSettings || {});
  return saveSettings(normalizeSettings(next, current));
}

function teamLogoUrl(league, teamName, sha256 = "") {
  const params = new URLSearchParams({ league: leagueId(league), team: String(teamName || "") });
  if (sha256) params.set("v", String(sha256).slice(0, 16));
  return `/api/team-logo?${params.toString()}`;
}

async function repositoryTeamProfiles(league) {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", league, "teams.json"), "utf8"));
  } catch {
    return { version: 1, teams: {} };
  }
}

async function readTeamProfiles(id) {
  const league = leagueId(id);
  const fallback = await repositoryTeamProfiles(league);
  if (databaseConfigured()) {
    const [runtime, logos] = await Promise.all([
      readFantasyTeams(league),
      listTeamLogoMetadata(league)
    ]);
    const sourceTeams = runtime?.teams || fallback?.teams || {};
    const teams = structuredClone(sourceTeams);
    Object.entries(logos || {}).forEach(([teamName, logo]) => {
      teams[teamName] = {
        ...(teams[teamName] || {}),
        logoUrl: teamLogoUrl(league, teamName, logo.sha256)
      };
    });
    return { version: 1, leagueId: league, teams, updatedAt: runtime?.updatedAt || null };
  }
  if (isVercelRuntime()) return { version: 1, leagueId: league, teams: fallback?.teams || {}, updatedAt: null };
  const runtime = await readJson(`teams/${league}.json`, null);
  const source = runtime || fallback;
  const teams = source && typeof source.teams === "object" && source.teams ? source.teams : {};
  return { version: 1, leagueId: league, teams, updatedAt: source.updatedAt || null };
}

async function saveTeamProfiles(id, document) {
  const league = leagueId(id);
  const teams = document?.teams && typeof document.teams === "object" ? document.teams : {};
  if (databaseConfigured()) {
    const cleanTeams = Object.fromEntries(Object.entries(teams).map(([teamName, profile]) => [
      teamName,
      { ...(profile || {}), logoUrl: String(profile?.logoUrl || "").startsWith("/api/team-logo?") ? profile.logoUrl : (profile?.logoUrl || "") }
    ]));
    const saved = await writeFantasyTeams(league, cleanTeams);
    return { document: { version: 1, leagueId: league, teams: saved.teams, updatedAt: saved.updatedAt }, source: "neon" };
  }
  requireNeonForVercelWrite();
  return writeJson(`teams/${league}.json`, { version: 1, leagueId: league, teams });
}

module.exports = {
  cleanUrl,
  leagueId,
  normalizeSettings,
  readSettings,
  readTeamProfiles,
  saveLeagueSettings,
  saveSettings,
  saveTeamProfiles,
  teamLogoUrl
};
