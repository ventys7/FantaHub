"use strict";

const crypto = require("node:crypto");
const { authThrottleKey, authThrottleStore } = require("./admin-auth.cjs");
const { databaseConfigured, deleteLogoAccess, readLogoAccessRows, upsertLogoAccess } = require("./neon.cjs");
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

async function checkCode(rawLeagueId, teamName, code, req) {
  const document = await readAccess(rawLeagueId);
  const name = String(teamName || "").trim();
  const entry = document.teams[name];
  const throttle = { purpose: "team", league: document.leagueId, team: name, req };
  const store = await authThrottleStore();
  if (!entry?.codeHash) return { verified: false, throttled: false, retryAfter: 0 };
  const key = authThrottleKey(throttle);
  const attempt = await store.consume(key);
  if (!attempt.allowed) return { verified: false, throttled: true, retryAfter: attempt.retryAfter };
  const verified = await verifyCode(code, entry.codeHash);
  if (verified) await store.reset(key);
  return { verified, throttled: false, retryAfter: 0 };
}

// Rimuove i codici di squadre non più presenti nella rosa corrente.
// Idempotente: no-op se nessun codice è stale; guardia anti-catastrofe:
// mai cancellare nulla quando currentTeamNames è vuota.
async function pruneStaleLogoCodes(rawLeagueId, currentTeamNames) {
  const id = leagueId(rawLeagueId);
  const known = [...new Set((currentTeamNames || []).map((name) => String(name).trim()).filter(Boolean))];
  if (!known.length) return 0;
  const document = await readAccess(id);
  const stale = Object.keys(document.teams || {}).filter((name) => !known.includes(name));
  if (!stale.length) return 0;
  if (databaseConfigured()) {
    await deleteLogoAccess(id, stale);
    return stale.length;
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL non configurata: prune codici bloccato per evitare fallback Blob");
  stale.forEach((name) => { delete document.teams[name]; });
  await writeJson(`logo-access/${id}.json`, document);
  return stale.length;
}

module.exports = { checkCode, hashCode, pruneStaleLogoCodes, readAccess, resetCode, verifyCode };
