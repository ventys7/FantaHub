"use strict";

const crypto = require("node:crypto");
const { databaseConfigured, readLogoAccessRows, upsertLogoAccess } = require("./neon.cjs");
const { readJson, writeJson } = require("./storage.cjs");
const { leagueId } = require("./settings.cjs");

function scryptAsync(password, salt, length) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, length, (error, key) => error ? reject(error) : resolve(key)));
}

async function hashCode(code) {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(String(code), salt, 32);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyCode(code, encoded) {
  try {
    const [algorithm, saltHex, hashHex] = String(encoded || "").split("$");
    if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scryptAsync(String(code || ""), Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch { return false; }
}

async function readAccess(rawLeagueId) {
  const id = leagueId(rawLeagueId);
  if (databaseConfigured()) {
    const document = await readLogoAccessRows(id);
    return { version: 1, leagueId: id, teams: document?.teams || {}, updatedAt: document?.updatedAt || null };
  }
  if (process.env.VERCEL) return { version: 1, leagueId: id, teams: {}, updatedAt: null };
  const document = await readJson(`logo-access/${id}.json`, { version: 1, leagueId: id, teams: {} });
  return { version: 1, leagueId: id, teams: document?.teams || {}, updatedAt: document?.updatedAt || null };
}

async function resetCode(rawLeagueId, teamName) {
  const id = leagueId(rawLeagueId);
  const name = String(teamName || "").trim();
  if (!name) throw new Error("Fantasquadra non valida");
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = await hashCode(code);
  if (databaseConfigured()) {
    await upsertLogoAccess(id, name, codeHash);
    return code;
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL non configurata: reset codice bloccato per evitare fallback Blob");
  const document = await readAccess(id);
  const previous = document.teams[name] || {};
  document.teams[name] = {
    codeHash,
    version: Number(previous.version || 0) + 1,
    resetAt: new Date().toISOString()
  };
  await writeJson(`logo-access/${id}.json`, document);
  return code;
}

async function checkCode(rawLeagueId, teamName, code) {
  const document = await readAccess(rawLeagueId);
  const entry = document.teams[String(teamName || "").trim()];
  return Boolean(entry?.codeHash) && verifyCode(code, entry.codeHash);
}

module.exports = { checkCode, hashCode, readAccess, resetCode, verifyCode };
