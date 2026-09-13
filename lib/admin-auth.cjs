"use strict";

const crypto = require("node:crypto");
const { createAuthThrottleStore, databaseConfigured, ensureSchema, sqlClient } = require("./neon.cjs");

const COOKIE = "lineup_admin_session";
const TTL = 30 * 60;
const localAuthBuckets = new Map();

function scryptAsync(password, salt, length) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, length, (error, key) => error ? reject(error) : resolve(key)));
}

async function verifyPassword(password, encoded) {
  try {
    const [algorithm, saltHex, hashHex] = String(encoded || "").split("$");
    if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scryptAsync(String(password || ""), Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch { return false; }
}

function secret(passwordHash) {
  return process.env.ADMIN_LINKS_SESSION_SECRET || crypto.createHash("sha256").update(`lineup-admin:${passwordHash}`).digest("hex");
}

function sign(payload, key) {
  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}

function createToken(passwordHash, now = Math.floor(Date.now() / 1000)) {
  const payload = Buffer.from(JSON.stringify({ v: 1, exp: now + TTL })).toString("base64url");
  return `${payload}.${sign(payload, secret(passwordHash))}`;
}

function parseCookies(header) {
  return String(header || "").split(";").reduce((out, part) => {
    const index = part.indexOf("=");
    if (index > 0) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    return out;
  }, {});
}

function validToken(token, passwordHash, now = Math.floor(Date.now() / 1000)) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload, secret(passwordHash));
  const left = Buffer.from(signature); const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return false;
  try { const data = JSON.parse(Buffer.from(payload, "base64url").toString()); return data.v === 1 && data.exp > now; }
  catch { return false; }
}

function secure(req) {
  return Boolean(process.env.VERCEL) || String(req.headers?.["x-forwarded-proto"] || "").toLowerCase() === "https";
}

function cookieHeader(req, token, maxAge = TTL) {
  const parts = [`${COOKIE}=${encodeURIComponent(token || "")}`, "Path=/", `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (secure(req)) parts.push("Secure");
  return parts.join("; ");
}

function passwordHash() {
  return String(process.env.ADMIN_LINKS_PASSWORD_HASH || "").trim();
}

function clientIp(req) {
  const normalize = (value) => String(value || "").trim().toLowerCase().replace(/^::ffff:(?=\d{1,3}(?:\.\d{1,3}){3}$)/, "");
  return normalize(String(req?.headers?.["x-forwarded-for"] || "").split(",")[0])
    || normalize(req?.headers?.["x-real-ip"])
    || normalize(req?.socket?.remoteAddress)
    || "unknown";
}

function authThrottleKey({ purpose, league = "", team = "", req } = {}) {
  const normalize = (value) => String(value || "").trim().toLowerCase();
  return crypto.createHash("sha256").update(JSON.stringify([
    normalize(purpose),
    normalize(league),
    String(team || "").trim(),
    clientIp(req)
  ])).digest("hex");
}

const localAuthThrottleStore = {
  async consume(key) {
    const now = Date.now();
    for (const [bucketKey, bucket] of localAuthBuckets) if (bucket.expiresAt <= now) localAuthBuckets.delete(bucketKey);
    const current = localAuthBuckets.get(key);
    const attempts = Math.min(current ? current.attempts + 1 : 1, 6);
    const expiresAt = current?.expiresAt || now + 15 * 60 * 1000;
    localAuthBuckets.set(key, { attempts, expiresAt });
    return { allowed: attempts <= 5, retryAfter: attempts <= 5 ? 0 : Math.max(1, Math.ceil((expiresAt - now) / 1000)) };
  },
  async reset(key) { localAuthBuckets.delete(key); }
};

function unavailable(cause) {
  if (cause?.statusCode === 503) return cause;
  const error = new Error("Servizio temporaneamente non disponibile");
  error.statusCode = 503;
  error.cause = cause;
  return error;
}

function guardAuthThrottleStore(store) {
  const call = async (operation) => {
    try { return await operation(); }
    catch (error) { throw unavailable(error); }
  };
  return {
    consume: (key) => call(() => store.consume(key)),
    reset: (key) => call(() => store.reset(key))
  };
}

async function authThrottleStore() {
  try {
    if (databaseConfigured()) {
      await ensureSchema();
      return guardAuthThrottleStore(createAuthThrottleStore(sqlClient()));
    }
    if (process.env.VERCEL) throw unavailable();
    return guardAuthThrottleStore(localAuthThrottleStore);
  } catch (error) {
    throw unavailable(error);
  }
}

async function consumeAuthAttempt(options) {
  return (await authThrottleStore()).consume(authThrottleKey(options));
}

async function resetAuthAttempts(options) {
  await (await authThrottleStore()).reset(authThrottleKey(options));
}

function isAuthenticated(req) {
  const hash = passwordHash();
  return Boolean(hash) && validToken(parseCookies(req.headers?.cookie)[COOKIE], hash);
}

function setLogin(req, res) {
  res.setHeader("Set-Cookie", cookieHeader(req, createToken(passwordHash())));
}

function setLogout(req, res) {
  res.setHeader("Set-Cookie", cookieHeader(req, "", 0));
}

module.exports = {
  authThrottleKey,
  authThrottleStore,
  clientIp,
  consumeAuthAttempt,
  isAuthenticated,
  passwordHash,
  resetAuthAttempts,
  setLogin,
  setLogout,
  verifyPassword
};
