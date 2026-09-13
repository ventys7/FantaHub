"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createMigration } = require("../lib/migrate-neon.cjs");

function migrationFixture({
  failFpOnce = true,
  leagueTeams = {
    fp: { "FP Team": { displayName: "FP" } },
    pd: { "PD Team": { displayName: "PD" } }
  },
  failReadKeyOnce = "",
  failLogoOnce = false,
  safeFetch = async () => { throw new Error("unexpected fetch"); }
} = {}) {
  const state = {
    marker: null,
    writes: 0,
    settingsWrites: 0,
    teams: new Map(),
    logoAccess: new Map(),
    logoWrites: [],
    failFpOnce,
    failReadKeyOnce,
    failLogoOnce
  };

  const readJson = async (key, fallback) => {
    if (state.failReadKeyOnce === key) {
      state.failReadKeyOnce = "";
      throw new Error(`injected read failure: ${key}`);
    }
    if (key === "settings.json") return { version: 1, leagues: { fp: {}, pd: {} } };
    const teamsMatch = key.match(/^teams\/(fp|pd)\.json$/);
    if (teamsMatch) return { version: 1, teams: leagueTeams[teamsMatch[1]] };
    const accessMatch = key.match(/^logo-access\/(fp|pd)\.json$/);
    if (accessMatch) return {
      teams: { [`${accessMatch[1].toUpperCase()} Team`]: { codeHash: `${accessMatch[1]}-hash` } }
    };
    return fallback;
  };

  const migration = createMigration({
    databaseConfigured: () => true,
    ensureSchema: async () => {},
    readRuntimeSetting: async () => state.marker && ({ value: state.marker }),
    writeRuntimeSetting: async (key, value) => {
      state.writes += 1;
      if (key === "settings") state.settingsWrites += 1;
      else state.marker = structuredClone(value);
      return { value };
    },
    readRepositoryJson: async (relativePath, fallback) => {
      const match = relativePath.match(/^data\/(fp|pd)\/teams\.json$/);
      return match ? { version: 1, teams: leagueTeams[match[1]] } : fallback;
    },
    readJson,
    readBuffer: async () => null,
    safeFetch,
    seedFantasyTeams: async (league, teams) => {
      state.writes += 1;
      if (league === "fp" && state.failFpOnce) {
        state.failFpOnce = false;
        throw new Error("injected FP failure");
      }
      for (const [teamName, profile] of Object.entries(teams)) {
        const key = `${league}:${teamName}`;
        if (!state.teams.has(key)) state.teams.set(key, structuredClone(profile));
      }
    },
    upsertLogoAccess: async (league, teamName, codeHash) => {
      state.writes += 1;
      state.logoAccess.set(`${league}:${teamName}`, codeHash);
    },
    writeFantasyTeams: async (league, teams) => {
      state.writes += 1;
      if (league === "fp" && state.failFpOnce) {
        state.failFpOnce = false;
        throw new Error("injected FP failure");
      }
      for (const [teamName, profile] of Object.entries(teams)) {
        state.teams.set(`${league}:${teamName}`, structuredClone(profile));
      }
    },
    writeTeamLogo: async (...args) => {
      state.writes += 1;
      if (state.failLogoOnce) {
        state.failLogoOnce = false;
        throw new Error("injected logo database failure");
      }
      state.logoWrites.push(args);
    },
    upsertPlayerOverride: async () => { state.writes += 1; },
    upsertTeamOverrides: async () => { state.writes += 1; },
    clearManifestCache: async () => { state.writes += 1; },
    now: () => "2026-09-09T13:00:00.000Z"
  });

  return { migration, state };
}

test("a failed league stays retryable while the other league migrates independently", async () => {
  const { migration, state } = migrationFixture();

  const first = await migration.migrateLegacyRuntimeToNeon();

  assert.deepEqual(first.leagues.map(({ league, success }) => ({ league, success })), [
    { league: "fp", success: false },
    { league: "pd", success: true }
  ]);
  assert.equal(state.marker, null);
  assert.equal(state.teams.has("pd:PD Team"), true);
  assert.equal(state.logoAccess.size, 2);

  const second = await migration.migrateLegacyRuntimeToNeon();

  assert.deepEqual(second.leagues.map(({ league, success }) => ({ league, success })), [
    { league: "fp", success: true },
    { league: "pd", success: true }
  ]);
  assert.equal(state.marker.complete, true);
  assert.equal(state.settingsWrites, 2);
  assert.equal(state.teams.size, 2);
  assert.equal(state.logoAccess.size, 2);

  const writesAfterCompletion = state.writes;
  const third = await migration.migrateLegacyRuntimeToNeon();

  assert.equal(third.alreadyMigrated, true);
  assert.equal(state.writes, writesAfterCompletion);
});

test("rejected legacy logos warn without persisting bytes or unsafe references", async () => {
  const fetchCalls = [];
  const { migration, state } = migrationFixture({
    failFpOnce: false,
    leagueTeams: {
      fp: {
        Unsafe: { displayName: "Unsafe", logoUrl: "https://127.0.0.1/logo.png" },
        Oversized: { displayName: "Oversized", logoUrl: "https://cdn.example/huge.png" }
      },
      pd: {}
    },
    safeFetch: async (url, options) => {
      fetchCalls.push({ url, options });
      if (url.includes("127.0.0.1")) throw new Error("Indirizzo IP non pubblico");
      return { body: Buffer.alloc(512 * 1024 + 1), mimeType: "image/png" };
    }
  });

  const result = await migration.migrateLegacyRuntimeToNeon();

  assert.deepEqual(result.leagues.map(({ league, success }) => ({ league, success })), [
    { league: "fp", success: true },
    { league: "pd", success: true }
  ]);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings.join("\n"), /Indirizzo IP non pubblico/);
  assert.match(result.warnings.join("\n"), /oltre 512 KB/);
  assert.equal(state.logoWrites.length, 0);
  assert.equal(state.teams.get("fp:Unsafe").logoUrl, "");
  assert.equal(state.teams.get("fp:Oversized").logoUrl, "");
  assert.equal(state.marker.complete, true);
  assert.equal(fetchCalls.every(({ options }) => options.maxBytes === 512 * 1024), true);
  assert.equal(fetchCalls.every(({ options }) =>
    options.allowedMimeTypes.join(",") === "image/png,image/jpeg,image/webp"
  ), true);
});

test("a transient logo database failure keeps its league retryable", async () => {
  const { migration, state } = migrationFixture({
    failFpOnce: false,
    failLogoOnce: true,
    leagueTeams: {
      fp: { "FP Team": { logoUrl: "https://cdn.example/fp.png" } },
      pd: { "PD Team": {} }
    },
    safeFetch: async () => ({ body: Buffer.from("image"), mimeType: "image/png" })
  });

  const first = await migration.migrateLegacyRuntimeToNeon();

  assert.equal(first.leagues.find(({ league }) => league === "fp").success, false);
  assert.equal(first.leagues.find(({ league }) => league === "pd").success, true);
  assert.equal(state.marker, null);
  assert.equal(state.logoWrites.length, 0);

  const second = await migration.migrateLegacyRuntimeToNeon();

  assert.equal(second.leagues.every(({ success }) => success), true);
  assert.equal(state.logoWrites.length, 1);
  assert.match(state.teams.get("fp:FP Team").logoUrl, /^\/api\/team-logo\?/);
  assert.equal(state.marker.complete, true);
});

test("a transient settings read failure cannot write the completion marker", async () => {
  const { migration, state } = migrationFixture({
    failFpOnce: false,
    failReadKeyOnce: "settings.json"
  });

  await assert.rejects(
    () => migration.migrateLegacyRuntimeToNeon(),
    /injected read failure: settings\.json/
  );
  assert.equal(state.marker, null);

  const recovered = await migration.migrateLegacyRuntimeToNeon();

  assert.equal(recovered.leagues.every(({ success }) => success), true);
  assert.equal(state.marker.complete, true);
});

test("a transient league read failure does not block the other league", async () => {
  const { migration, state } = migrationFixture({
    failFpOnce: false,
    failReadKeyOnce: "teams/fp.json"
  });

  const first = await migration.migrateLegacyRuntimeToNeon();

  assert.equal(first.leagues.find(({ league }) => league === "fp").success, false);
  assert.equal(first.leagues.find(({ league }) => league === "pd").success, true);
  assert.equal(state.marker, null);
  assert.equal(state.teams.has("pd:PD Team"), true);

  const recovered = await migration.migrateLegacyRuntimeToNeon();

  assert.equal(recovered.leagues.every(({ success }) => success), true);
  assert.equal(state.marker.complete, true);
});

test("a retry seeds missing leagues without overwriting a live team update", async () => {
  const { migration, state } = migrationFixture({
    failFpOnce: false,
    failReadKeyOnce: "teams/pd.json"
  });

  const first = await migration.migrateLegacyRuntimeToNeon();
  assert.equal(first.leagues.find(({ league }) => league === "fp").success, true);
  assert.equal(first.leagues.find(({ league }) => league === "pd").success, false);
  state.teams.set("fp:FP Team", { displayName: "Live FP" });

  const recovered = await migration.migrateLegacyRuntimeToNeon();

  assert.equal(recovered.leagues.every(({ success }) => success), true);
  assert.deepEqual(state.teams.get("fp:FP Team"), { displayName: "Live FP" });
  assert.deepEqual(state.teams.get("pd:PD Team"), { displayName: "PD" });
  assert.equal(state.marker.complete, true);
});
