"use strict";

let sqlInstance = null;
let schemaPromise = null;

function databaseUrl() {
  return String(process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

function databaseConfigured() {
  return Boolean(databaseUrl());
}

function sqlClient() {
  if (!databaseConfigured()) throw new Error("DATABASE_URL non configurata");
  if (!sqlInstance) {
    const { neon } = require("@neondatabase/serverless");
    sqlInstance = neon(databaseUrl());
  }
  return sqlInstance;
}

async function ensureSchema() {
  if (!databaseConfigured()) return false;
  if (!schemaPromise) {
    const sql = sqlClient();
    schemaPromise = (async () => {
      const existing = await sql`
        SELECT
          to_regclass('lineup_fanta.runtime_settings') AS runtime_settings,
          to_regclass('lineup_fanta.fantasy_teams') AS fantasy_teams,
          to_regclass('lineup_fanta.logo_access') AS logo_access,
          to_regclass('lineup_fanta.team_logos') AS team_logos,
          to_regclass('lineup_fanta.bsd_player_overrides') AS bsd_player_overrides,
          to_regclass('lineup_fanta.bsd_team_overrides') AS bsd_team_overrides,
          to_regclass('lineup_fanta.bsd_manifest_cache') AS bsd_manifest_cache
      `;
      const ready = existing[0] && Object.values(existing[0]).every(Boolean);
      if (ready) return true;

      await sql`CREATE SCHEMA IF NOT EXISTS lineup_fanta`;
      await sql`
        CREATE TABLE IF NOT EXISTS lineup_fanta.runtime_settings (
          key text PRIMARY KEY,
          value jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS lineup_fanta.fantasy_teams (
          league text NOT NULL CHECK (league IN ('fp', 'pd')),
          team_key text NOT NULL,
          payload jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (league, team_key)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS lineup_fanta.logo_access (
          league text NOT NULL CHECK (league IN ('fp', 'pd')),
          team_key text NOT NULL,
          password_hash text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (league, team_key)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS lineup_fanta.team_logos (
          league text NOT NULL CHECK (league IN ('fp', 'pd')),
          team_key text NOT NULL,
          mime_type text NOT NULL,
          image_bytes bytea NOT NULL,
          sha256 text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (league, team_key),
          CHECK (octet_length(image_bytes) <= 524288)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS lineup_fanta.bsd_player_overrides (
          league text NOT NULL CHECK (league IN ('fp', 'pd')),
          player_key text NOT NULL,
          bsd_player_id bigint NOT NULL,
          bsd_player_name text,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (league, player_key)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS lineup_fanta.bsd_team_overrides (
          league text NOT NULL CHECK (league IN ('fp', 'pd')),
          team_key text NOT NULL,
          bsd_team_id bigint NOT NULL,
          bsd_team_name text,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (league, team_key)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS lineup_fanta.bsd_manifest_cache (
          league text PRIMARY KEY CHECK (league IN ('fp', 'pd')),
          manifest jsonb NOT NULL,
          generated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      return true;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function readRuntimeSetting(key) {
  if (!databaseConfigured()) return null;
  await ensureSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT value, updated_at
    FROM lineup_fanta.runtime_settings
    WHERE key = ${String(key)}
    LIMIT 1
  `;
  return rows[0] ? { value: rows[0].value, updatedAt: rows[0].updated_at } : null;
}

async function writeRuntimeSetting(key, value) {
  await ensureSchema();
  const sql = sqlClient();
  const payload = JSON.stringify(value ?? null);
  const rows = await sql`
    INSERT INTO lineup_fanta.runtime_settings (key, value, updated_at)
    VALUES (${String(key)}, ${payload}::jsonb, now())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = now()
    RETURNING value, updated_at
  `;
  return { value: rows[0].value, updatedAt: rows[0].updated_at };
}

async function readFantasyTeams(league) {
  if (!databaseConfigured()) return null;
  await ensureSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT team_key, payload, updated_at
    FROM lineup_fanta.fantasy_teams
    WHERE league = ${String(league)}
    ORDER BY team_key
  `;
  if (!rows.length) return null;
  const teams = {};
  let updatedAt = null;
  rows.forEach((row) => {
    teams[row.team_key] = row.payload || {};
    if (!updatedAt || new Date(row.updated_at) > new Date(updatedAt)) updatedAt = row.updated_at;
  });
  return { teams, updatedAt };
}

async function writeFantasyTeams(league, teams) {
  await ensureSchema();
  const sql = sqlClient();
  const entries = Object.entries(teams || {});
  const queries = [sql`DELETE FROM lineup_fanta.fantasy_teams WHERE league = ${String(league)}`];
  entries.forEach(([teamKey, payload]) => {
    queries.push(sql`
      INSERT INTO lineup_fanta.fantasy_teams (league, team_key, payload, updated_at)
      VALUES (${String(league)}, ${String(teamKey)}, ${JSON.stringify(payload || {})}::jsonb, now())
    `);
  });
  await sql.transaction(queries);
  return { teams: structuredClone(teams || {}), updatedAt: new Date().toISOString() };
}

async function readLogoAccessRows(league) {
  if (!databaseConfigured()) return null;
  await ensureSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT team_key, password_hash, updated_at
    FROM lineup_fanta.logo_access
    WHERE league = ${String(league)}
    ORDER BY team_key
  `;
  if (!rows.length) return null;
  const teams = {};
  let updatedAt = null;
  rows.forEach((row) => {
    teams[row.team_key] = { codeHash: row.password_hash, updatedAt: row.updated_at };
    if (!updatedAt || new Date(row.updated_at) > new Date(updatedAt)) updatedAt = row.updated_at;
  });
  return { teams, updatedAt };
}

async function upsertLogoAccess(league, teamKey, passwordHash) {
  await ensureSchema();
  const sql = sqlClient();
  await sql`
    INSERT INTO lineup_fanta.logo_access (league, team_key, password_hash, updated_at)
    VALUES (${String(league)}, ${String(teamKey)}, ${String(passwordHash)}, now())
    ON CONFLICT (league, team_key) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          updated_at = now()
  `;
}

async function deleteLogoAccess(league, teamKeys) {
  if (!databaseConfigured()) return;
  const keys = [...new Set((teamKeys || []).map((key) => String(key)).filter(Boolean))];
  if (!keys.length) return;
  await ensureSchema();
  const sql = sqlClient();
  const queries = keys.map((teamKey) => sql`
    DELETE FROM lineup_fanta.logo_access
    WHERE league = ${String(league)} AND team_key = ${String(teamKey)}
  `);
  await sql.transaction(queries);
}

async function listTeamLogoMetadata(league) {
  if (!databaseConfigured()) return {};
  await ensureSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT team_key, mime_type, sha256, updated_at
    FROM lineup_fanta.team_logos
    WHERE league = ${String(league)}
  `;
  return Object.fromEntries(rows.map((row) => [row.team_key, {
    mimeType: row.mime_type,
    sha256: row.sha256,
    updatedAt: row.updated_at
  }]));
}

async function readTeamLogo(league, teamKey) {
  if (!databaseConfigured()) return null;
  await ensureSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT mime_type, encode(image_bytes, 'base64') AS data_base64, sha256, updated_at
    FROM lineup_fanta.team_logos
    WHERE league = ${String(league)} AND team_key = ${String(teamKey)}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    mimeType: rows[0].mime_type,
    bytes: Buffer.from(String(rows[0].data_base64 || ""), "base64"),
    sha256: rows[0].sha256,
    updatedAt: rows[0].updated_at
  };
}

async function writeTeamLogo(league, teamKey, mimeType, bytes, sha256) {
  await ensureSchema();
  const sql = sqlClient();
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!buffer.length || buffer.length > 512 * 1024) throw new Error("Stemma troppo pesante per Neon");
  await sql`
    INSERT INTO lineup_fanta.team_logos (league, team_key, mime_type, image_bytes, sha256, updated_at)
    VALUES (
      ${String(league)},
      ${String(teamKey)},
      ${String(mimeType)},
      decode(${buffer.toString("base64")}, 'base64'),
      ${String(sha256)},
      now()
    )
    ON CONFLICT (league, team_key) DO UPDATE
      SET mime_type = EXCLUDED.mime_type,
          image_bytes = EXCLUDED.image_bytes,
          sha256 = EXCLUDED.sha256,
          updated_at = now()
  `;
}

async function readPlayerOverrides(league) {
  if (!databaseConfigured()) return {};
  await ensureSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT player_key, bsd_player_id, bsd_player_name, updated_at
    FROM lineup_fanta.bsd_player_overrides
    WHERE league = ${String(league)}
  `;
  return Object.fromEntries(rows.map((row) => [row.player_key, {
    id: String(row.bsd_player_id),
    name: String(row.bsd_player_name || ""),
    updatedAt: row.updated_at
  }]));
}

async function upsertPlayerOverride(league, playerKey, playerId, playerName = "") {
  await ensureSchema();
  const sql = sqlClient();
  await sql`
    INSERT INTO lineup_fanta.bsd_player_overrides
      (league, player_key, bsd_player_id, bsd_player_name, updated_at)
    VALUES (${String(league)}, ${String(playerKey)}, ${String(playerId)}::bigint, ${String(playerName || "")}, now())
    ON CONFLICT (league, player_key) DO UPDATE
      SET bsd_player_id = EXCLUDED.bsd_player_id,
          bsd_player_name = EXCLUDED.bsd_player_name,
          updated_at = now()
  `;
}

async function readTeamOverrides(league) {
  if (!databaseConfigured()) return {};
  await ensureSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT team_key, bsd_team_id, bsd_team_name, updated_at
    FROM lineup_fanta.bsd_team_overrides
    WHERE league = ${String(league)}
  `;
  return Object.fromEntries(rows.map((row) => [row.team_key, {
    id: String(row.bsd_team_id),
    name: String(row.bsd_team_name || ""),
    updatedAt: row.updated_at
  }]));
}

async function upsertTeamOverrides(league, entries) {
  const rows = Array.isArray(entries) ? entries : [];
  if (!rows.length) return;
  await ensureSchema();
  const sql = sqlClient();
  const queries = rows.map((entry) => sql`
    INSERT INTO lineup_fanta.bsd_team_overrides
      (league, team_key, bsd_team_id, bsd_team_name, updated_at)
    VALUES (
      ${String(league)},
      ${String(entry.teamKey)},
      ${String(entry.id)}::bigint,
      ${String(entry.name || "")},
      now()
    )
    ON CONFLICT (league, team_key) DO UPDATE
      SET bsd_team_id = EXCLUDED.bsd_team_id,
          bsd_team_name = EXCLUDED.bsd_team_name,
          updated_at = now()
  `);
  await sql.transaction(queries);
}

async function readManifestCache(league) {
  if (!databaseConfigured()) return null;
  await ensureSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT manifest, generated_at
    FROM lineup_fanta.bsd_manifest_cache
    WHERE league = ${String(league)}
    LIMIT 1
  `;
  return rows[0] ? { state: rows[0].manifest, generatedAt: rows[0].generated_at } : null;
}

async function writeManifestCache(league, state) {
  if (!databaseConfigured()) return;
  await ensureSchema();
  const sql = sqlClient();
  await sql`
    INSERT INTO lineup_fanta.bsd_manifest_cache (league, manifest, generated_at)
    VALUES (${String(league)}, ${JSON.stringify(state)}::jsonb, now())
    ON CONFLICT (league) DO UPDATE
      SET manifest = EXCLUDED.manifest,
          generated_at = now()
  `;
}

async function clearManifestCache(league) {
  if (!databaseConfigured()) return;
  await ensureSchema();
  const sql = sqlClient();
  await sql`DELETE FROM lineup_fanta.bsd_manifest_cache WHERE league = ${String(league)}`;
}

// --- Checkpoint del ricalcolo a spezzoni -----------------------------------
// Il refresh diretto intero dura troppo per una serverless (Vercel Hobby taglia
// ~60s): viene frazionato in "step" dal chiamante. Ogni step salva qui lo stato
// di avanzamento e la risposta successiva riparte da dove si era fermato.
// Il delivery vive in runtime_settings (chiave separata) per non toccare il
// manifest cache pubblico: un checkpoint NON e' mai servibile ai client.

function checkpointKey(league) {
  return `bsd_refresh_checkpoint:${String(league)}`;
}

async function readRefreshCheckpoint(league) {
  const row = await readRuntimeSetting(checkpointKey(league));
  return row && row.value ? row.value : null;
}

async function writeRefreshCheckpoint(league, payload) {
  await writeRuntimeSetting(checkpointKey(league), payload);
}

async function clearRefreshCheckpoint(league) {
  if (!databaseConfigured()) return;
  await ensureSchema();
  const sql = sqlClient();
  await sql`DELETE FROM lineup_fanta.runtime_settings WHERE key = ${checkpointKey(league)}`;
}

module.exports = {
  clearManifestCache,
  clearRefreshCheckpoint,
  databaseConfigured,
  deleteLogoAccess,
  ensureSchema,
  listTeamLogoMetadata,
  readFantasyTeams,
  readLogoAccessRows,
  readManifestCache,
  readPlayerOverrides,
  readRefreshCheckpoint,
  readRuntimeSetting,
  readTeamLogo,
  readTeamOverrides,
  sqlClient,
  upsertLogoAccess,
  upsertPlayerOverride,
  upsertTeamOverrides,
  writeFantasyTeams,
  writeManifestCache,
  writeRefreshCheckpoint,
  writeRuntimeSetting,
  writeTeamLogo
};
