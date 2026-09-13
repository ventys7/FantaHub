"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createNarrowUpdateStore } = require("../lib/neon.cjs");

function createSqlStub({ failLogo = false } = {}) {
  const state = {
    settings: {
      version: 1,
      leagues: { fp: { listoneCsvUrl: "old-fp" }, pd: { listoneCsvUrl: "old-pd" } },
      updatedAt: null
    },
    teams: new Map([["fp:Team Gamma", { displayName: "Gamma" }]]),
    logos: new Map()
  };
  const statements = [];
  const transactions = [];

  const execute = async (query, target) => {
    await new Promise((resolve) => setImmediate(resolve));
    if (/runtime_settings/i.test(query.text)) {
      const [, league, payload] = query.values;
      target.settings = {
        ...target.settings,
        leagues: { ...target.settings.leagues, [league]: JSON.parse(payload) },
        updatedAt: "2026-09-09T12:00:00.000Z"
      };
      return [{ value: structuredClone(target.settings), updated_at: target.settings.updatedAt }];
    }
    if (/fantasy_teams/i.test(query.text)) {
      const [league, teamKey, payload] = query.values;
      const key = `${league}:${teamKey}`;
      if (!/DO NOTHING/i.test(query.text) || !target.teams.has(key)) target.teams.set(key, JSON.parse(payload));
      return [];
    }
    if (/team_logos/i.test(query.text)) {
      if (failLogo) throw new Error("logo write failed");
      const [league, teamKey, mimeType, dataBase64, sha256] = query.values;
      target.logos.set(`${league}:${teamKey}`, { mimeType, bytes: Buffer.from(dataBase64, "base64"), sha256 });
      return [];
    }
    throw new Error(`Unexpected SQL: ${query.text}`);
  };

  const sql = (strings, ...values) => {
    const query = { text: strings.join("?").replace(/\s+/g, " ").trim(), values };
    statements.push(query);
    query.then = (resolve, reject) => execute(query, state).then(resolve, reject);
    return query;
  };
  sql.transaction = async (queries) => {
    transactions.push(queries);
    const staged = {
      settings: structuredClone(state.settings),
      teams: new Map(state.teams),
      logos: new Map(state.logos)
    };
    for (const query of queries) await execute(query, staged);
    state.settings = staged.settings;
    state.teams = staged.teams;
    state.logos = staged.logos;
  };
  sql.state = state;
  sql.statements = statements;
  sql.transactions = transactions;
  return sql;
}

test("runtime setting CAS uses xmin while two-argument writes remain unconditional", async (t) => {
  const neonPath = require.resolve("../lib/neon.cjs");
  const driverPath = require.resolve("@neondatabase/serverless");
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalNeon = require.cache[neonPath];
  const originalDriver = require.cache[driverPath];
  const statements = [];
  let operation = 0;
  const sql = async (strings, ...values) => {
    const query = { text: strings.join("?").replace(/\s+/g, " ").trim(), values };
    statements.push(query);
    if (/to_regclass/i.test(query.text)) {
      return [{ runtime_settings: true, fantasy_teams: true, logo_access: true, team_logos: true,
        bsd_player_overrides: true, bsd_team_overrides: true, bsd_manifest_cache: true,
        bsd_quota: true, bsd_refresh_checkpoints: true, auth_throttle: true,
        fantasy_teams_display_name_unique: true }];
    }
    operation += 1;
    if (operation === 1) return [{ value: { state: "read" }, updated_at: "read-at", version: "41" }];
    if (operation === 5 && /^UPDATE/i.test(query.text)) return [];
    return [{ value: { state: operation }, updated_at: `write-${operation}` }];
  };

  t.after(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalNeon) require.cache[neonPath] = originalNeon;
    else delete require.cache[neonPath];
    if (originalDriver) require.cache[driverPath] = originalDriver;
    else delete require.cache[driverPath];
  });
  process.env.DATABASE_URL = "postgres://test.invalid/fantahub";
  require.cache[driverPath] = { id: driverPath, filename: driverPath, loaded: true, exports: { neon: () => sql } };
  delete require.cache[neonPath];
  const { readRuntimeSetting, writeRuntimeSetting } = require(neonPath);

  const read = await readRuntimeSetting("bsd-cache");
  const unconditional = await writeRuntimeSetting("settings", { mode: "ordinary" });
  const inserted = await writeRuntimeSetting("bsd-cache", { worker: "first" }, null);
  const updated = await writeRuntimeSetting("bsd-cache", { worker: "second" }, "41");
  const conflict = await writeRuntimeSetting("bsd-cache", { worker: "stale" }, "stale");
  const [readSql, unconditionalSql, insertSql, updateSql] = statements.slice(1);

  assert.deepEqual(read, { value: { state: "read" }, updatedAt: "read-at", version: "41" });
  assert.match(readSql.text, /SELECT value, updated_at, xmin::text AS version/i);
  assert.match(unconditionalSql.text, /^INSERT .* ON CONFLICT \(key\) DO UPDATE/is);
  assert.doesNotMatch(unconditionalSql.text, /xmin|DO NOTHING/i);
  assert.deepEqual(unconditional, { value: { state: 2 }, updatedAt: "write-2" });
  assert.match(insertSql.text, /^INSERT .* ON CONFLICT \(key\) DO NOTHING/is);
  assert.deepEqual(inserted, { value: { state: 3 }, updatedAt: "write-3" });
  assert.match(updateSql.text, /^UPDATE .* WHERE key = \? AND xmin::text = \?/is);
  assert.deepEqual(updateSql.values.slice(-2), ["bsd-cache", "41"]);
  assert.deepEqual(updated, { value: { state: 4 }, updatedAt: "write-4" });
  assert.equal(conflict, null);
});

test("schema installs accent-insensitive display-name uniqueness for existing databases", async (t) => {
  const neonPath = require.resolve("../lib/neon.cjs");
  const driverPath = require.resolve("@neondatabase/serverless");
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalNeon = require.cache[neonPath];
  const originalDriver = require.cache[driverPath];
  const statements = [];
  const sql = async (strings, ...values) => {
    const query = { text: strings.join("?").replace(/\s+/g, " ").trim(), values };
    statements.push(query);
    if (/to_regclass/i.test(query.text)) {
      return [{ runtime_settings: true, fantasy_teams: true, logo_access: true, team_logos: true,
        bsd_player_overrides: true, bsd_team_overrides: true, bsd_manifest_cache: true,
        bsd_quota: true, bsd_refresh_checkpoints: true, auth_throttle: true,
        fantasy_teams_display_name_unique: null }];
    }
    return [];
  };

  t.after(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalNeon) require.cache[neonPath] = originalNeon;
    else delete require.cache[neonPath];
    if (originalDriver) require.cache[driverPath] = originalDriver;
    else delete require.cache[driverPath];
  });
  process.env.DATABASE_URL = "postgres://test.invalid/fantahub";
  require.cache[driverPath] = { id: driverPath, filename: driverPath, loaded: true, exports: { neon: () => sql } };
  delete require.cache[neonPath];

  await require(neonPath).ensureSchema();

  assert.match(statements[0].text, /fantasy_teams_display_name_unique/i);
  const index = statements.find(({ text }) => /CREATE UNIQUE INDEX/i.test(text));
  assert.ok(index);
  assert.match(index.text, /ON lineup_fanta\.fantasy_teams/i);
  assert.match(index.text, /normalize\(COALESCE\(payload->>'displayName', ''\), NFD\)/i);
  assert.match(index.text, /U&'\[\\0300-\\036f\]'/i);
  assert.match(index.text, /WHERE .* <> ''/i);
});

test("overlapping league settings updates preserve FP and PD with one atomic statement each", async () => {
  const sql = createSqlStub();
  const store = createNarrowUpdateStore(sql);

  await Promise.all([
    store.updateLeagueSettings("fp", { listoneCsvUrl: "new-fp" }),
    store.updateLeagueSettings("pd", { listoneCsvUrl: "new-pd" })
  ]);

  assert.deepEqual(sql.state.settings.leagues, {
    fp: { listoneCsvUrl: "new-fp" },
    pd: { listoneCsvUrl: "new-pd" }
  });
  assert.equal(sql.statements.length, 2);
  for (const statement of sql.statements) {
    assert.match(statement.text, /^INSERT INTO lineup_fanta\.runtime_settings/i);
    assert.match(statement.text, /ON CONFLICT.*jsonb_set/is);
    assert.match(
      statement.text,
      /COALESCE\(lineup_fanta\.runtime_settings\.value->'leagues', '\{\}'::jsonb\) \|\| jsonb_build_object\(\?, \?::jsonb\)/i
    );
    assert.doesNotMatch(statement.text, /\bSELECT\b/i);
    assert.equal(statement.values.length >= 3, true);
  }
});

test("overlapping team identity updates upsert only their target rows", async () => {
  const sql = createSqlStub();
  const store = createNarrowUpdateStore(sql);

  await Promise.all([
    store.updateTeamIdentity("fp", "Team Alfa", { displayName: "Alfa" }),
    store.updateTeamIdentity("fp", "Team Beta", { displayName: "Beta" })
  ]);

  assert.deepEqual(Object.fromEntries(sql.state.teams), {
    "fp:Team Gamma": { displayName: "Gamma" },
    "fp:Team Alfa": { displayName: "Alfa" },
    "fp:Team Beta": { displayName: "Beta" }
  });
  assert.equal(sql.statements.length, 2);
  for (const statement of sql.statements) {
    assert.match(statement.text, /^INSERT INTO lineup_fanta\.fantasy_teams/i);
    assert.match(statement.text, /ON CONFLICT \(league, team_key\) DO UPDATE/i);
    assert.doesNotMatch(statement.text, /\bDELETE\b/i);
  }
});

test("fantasy-team seeding inserts missing rows without replacing live profiles", async () => {
  const sql = createSqlStub();
  const store = createNarrowUpdateStore(sql);

  await store.seedFantasyTeams("fp", {
    "Team Gamma": { displayName: "Legacy Gamma" },
    "Team Beta": { displayName: "Beta" }
  });

  assert.deepEqual(sql.state.teams.get("fp:Team Gamma"), { displayName: "Gamma" });
  assert.deepEqual(sql.state.teams.get("fp:Team Beta"), { displayName: "Beta" });
  assert.equal(sql.transactions.length, 1);
  assert.match(sql.transactions[0].map(({ text }) => text).join(" "), /ON CONFLICT \(league, team_key\) DO NOTHING/i);
  assert.doesNotMatch(sql.transactions[0].map(({ text }) => text).join(" "), /\bDELETE\b|\bUPDATE\b/i);
});

test("team profile and logo writes roll back together when the logo upsert fails", async () => {
  const sql = createSqlStub({ failLogo: true });
  const store = createNarrowUpdateStore(sql);

  await assert.rejects(
    () => store.updateTeamIdentity(
      "fp",
      "Team Alfa",
      { displayName: "Alfa", logoUrl: "/api/team-logo?league=fp&team=Team+Alfa" },
      { mimeType: "image/png", bytes: Buffer.from("89504e470d0a1a0a", "hex"), sha256: "a".repeat(64) }
    ),
    /logo write failed/
  );

  assert.equal(sql.state.teams.has("fp:Team Alfa"), false);
  assert.equal(sql.state.logos.has("fp:Team Alfa"), false);
  assert.deepEqual(sql.state.teams.get("fp:Team Gamma"), { displayName: "Gamma" });
  assert.equal(sql.statements.length, 2);
  assert.equal(sql.transactions.length, 1);
  assert.deepEqual(
    sql.transactions[0].map(({ text }) => /fantasy_teams/i.test(text) ? "profile" : "logo"),
    ["profile", "logo"]
  );
  assert.doesNotMatch(sql.statements.map(({ text }) => text).join(" "), /DELETE FROM lineup_fanta\.fantasy_teams/i);
});
