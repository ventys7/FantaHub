"use strict";

const crypto = require("node:crypto");

const COOKIE = "lineup_admin_session";
const TTL = 30 * 60;

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

module.exports = { isAuthenticated, passwordHash, setLogin, setLogout, verifyPassword };
