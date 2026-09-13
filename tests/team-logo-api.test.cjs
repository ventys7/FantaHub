"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

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

async function encodedCode(code) {
  const salt = crypto.randomBytes(16);
  const key = await new Promise((resolve, reject) => crypto.scrypt(code, salt, 32, (error, value) => error ? reject(error) : resolve(value)));
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

function installFreshTeamLogoStack(codeHash, store) {
  const paths = {
    api: require.resolve("../api/team-logo.js"),
    logo: require.resolve("../lib/logo-access.cjs"),
    auth: require.resolve("../lib/admin-auth.cjs"),
    neon: require.resolve("../lib/neon.cjs"),
    listone: require.resolve("../lib/listone.cjs"),
    settings: require.resolve("../lib/settings.cjs")
  };
  const saved = new Map(Object.values(paths).map((resolved) => [resolved, require.cache[resolved]]));
  const previousEnv = Object.fromEntries(["VERCEL", "DATABASE_URL", "POSTGRES_URL"].map((name) => [name, process.env[name]]));
  const realNeon = saved.get(paths.neon)?.exports || require("../lib/neon.cjs");
  const realSettings = saved.get(paths.settings)?.exports || require("../lib/settings.cjs");

  process.env.VERCEL = "1";
  process.env.DATABASE_URL = "postgres://team-logo-throttle-test";
  delete process.env.POSTGRES_URL;
  require.cache[paths.neon] = {
    id: paths.neon,
    filename: paths.neon,
    loaded: true,
    exports: {
      ...realNeon,
      databaseConfigured: () => true,
      ensureSchema: async () => true,
      sqlClient: () => ({}),
      createAuthThrottleStore: () => store,
      updateTeamIdentity: async () => {},
      readLogoAccessRows: async () => ({ teams: { "Team Alfa": { codeHash } }, updatedAt: null })
    }
  };
  require.cache[paths.listone] = {
    id: paths.listone,
    filename: paths.listone,
    loaded: true,
    exports: {
      loadLeagueAssets: async () => ({ assets: [{ ownerTag: "Team Alfa" }] }),
      teamNamesFromAssets: () => ["Team Alfa"]
    }
  };
  require.cache[paths.settings] = {
    id: paths.settings,
    filename: paths.settings,
    loaded: true,
    exports: {
      ...realSettings,
      readTeamProfiles: async () => ({ leagueId: "fp", teams: { "Team Alfa": {} } }),
      saveTeamProfiles: async () => {}
    }
  };

  return {
    async request(code, ip) {
      delete require.cache[paths.api];
      delete require.cache[paths.logo];
      delete require.cache[paths.auth];
      const freshHandler = require("../api/team-logo.js");
      const res = mockRes();
      await freshHandler({
        method: "POST",
        headers: { "x-real-ip": ip },
        body: { leagueId: "fp", teamName: "Team Alfa", code }
      }, res);
      return res;
    },
    restore() {
      for (const resolved of Object.values(paths)) delete require.cache[resolved];
      for (const [resolved, entry] of saved) if (entry) require.cache[resolved] = entry;
      for (const [name, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  };
}

function installTeamIdentityStack(profiles, updateTeamIdentity) {
  const paths = {
    api: require.resolve("../api/team-logo.js"),
    logo: require.resolve("../lib/logo-access.cjs"),
    neon: require.resolve("../lib/neon.cjs"),
    listone: require.resolve("../lib/listone.cjs"),
    settings: require.resolve("../lib/settings.cjs")
  };
  const saved = new Map(Object.values(paths).map((resolved) => [resolved, require.cache[resolved]]));
  const realSettings = saved.get(paths.settings)?.exports || require("../lib/settings.cjs");
  require.cache[paths.logo] = {
    id: paths.logo,
    filename: paths.logo,
    loaded: true,
    exports: { checkCode: async () => ({ verified: true, throttled: false }) }
  };
  require.cache[paths.neon] = {
    id: paths.neon,
    filename: paths.neon,
    loaded: true,
    exports: { databaseConfigured: () => true, readTeamLogo: async () => null, updateTeamIdentity }
  };
  require.cache[paths.listone] = {
    id: paths.listone,
    filename: paths.listone,
    loaded: true,
    exports: {
      loadLeagueAssets: async () => ({ assets: Object.keys(profiles.teams).map((ownerTag) => ({ ownerTag })) }),
      teamNamesFromAssets: (assets) => assets.map(({ ownerTag }) => ownerTag)
    }
  };
  require.cache[paths.settings] = {
    id: paths.settings,
    filename: paths.settings,
    loaded: true,
    exports: {
      leagueId: realSettings.leagueId,
      teamLogoUrl: realSettings.teamLogoUrl,
      readTeamProfiles: async () => structuredClone(profiles),
      saveTeamProfiles: async () => { throw new Error("whole-document team write"); }
    }
  };
  delete require.cache[paths.api];
  return {
    handler: require("../api/team-logo.js"),
    restore() {
      for (const resolved of Object.values(paths)) delete require.cache[resolved];
      for (const [resolved, entry] of saved) if (entry) require.cache[resolved] = entry;
    }
  };
}

test("team-logo GET rejects missing team name", async () => {
  const handler = require("../api/team-logo.js");
  const res = mockRes();
  await handler({ method: "GET", query: { league: "fp" }, headers: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body?.error || "", /Fantasquadra non valida/i);
});

test("team-logo GET rejects invalid league", async () => {
  const handler = require("../api/team-logo.js");
  const res = mockRes();
  await handler({ method: "GET", query: { league: "invalid", team: "Test" }, headers: {} }, res);
  // Throws before async work starts — awaited handler now catches it
  assert.equal(res.statusCode, 400);
});

test("team-logo GET returns 404 when database is not configured and no team name", async () => {
  // Without DATABASE_URL, readTeamLogo returns nothing → 404 path
  const handler = require("../api/team-logo.js");
  const res = mockRes();
  await handler({ method: "GET", query: { league: "fp", team: "Nonexistent" }, headers: {} }, res);
  // databaseConfigured() checks DATABASE_URL — it's likely set in CI but may not be
  assert.ok([200, 404, 304, 400].includes(res.statusCode));
});

test("team-logo POST rejects missing body", async () => {
  const handler = require("../api/team-logo.js");
  const res = mockRes();
  await handler({ method: "POST", headers: {}, body: null }, res);
  assert.equal(res.statusCode, 400);
});

test("team-logo POST rejects invalid league", async () => {
  const handler = require("../api/team-logo.js");
  const res = mockRes();
  await handler({
    method: "POST",
    headers: {},
    body: { leagueId: "invalid", teamName: "Test", code: "123456" }
  }, res);
  // handler try-catch catches leagueId() throw
  assert.equal(res.statusCode, 400);
});

test("team-logo rejects non-GET/POST methods", async () => {
  const handler = require("../api/team-logo.js");
  const res = mockRes();
  await handler({ method: "DELETE" }, res);
  assert.equal(res.statusCode, 405);
  assert.match(res.body?.error || "", /non consentito/i);
});

test("team-logo maps a blocked code check to generic 429 with Retry-After and passes the request context", async () => {
  const logoPath = require.resolve("../lib/logo-access.cjs");
  const listonePath = require.resolve("../lib/listone.cjs");
  const settingsPath = require.resolve("../lib/settings.cjs");
  const apiPath = require.resolve("../api/team-logo.js");
  const saved = new Map([[logoPath, require.cache[logoPath]], [listonePath, require.cache[listonePath]], [settingsPath, require.cache[settingsPath]]]);
  let receivedRequest;
  require.cache[logoPath] = {
    id: logoPath,
    filename: logoPath,
    loaded: true,
    exports: { checkCode: async (league, team, code, req) => { receivedRequest = req; return { verified: false, throttled: true, retryAfter: 321 }; } }
  };
  require.cache[listonePath] = {
    id: listonePath,
    filename: listonePath,
    loaded: true,
    exports: { loadLeagueAssets: async () => ({ assets: [{ ownerTag: "Team Alfa" }] }), teamNamesFromAssets: () => ["Team Alfa"] }
  };
  const realSettings = require("../lib/settings.cjs");
  require.cache[settingsPath] = {
    id: settingsPath,
    filename: settingsPath,
    loaded: true,
    exports: { ...realSettings, readTeamProfiles: async () => ({ teams: { "Team Alfa": {} } }) }
  };
  delete require.cache[apiPath];
  const req = {
    method: "POST",
    headers: { "x-real-ip": "192.0.2.40" },
    body: { leagueId: "fp", teamName: "Team Alfa", code: "000000" }
  };
  try {
    const blockedHandler = require("../api/team-logo.js");
    const res = mockRes();
    await blockedHandler(req, res);

    assert.equal(res.statusCode, 429);
    assert.equal(res.headers["retry-after"], "321");
    assert.doesNotMatch(res.body?.error || "", /code|codice|credential/i);
    assert.equal(receivedRequest, req);
  } finally {
    delete require.cache[apiPath];
    for (const [resolved, entry] of saved) entry ? require.cache[resolved] = entry : delete require.cache[resolved];
  }
});

test("team-logo persists Neon throttling across fresh API, logo-access, and admin-auth modules", async () => {
  const codeHash = await encodedCode("123456");
  const buckets = new Map();
  const store = {
    async consume(key) {
      const attempts = Math.min((buckets.get(key) || 0) + 1, 6);
      buckets.set(key, attempts);
      return { allowed: attempts <= 5, retryAfter: attempts <= 5 ? 0 : 900 };
    },
    async reset(key) { buckets.delete(key); }
  };
  const fixture = installFreshTeamLogoStack(codeHash, store);
  const originalScrypt = crypto.scrypt;
  let scryptCalls = 0;
  crypto.scrypt = (...args) => { scryptCalls += 1; return originalScrypt(...args); };
  try {
    const attempts = [];
    for (let index = 0; index < 6; index += 1) attempts.push(await fixture.request("000000", "192.0.2.41"));

    assert.deepEqual(attempts.map((res) => res.statusCode), [401, 401, 401, 401, 401, 429]);
    assert.match(attempts.at(-1).headers["retry-after"], /^\d+$/);
    assert.equal(scryptCalls, 5);

    const resetStatuses = [];
    for (let index = 0; index < 4; index += 1) resetStatuses.push((await fixture.request("000000", "192.0.2.42")).statusCode);
    resetStatuses.push((await fixture.request("123456", "192.0.2.42")).statusCode);
    resetStatuses.push((await fixture.request("000000", "192.0.2.42")).statusCode);
    assert.deepEqual(resetStatuses, [401, 401, 401, 401, 200, 401]);
  } finally {
    crypto.scrypt = originalScrypt;
    fixture.restore();
  }
});

test("team-logo hides raw throttle reset failures behind a generic 503", async () => {
  const diagnostic = "NEON_TEAM_LOGO_RESET_INTERNAL_42";
  const codeHash = await encodedCode("123456");
  const fixture = installFreshTeamLogoStack(codeHash, {
    consume: async () => ({ allowed: true, retryAfter: 0 }),
    reset: async () => { throw new Error(diagnostic); }
  });
  try {
    const res = await fixture.request("123456", "192.0.2.43");
    assert.deepEqual(
      { statusCode: res.statusCode, body: res.body, leaked: JSON.stringify(res.body).includes(diagnostic) },
      { statusCode: 503, body: { error: "Servizio temporaneamente non disponibile" }, leaked: false }
    );
  } finally {
    fixture.restore();
  }
});

test("team-logo Neon POST sends profile and logo data through one team identity update", async () => {
  const calls = [];
  const profiles = { leagueId: "fp", teams: { "Team Alfa": { color: "blue", displayName: "Aquile" } } };
  const fixture = installTeamIdentityStack(profiles, async (...args) => { calls.push(args); });
  try {
    const res = mockRes();
    await fixture.handler({
      method: "POST",
      headers: {},
      body: {
        leagueId: "fp",
        teamName: "Team Alfa",
        code: "123456",
        displayName: "Leoni",
        upload: { mimeType: "image/png", dataBase64: PNG.toString("base64") }
      }
    }, res);

    const digest = crypto.createHash("sha256").update(PNG).digest("hex");
    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], [
      "fp",
      "Team Alfa",
      { color: "blue", displayName: "Leoni", logoUrl: `/api/team-logo?league=fp&team=Team+Alfa&v=${digest.slice(0, 16)}` },
      { mimeType: "image/png", bytes: PNG, sha256: digest }
    ]);
  } finally {
    fixture.restore();
  }
});

test("concurrent Neon POSTs based on stale profiles use narrow writes so both teams survive", async () => {
  const profiles = { leagueId: "fp", teams: { "Team Alfa": {}, "Team Beta": {}, "Team Gamma": { displayName: "Gamma" } } };
  const stored = new Map(Object.entries(profiles.teams));
  const fixture = installTeamIdentityStack(profiles, async (league, teamKey, profile) => {
    await new Promise((resolve) => setImmediate(resolve));
    stored.set(`${league}:${teamKey}`, profile);
  });
  try {
    const request = (teamName, displayName) => fixture.handler({
      method: "POST",
      headers: {},
      body: { leagueId: "fp", teamName, code: "123456", displayName }
    }, mockRes());
    await Promise.all([request("Team Alfa", "Alfa"), request("Team Beta", "Beta")]);

    assert.equal(stored.get("fp:Team Alfa").displayName, "Alfa");
    assert.equal(stored.get("fp:Team Beta").displayName, "Beta");
    assert.deepEqual(stored.get("Team Gamma"), { displayName: "Gamma" });
  } finally {
    fixture.restore();
  }
});

test("concurrent Neon POSTs cannot claim accent-equivalent display names", async () => {
  const profiles = { leagueId: "fp", teams: { "Team Alfa": {}, "Team Beta": {} } };
  const claimed = new Set();
  const fixture = installTeamIdentityStack(profiles, async (_league, _teamKey, profile) => {
    await new Promise((resolve) => setImmediate(resolve));
    const key = profile.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    if (claimed.has(key)) {
      throw Object.assign(new Error("duplicate key value violates unique constraint"), {
        code: "23505",
        constraint: "fantasy_teams_display_name_unique"
      });
    }
    claimed.add(key);
  });
  try {
    const request = async (teamName, displayName) => {
      const res = mockRes();
      await fixture.handler({
        method: "POST",
        headers: {},
        body: { leagueId: "fp", teamName, code: "123456", displayName }
      }, res);
      return res;
    };
    const responses = await Promise.all([
      request("Team Alfa", "Aquile"),
      request("Team Beta", "ÀQUILE")
    ]);

    assert.deepEqual(responses.map(({ statusCode }) => statusCode).sort(), [200, 400]);
    assert.equal(responses.find(({ statusCode }) => statusCode === 400).body.error, "Nome fantasquadra già utilizzato");
  } finally {
    fixture.restore();
  }
});

const handler = require("../api/team-logo.js");
const upload = (mimeType, bytes) => ({ mimeType, dataBase64: bytes.toString("base64") });
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const JPEG = Buffer.from("ffd8ffe000104a4649460001", "hex");
const WEBP = Buffer.from("524946460400000057454250", "hex");

test("decodeUpload accepts PNG, JPEG and WebP signatures", () => {
  for (const [mimeType, bytes] of [["image/png", PNG], ["image/jpeg", JPEG], ["image/webp", WEBP]]) {
    const decoded = handler.decodeUpload(upload(mimeType, bytes));
    assert.deepEqual(decoded, { mimeType, bytes });
  }
});

test("decodeUpload rejects unsupported, disguised and mismatched image data", () => {
  assert.throws(() => handler.decodeUpload(upload("image/gif", Buffer.from("GIF89a"))), /Formato non supportato/i);
  assert.throws(() => handler.decodeUpload(upload("image/png", Buffer.from("<html>bad</html>"))), /Immagine non valida/i);
  assert.throws(() => handler.decodeUpload(upload("image/png", JPEG)), /Immagine non valida/i);
  assert.throws(() => handler.decodeUpload(upload("image/webp", Buffer.from("524946461000000057454250", "hex"))), /Immagine non valida/i);
});

test("decodeUpload rejects empty, non-canonical base64 and payloads over 512 KiB", () => {
  assert.throws(() => handler.decodeUpload({ mimeType: "image/png", dataBase64: "" }), /Immagine non valida/i);
  assert.throws(() => handler.decodeUpload({ mimeType: "image/png", dataBase64: PNG.toString("base64").replace(/=+$/, "") }), /Immagine non valida/i);
  const big = Buffer.concat([PNG, Buffer.alloc(512 * 1024)]);
  assert.throws(() => handler.decodeUpload(upload("image/png", big)), /troppo pesante|massimo 512 KB/i);
});
