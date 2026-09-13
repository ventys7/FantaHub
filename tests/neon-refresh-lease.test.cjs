"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRefreshCheckpointStore } = require("../lib/neon.cjs");

function createSqlStub() {
  const checkpoints = new Map();
  const manifests = new Map();
  const playerOverrides = new Map();
  const teamOverrides = new Map();
  let now = 0;

  const sql = async (strings, ...values) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    if (/^INSERT INTO lineup_fanta\.bsd_refresh_checkpoints/i.test(text)) {
      const league = String(values[0]);
      const current = checkpoints.get(league);
      const [owner, leaseMs] = values.slice(1);
      if (current?.owner && current.leaseUntil > now && current.owner !== owner) return [];
      const row = {
        checkpoint: current?.checkpoint || null,
        owner,
        leaseUntil: now + Number(leaseMs),
        fencingToken: Number(current?.fencingToken || 0) + 1
      };
      checkpoints.set(league, row);
      return [databaseRow(row)];
    }

    if (/^UPDATE lineup_fanta\.bsd_refresh_checkpoints SET checkpoint = \?/i.test(text)) {
      const [checkpoint, leaseMs, league, owner, fencingToken] = values;
      const current = checkpoints.get(String(league));
      if (!isLive(current, owner, fencingToken, now)) return [];
      current.checkpoint = JSON.parse(checkpoint);
      current.leaseUntil = now + Number(leaseMs);
      return [databaseRow(current)];
    }
    if (/^UPDATE lineup_fanta\.bsd_refresh_checkpoints SET lease_until =/i.test(text)) {
      const [leaseMs, league, owner, fencingToken] = values;
      const current = checkpoints.get(String(league));
      if (!isLive(current, owner, fencingToken, now)) return [];
      current.leaseUntil = now + Number(leaseMs);
      return [databaseRow(current)];
    }
    if (/^UPDATE lineup_fanta\.bsd_refresh_checkpoints SET checkpoint = NULL/i.test(text)) {
      const [league, owner, fencingToken] = values;
      const current = checkpoints.get(String(league));
      if (!isLive(current, owner, fencingToken, now)) return [];
      current.checkpoint = null;
      return [databaseRow(current)];
    }
    if (/^UPDATE lineup_fanta\.bsd_refresh_checkpoints SET owner = NULL/i.test(text)) {
      const [league, owner, fencingToken] = values;
      const current = checkpoints.get(String(league));
      if (!isLive(current, owner, fencingToken, now)) return [];
      current.owner = null;
      current.leaseUntil = null;
      return [databaseRow(current)];
    }
    if (/^WITH live_lease AS/i.test(text) && /bsd_player_overrides/i.test(text)) {
      assert.match(text, /^WITH live_lease AS \( UPDATE lineup_fanta\.bsd_refresh_checkpoints SET updated_at = now\(\)/i);
      const [league, owner, fencingToken, playerKey, playerId, playerName] = values;
      const current = checkpoints.get(String(league));
      if (!isLive(current, owner, fencingToken, now)) return [];
      playerOverrides.set(`${league}:${playerKey}`, { id: String(playerId), name: String(playerName) });
      return [{ fencing_token: String(current.fencingToken) }];
    }
    if (/^WITH live_lease AS/i.test(text) && /bsd_team_overrides/i.test(text)) {
      assert.match(text, /^WITH live_lease AS \( UPDATE lineup_fanta\.bsd_refresh_checkpoints SET updated_at = now\(\)/i);
      const [league, owner, fencingToken, teamKey, teamId, teamName] = values;
      const current = checkpoints.get(String(league));
      if (!isLive(current, owner, fencingToken, now)) return [];
      teamOverrides.set(`${league}:${teamKey}`, { id: String(teamId), name: String(teamName) });
      return [{ fencing_token: String(current.fencingToken) }];
    }
    if (/^WITH live_lease AS/i.test(text)) {
      const [league, owner, fencingToken, state] = values;
      const current = checkpoints.get(String(league));
      if (!isLive(current, owner, fencingToken, now)) return [];
      current.checkpoint = null;
      manifests.set(String(league), JSON.parse(state));
      return [{ fencing_token: String(current.fencingToken) }];
    }
    throw new Error(`Unexpected SQL: ${text}`);
  };

  sql.advance = (milliseconds) => { now += milliseconds; };
  sql.checkpoint = (league) => checkpoints.get(league)?.checkpoint || null;
  sql.manifest = (league) => manifests.get(league) || null;
  sql.playerOverride = (league, key) => playerOverrides.get(`${league}:${key}`) || null;
  sql.teamOverride = (league, key) => teamOverrides.get(`${league}:${key}`) || null;
  return sql;
}

function isLive(row, owner, fencingToken, now) {
  return row && row.owner === owner
    && row.fencingToken === Number(fencingToken) && row.leaseUntil > now;
}

function databaseRow(row) {
  return {
    checkpoint: row.checkpoint,
    owner: row.owner,
    lease_until: row.leaseUntil == null ? null : new Date(row.leaseUntil),
    fencing_token: String(row.fencingToken)
  };
}

test("refresh checkpoint lease fences stale owners and keeps tokens monotonic", async () => {
  const sql = createSqlStub();
  const store = createRefreshCheckpointStore(sql);

  const token1 = (await store.acquire("fp", "owner-a", 1000)).fencingToken;
  assert.equal(token1, 1);
  assert.equal(await store.acquire("fp", "owner-b", 1000), null);

  sql.advance(1001);
  const token2 = (await store.acquire("fp", "owner-b", 1000)).fencingToken;
  assert.equal(token2, 2);
  assert.equal(await store.renew("fp", "owner-a", token1, 1000), false);
  assert.equal(await store.update("fp", "owner-a", token1, { phase: "search" }, 1000), false);
  assert.equal(await store.clear("fp", "owner-a", token1), false);
  assert.equal(await store.release("fp", "owner-a", token1), false);
  assert.equal(await store.publish("fp", "owner-a", token1, { manifest: { players: {} } }), false);

  sql.advance(600);
  assert.equal(await store.renew("fp", "owner-b", token2, 1000), true);
  sql.advance(500);
  assert.equal(await store.update("fp", "owner-b", token2, { phase: "faces" }, 1000), true);
  const state = { manifest: { players: { saka: { status: "resolved" } } } };
  assert.equal(await store.publish("fp", "owner-b", token2, state), true);
  assert.equal(sql.checkpoint("fp"), null);
  assert.deepEqual(sql.manifest("fp"), state);

  assert.equal(await store.release("fp", "owner-b", token2), true);
  const token3 = (await store.acquire("fp", "owner-c", 1000)).fencingToken;
  assert.equal(token3, 3);
  assert.equal(await store.clear("fp", "owner-c", token3), true);
  assert.equal(await store.release("fp", "owner-c", token3), true);
  assert.equal((await store.acquire("fp", "owner-d", 1000)).fencingToken, 4);
});

test("refresh lease fences player and team override writes", async () => {
  const sql = createSqlStub();
  const store = createRefreshCheckpointStore(sql);
  const token1 = (await store.acquire("fp", "owner-a", 1000)).fencingToken;

  sql.advance(1001);
  const token2 = (await store.acquire("fp", "owner-b", 1000)).fencingToken;
  assert.equal(await store.upsertPlayerOverride("fp", "owner-a", token1, "saka|arsenal", "455", "Saka"), false);
  assert.equal(await store.upsertTeamOverride("fp", "owner-a", token1, { teamKey: "arsenal", id: "18", name: "Arsenal" }), false);
  assert.equal(sql.playerOverride("fp", "saka|arsenal"), null);
  assert.equal(sql.teamOverride("fp", "arsenal"), null);

  assert.equal(await store.upsertPlayerOverride("fp", "owner-b", token2, "saka|arsenal", "455", "Saka"), true);
  assert.equal(await store.upsertTeamOverride("fp", "owner-b", token2, { teamKey: "arsenal", id: "18", name: "Arsenal" }), true);
  assert.deepEqual(sql.playerOverride("fp", "saka|arsenal"), { id: "455", name: "Saka" });
  assert.deepEqual(sql.teamOverride("fp", "arsenal"), { id: "18", name: "Arsenal" });
});
