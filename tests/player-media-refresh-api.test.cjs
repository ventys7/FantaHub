"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const originalCwd = process.cwd();
let tempRoot;

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

function cookie(hash, now = Math.floor(Date.now() / 1000)) {
  // Same algorithm as lib/admin-auth.cjs (no ADMIN_LINKS_SESSION_SECRET set).
  const payload = Buffer.from(JSON.stringify({ v: 1, exp: now + 600 })).toString("base64url");
  const key = crypto.createHash("sha256").update(`lineup-admin:${hash}`).digest("hex");
  const sig = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return `lineup_admin_session=${encodeURIComponent(`${payload}.${sig}`)}`;
}

function clearModuleCache() {
  delete require.cache[require.resolve(path.join(ROOT, "api", "player-media.js"))];
  delete require.cache[require.resolve(path.join(ROOT, "lib", "player-media.cjs"))];
  delete require.cache[require.resolve(path.join(ROOT, "lib", "settings.cjs"))];
  delete require.cache[require.resolve(path.join(ROOT, "lib", "admin-auth.cjs"))];
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

// 1 club, 1 giocatore in rosa; l'Extra del CSV finisce in pendingNameSearches.
async function setup() {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lineup-media-api-"));
  await fs.mkdir(path.join(tempRoot, "data"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, "data", "settings.json"), JSON.stringify({
    version: 1,
    leagues: {
      fp: { listoneCsvUrl: "https://example.test/fp.csv", standingsCsvUrl: "", disciplineDocUrl: "" },
      pd: { listoneCsvUrl: "", standingsCsvUrl: "", disciplineDocUrl: "" }
    }
  }));
  process.chdir(tempRoot);

  process.env.BSD_API_KEY = "test-token";
  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "example.test") {
      return new Response("Tag,Ruolo,Nome,Squadra,Quotazione,Prezzo Acquisto\nPaolo,A,Player0_0,Club0,30,35\nPaolo,A,Extra0,Club0,18,22\n", {
        status: 200, headers: { "content-type": "text/csv" }
      });
    }
    if (url.pathname === "/api/teams/") {
      return jsonResponse({
        count: 1, next: null, previous: null,
        results: [{ id: 1000, name: "Club0", short_name: "Club0", country: "England" }]
      });
    }
    if (url.pathname === "/api/players/") {
      if (url.searchParams.get("search")) return jsonResponse({ count: 0, results: [] });
      return jsonResponse({ count: 1, results: [{ id: 1000, full_name: "Player0_0" }] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  clearModuleCache();
}

async function teardown() {
  process.chdir(originalCwd);
  delete process.env.BSD_API_KEY;
  delete process.env.REFRESH_STEP_BUDGET_MS;
  delete process.env.FACE_BRIDGE_ENABLED;
  delete global.fetch;
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
}

test("POST player-media refresh/continue-sync segue gli step fino al terminale", async (t) => {
  // Admin session.
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync("test-password", salt, 32);
  const hash = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
  process.env.ADMIN_LINKS_PASSWORD_HASH = hash;

  await setup();
  t.after(async () => {
    delete process.env.ADMIN_LINKS_PASSWORD_HASH;
    clearModuleCache();
    await teardown();
  });

  const handler = require(path.join(ROOT, "api", "player-media.js"));
  const start = mockRes();
  await handler({
    method: "POST",
    headers: { cookie: cookie(hash) },
    body: { leagueId: "fp", action: "refresh" }
  }, start);
  assert.equal(start.statusCode, 200, start.body?.error || "");
  assert.ok(start.body, "risposta presente");
  assert.ok(start.body.pending === true || start.body.pending === false, "payload step con pending");
  if (start.body.pending === false) {
    assert.ok(start.body.manifest?.players, "terminale: manifest con players");
    return; // nessun giro di continue necessario
  }

  // La prima chiamata ha frammentato: proseguire fino al terminale.
  let result = start.body;
  let guard = 0;
  while (result.pending && guard < 60) {
    guard += 1;
    const res = mockRes();
    await handler({
      method: "POST",
      headers: { cookie: cookie(hash) },
      body: { leagueId: "fp", action: "continue-sync" }
    }, res);
    assert.equal(res.statusCode, 200, res.body.error || "");
    assert.ok(res.body?.pending === true || res.body?.pending === false, "step coerente");
    result = res.body;
  }
  assert.equal(result.pending, false, "il loop di continue-sync termina");
  assert.ok(result.manifest?.players, "manifest pubblico al terminale");
});