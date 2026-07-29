"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Replicate scryptAsync for test hash generation (same algorithm as admin-auth.cjs)
function scryptAsync(password, salt, length) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, length, (error, key) => error ? reject(error) : resolve(key)));
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end(value) { this.body = value ?? null; return this; },
    send(value) { this.body = value; return this; }
  };
}

function clearModuleCache() {
  delete require.cache[require.resolve("../api/admin.js")];
  delete require.cache[require.resolve("../lib/admin-auth.cjs")];
}

test("admin API returns 503 when password hash is not configured", async () => {
  const prevHash = process.env.ADMIN_LINKS_PASSWORD_HASH;
  delete process.env.ADMIN_LINKS_PASSWORD_HASH;
  clearModuleCache();
  try {
    const handler = require("../api/admin.js");
    const res = mockRes();
    await handler({ method: "GET", query: {}, headers: {} }, res);
    assert.equal(res.statusCode, 503);
    assert.match(res.body?.error || "", /non configurato/i);
  } finally {
    if (prevHash !== undefined) process.env.ADMIN_LINKS_PASSWORD_HASH = prevHash;
    else delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    clearModuleCache();
  }
});

test("admin API login rejects wrong password", async () => {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync("correct-password", salt, 32);
  process.env.ADMIN_LINKS_PASSWORD_HASH = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
  clearModuleCache();
  try {
    const handler = require("../api/admin.js");
    const res = mockRes();
    await handler({
      method: "POST",
      headers: {},
      body: { action: "login", password: "wrong-password", leagueId: "fp" }
    }, res);
    // Login returns 401 with error message, not authenticated: false
    assert.equal(res.statusCode, 401);
    assert.match(res.body?.error || "", /Password errata|errata/i);
  } finally {
    delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    clearModuleCache();
  }
});

test("admin API GET with invalid league returns error", async () => {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync("test-password", salt, 32);
  process.env.ADMIN_LINKS_PASSWORD_HASH = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
  clearModuleCache();
  try {
    const handler = require("../api/admin.js");
    const res = mockRes();
    await handler({
      method: "GET",
      query: { league: "invalid" },
      headers: {}
    }, res);
    // GET handler now catches leagueId() error and returns 400
    assert.equal(res.statusCode, 400);
    assert.match(res.body?.error || "", /Lega non valida/i);
  } finally {
    delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    clearModuleCache();
  }
});
