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

function quotaDate(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Data quota BSD non valida");
  return date.toISOString().slice(0, 10);
}

function quotaRecord(row) {
  const rateLimitedUntil = row.rate_limited_until;
  return {
    date: quotaDate(row.quota_date),
    calls: Number(row.calls || 0),
    rateLimitedUntil: rateLimitedUntil instanceof Date ? rateLimitedUntil.toISOString() : rateLimitedUntil || null
  };
}

function createBsdQuotaStore(sql) {
  if (typeof sql !== "function") throw new TypeError("Client SQL Neon non valido");
  const result = async (query) => quotaRecord((await query)[0]);

  return {
    read(date = new Date()) {
      const day = quotaDate(date);
      return result(sql`
        INSERT INTO lineup_fanta.bsd_quota (quota_date, calls, rate_limited_until, updated_at)
        VALUES (${day}, 0, NULL, now())
        ON CONFLICT (quota_date) DO UPDATE
          SET quota_date = EXCLUDED.quota_date
        RETURNING quota_date, calls, rate_limited_until
      `);
    },
    increment(delta, date = new Date()) {
      const day = quotaDate(date);
      const amount = Math.max(0, Math.trunc(Number(delta) || 0));
      return result(sql`
        INSERT INTO lineup_fanta.bsd_quota (quota_date, calls, rate_limited_until, updated_at)
        VALUES (${day}, ${amount}, NULL, now())
        ON CONFLICT (quota_date) DO UPDATE
          SET calls = lineup_fanta.bsd_quota.calls + EXCLUDED.calls,
              updated_at = now()
        RETURNING quota_date, calls, rate_limited_until
      `);
    },
    markRateLimited(until, date = new Date()) {
      const day = quotaDate(date);
      const rateLimitedUntil = new Date(until);
      if (Number.isNaN(rateLimitedUntil.getTime())) throw new TypeError("Scadenza quota BSD non valida");
      return result(sql`
        INSERT INTO lineup_fanta.bsd_quota (quota_date, calls, rate_limited_until, updated_at)
        VALUES (${day}, 0, ${rateLimitedUntil.toISOString()}, now())
        ON CONFLICT (quota_date) DO UPDATE
          SET rate_limited_until = EXCLUDED.rate_limited_until,
              updated_at = now()
        RETURNING quota_date, calls, rate_limited_until
      `);
    }
  };
}

function createAuthThrottleStore(sql) {
  if (typeof sql !== "function") throw new TypeError("Client SQL Neon non valido");
  const key = (value) => {
    const normalized = String(value || "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) throw new TypeError("Chiave throttle non valida");
    return normalized;
  };

  return {
    async consume(bucketKey) {
      await sql`DELETE FROM lineup_fanta.auth_throttle WHERE expires_at <= now()`;
      const rows = await sql`
        INSERT INTO lineup_fanta.auth_throttle (bucket_key, attempts, expires_at, updated_at)
        VALUES (${key(bucketKey)}, 1, now() + ${15 * 60} * interval '1 second', now())
        ON CONFLICT (bucket_key) DO UPDATE
          SET attempts = CASE
                WHEN lineup_fanta.auth_throttle.expires_at <= now() THEN 1
                ELSE LEAST(lineup_fanta.auth_throttle.attempts + 1, ${6})
              END,
              expires_at = CASE
                WHEN lineup_fanta.auth_throttle.expires_at <= now() THEN now() + ${15 * 60} * interval '1 second'
                ELSE lineup_fanta.auth_throttle.expires_at
              END,
              updated_at = now()
        RETURNING attempts,
          GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - now()))))::integer AS retry_after
      `;
      const attempts = Number(rows[0].attempts);
      return { allowed: attempts <= 5, retryAfter: attempts <= 5 ? 0 : Number(rows[0].retry_after) };
    },
    async reset(bucketKey) {
      await sql`DELETE FROM lineup_fanta.auth_throttle WHERE bucket_key = ${key(bucketKey)}`;
    }
  };
}

function createNarrowUpdateStore(sql) {
  if (typeof sql !== "function") throw new TypeError("Client SQL Neon non valido");

  return {
    async updateLeagueSettings(league, settings) {
      const payload = JSON.stringify(settings || {});
      const rows = await sql`
        INSERT INTO lineup_fanta.runtime_settings (key, value, updated_at)
        VALUES (
          ${"settings"},
          jsonb_build_object(
            'version', 1,
            'leagues', jsonb_build_object('fp', '{}'::jsonb, 'pd', '{}'::jsonb)
              || jsonb_build_object(${String(league)}, ${payload}::jsonb),
            'updatedAt', to_jsonb(now())
          ),
          now()
        )
        ON CONFLICT (key) DO UPDATE
          SET value = jsonb_set(
                jsonb_set(
                  lineup_fanta.runtime_settings.value,
                  '{leagues}',
                  COALESCE(lineup_fanta.runtime_settings.value->'leagues', '{}'::jsonb)
                    || jsonb_build_object(${String(league)}, ${payload}::jsonb),
                  true
                ),
                '{updatedAt}',
                to_jsonb(now()),
                true
              ),
              updated_at = now()
        RETURNING value, updated_at
      `;
      return { value: rows[0].value, updatedAt: rows[0].updated_at };
    },
    async seedFantasyTeams(league, teams) {
      const queries = Object.entries(teams || {}).map(([teamKey, profile]) => sql`
        INSERT INTO lineup_fanta.fantasy_teams (league, team_key, payload, updated_at)
        VALUES (${String(league)}, ${String(teamKey)}, ${JSON.stringify(profile || {})}::jsonb, now())
        ON CONFLICT (league, team_key) DO NOTHING
      `);
      if (queries.length) await sql.transaction(queries);
      return { teams: structuredClone(teams || {}), updatedAt: new Date().toISOString() };
    },
    async updateTeamIdentity(league, teamKey, profile, logo) {
      const profileQuery = sql`
        INSERT INTO lineup_fanta.fantasy_teams (league, team_key, payload, updated_at)
        VALUES (${String(league)}, ${String(teamKey)}, ${JSON.stringify(profile || {})}::jsonb, now())
        ON CONFLICT (league, team_key) DO UPDATE
          SET payload = EXCLUDED.payload,
              updated_at = now()
      `;
      if (!logo) return profileQuery;

      const buffer = Buffer.isBuffer(logo.bytes) ? logo.bytes : Buffer.from(logo.bytes);
      if (!buffer.length || buffer.length > 512 * 1024) throw new Error("Stemma troppo pesante per Neon");
      const logoQuery = sql`
        INSERT INTO lineup_fanta.team_logos (league, team_key, mime_type, image_bytes, sha256, updated_at)
        VALUES (
          ${String(league)},
          ${String(teamKey)},
          ${String(logo.mimeType)},
          decode(${buffer.toString("base64")}, 'base64'),
          ${String(logo.sha256)},
          now()
        )
        ON CONFLICT (league, team_key) DO UPDATE
          SET mime_type = EXCLUDED.mime_type,
              image_bytes = EXCLUDED.image_bytes,
              sha256 = EXCLUDED.sha256,
              updated_at = now()
      `;
      await sql.transaction([profileQuery, logoQuery]);
    }
  };
}

function refreshCheckpointRecord(row) {
  if (!row) return null;
  return {
    checkpoint: row.checkpoint || null,
    owner: row.owner || null,
    leaseUntil: row.lease_until || null,
    fencingToken: Number(row.fencing_token)
  };
}

function createRefreshCheckpointStore(sql) {
  if (typeof sql !== "function") throw new TypeError("Client SQL Neon non valido");
  const leaseMs = (value) => Math.max(1, Math.trunc(Number(value) || 0));
  const token = (value) => Math.max(0, Math.trunc(Number(value) || 0));
  const changed = async (query) => Boolean((await query)[0]);

  return {
    async acquire(league, owner, durationMs) {
      const rows = await sql`
        INSERT INTO lineup_fanta.bsd_refresh_checkpoints
          (league, checkpoint, owner, lease_until, fencing_token, updated_at)
        VALUES (${String(league)}, NULL, ${String(owner)}, now() + ${leaseMs(durationMs)} * interval '1 millisecond', 1, now())
        ON CONFLICT (league) DO UPDATE
          SET owner = EXCLUDED.owner,
              lease_until = EXCLUDED.lease_until,
              fencing_token = lineup_fanta.bsd_refresh_checkpoints.fencing_token + 1,
              updated_at = now()
        WHERE lineup_fanta.bsd_refresh_checkpoints.owner IS NULL
           OR lineup_fanta.bsd_refresh_checkpoints.lease_until <= now()
        RETURNING checkpoint, owner, lease_until, fencing_token
      `;
      return refreshCheckpointRecord(rows[0]);
    },
    async read(league) {
      const rows = await sql`
        SELECT checkpoint, owner, lease_until, fencing_token
        FROM lineup_fanta.bsd_refresh_checkpoints
        WHERE league = ${String(league)}
        LIMIT 1
      `;
      return refreshCheckpointRecord(rows[0]);
    },
    update(league, owner, fencingToken, checkpoint, durationMs) {
      return changed(sql`
        UPDATE lineup_fanta.bsd_refresh_checkpoints
        SET checkpoint = ${JSON.stringify(checkpoint)}::jsonb,
            lease_until = now() + ${leaseMs(durationMs)} * interval '1 millisecond',
            updated_at = now()
        WHERE league = ${String(league)}
          AND owner = ${String(owner)}
          AND fencing_token = ${token(fencingToken)}
          AND lease_until > now()
        RETURNING fencing_token
      `);
    },
    renew(league, owner, fencingToken, durationMs) {
      return changed(sql`
        UPDATE lineup_fanta.bsd_refresh_checkpoints
        SET lease_until = now() + ${leaseMs(durationMs)} * interval '1 millisecond',
            updated_at = now()
        WHERE league = ${String(league)}
          AND owner = ${String(owner)}
          AND fencing_token = ${token(fencingToken)}
          AND lease_until > now()
        RETURNING fencing_token
      `);
    },
    clear(league, owner, fencingToken) {
      return changed(sql`
        UPDATE lineup_fanta.bsd_refresh_checkpoints
        SET checkpoint = NULL, updated_at = now()
        WHERE league = ${String(league)}
          AND owner = ${String(owner)}
          AND fencing_token = ${token(fencingToken)}
          AND lease_until > now()
        RETURNING fencing_token
      `);
    },
    release(league, owner, fencingToken) {
      return changed(sql`
        UPDATE lineup_fanta.bsd_refresh_checkpoints
        SET owner = NULL, lease_until = NULL, updated_at = now()
        WHERE league = ${String(league)}
          AND owner = ${String(owner)}
          AND fencing_token = ${token(fencingToken)}
          AND lease_until > now()
        RETURNING fencing_token
      `);
    },
    publish(league, owner, fencingToken, state) {
      return changed(sql`
        WITH live_lease AS (
          UPDATE lineup_fanta.bsd_refresh_checkpoints
          SET checkpoint = NULL, updated_at = now()
          WHERE league = ${String(league)}
            AND owner = ${String(owner)}
            AND fencing_token = ${token(fencingToken)}
            AND lease_until > now()
          RETURNING league, fencing_token
        ), published AS (
          INSERT INTO lineup_fanta.bsd_manifest_cache (league, manifest, generated_at)
          SELECT league, ${JSON.stringify(state)}::jsonb, now()
          FROM live_lease
          ON CONFLICT (league) DO UPDATE
            SET manifest = EXCLUDED.manifest,
                generated_at = now()
          RETURNING league
        )
        SELECT live_lease.fencing_token
        FROM live_lease JOIN published USING (league)
      `);
    },
    upsertPlayerOverride(league, owner, fencingToken, playerKey, playerId, playerName = "") {
      return changed(sql`
        WITH live_lease AS (
          UPDATE lineup_fanta.bsd_refresh_checkpoints
          SET updated_at = now()
          WHERE league = ${String(league)}
            AND owner = ${String(owner)}
            AND fencing_token = ${token(fencingToken)}
            AND lease_until > now()
          RETURNING league, fencing_token
        ), written AS (
          INSERT INTO lineup_fanta.bsd_player_overrides
            (league, player_key, bsd_player_id, bsd_player_name, updated_at)
          SELECT league, ${String(playerKey)}, ${String(playerId)}::bigint, ${String(playerName || "")}, now()
          FROM live_lease
          ON CONFLICT (league, player_key) DO UPDATE
            SET bsd_player_id = EXCLUDED.bsd_player_id,
                bsd_player_name = EXCLUDED.bsd_player_name,
                updated_at = now()
          RETURNING league
        )
        SELECT live_lease.fencing_token
        FROM live_lease JOIN written USING (league)
      `);
    },
    upsertTeamOverride(league, owner, fencingToken, entry) {
      return changed(sql`
        WITH live_lease AS (
          UPDATE lineup_fanta.bsd_refresh_checkpoints
          SET updated_at = now()
          WHERE league = ${String(league)}
            AND owner = ${String(owner)}
            AND fencing_token = ${token(fencingToken)}
            AND lease_until > now()
          RETURNING league, fencing_token
        ), written AS (
          INSERT INTO lineup_fanta.bsd_team_overrides
            (league, team_key, bsd_team_id, bsd_team_name, updated_at)
          SELECT league, ${String(entry.teamKey)}, ${String(entry.id)}::bigint, ${String(entry.name || "")}, now()
          FROM live_lease
          ON CONFLICT (league, team_key) DO UPDATE
            SET bsd_team_id = EXCLUDED.bsd_team_id,
                bsd_team_name = EXCLUDED.bsd_team_name,
                updated_at = now()
          RETURNING league
        )
        SELECT live_lease.fencing_token
        FROM live_lease JOIN written USING (league)
      `);
    }
  };
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
          to_regclass('lineup_fanta.bsd_manifest_cache') AS bsd_manifest_cache,
          to_regclass('lineup_fanta.bsd_quota') AS bsd_quota,
          to_regclass('lineup_fanta.bsd_refresh_checkpoints') AS bsd_refresh_checkpoints,
          to_regclass('lineup_fanta.auth_throttle') AS auth_throttle,
          to_regclass('lineup_fanta.fantasy_teams_display_name_unique') AS fantasy_teams_display_name_unique
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
        CREATE UNIQUE INDEX IF NOT EXISTS fantasy_teams_display_name_unique
        ON lineup_fanta.fantasy_teams (
          league,
          lower(btrim(regexp_replace(
            normalize(COALESCE(payload->>'displayName', ''), NFD),
            U&'[\\0300-\\036f]',
            '',
            'g'
          )))
        )
        WHERE lower(btrim(regexp_replace(
          normalize(COALESCE(payload->>'displayName', ''), NFD),
          U&'[\\0300-\\036f]',
          '',
          'g'
        ))) <> ''
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
      await sql`
        CREATE TABLE IF NOT EXISTS lineup_fanta.bsd_quota (
          quota_date date PRIMARY KEY,
          calls bigint NOT NULL DEFAULT 0 CHECK (calls >= 0),
          rate_limited_until timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS lineup_fanta.bsd_refresh_checkpoints (
          league text PRIMARY KEY CHECK (league IN ('fp', 'pd')),
          checkpoint jsonb,
          owner text,
          lease_until timestamptz,
          fencing_token bigint NOT NULL DEFAULT 0 CHECK (fencing_token >= 0),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS lineup_fanta.auth_throttle (
          bucket_key character(64) PRIMARY KEY CHECK (bucket_key ~ '^[0-9a-f]{64}$'),
          attempts smallint NOT NULL CHECK (attempts BETWEEN 1 AND 6),
          expires_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
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

async function readBsdQuota(date) {
  await ensureSchema();
  return createBsdQuotaStore(sqlClient()).read(date);
}

async function incrementBsdQuota(delta, date) {
  await ensureSchema();
  return createBsdQuotaStore(sqlClient()).increment(delta, date);
}

async function markBsdQuotaRateLimited(until, date) {
  await ensureSchema();
  return createBsdQuotaStore(sqlClient()).markRateLimited(until, date);
}

function runtimeSettingRecord(row) {
  if (!row) return null;
  const record = { value: row.value, updatedAt: row.updated_at };
  if (row.version !== undefined) record.version = String(row.version);
  return record;
}

async function readRuntimeSetting(key) {
  if (!databaseConfigured()) return null;
  await ensureSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT value, updated_at, xmin::text AS version
    FROM lineup_fanta.runtime_settings
    WHERE key = ${String(key)}
    LIMIT 1
  `;
  return runtimeSettingRecord(rows[0]);
}

async function writeRuntimeSetting(key, value, expectedVersion) {
  await ensureSchema();
  const sql = sqlClient();
  const payload = JSON.stringify(value ?? null);
  let rows;
  if (arguments.length < 3) {
    rows = await sql`
      INSERT INTO lineup_fanta.runtime_settings (key, value, updated_at)
      VALUES (${String(key)}, ${payload}::jsonb, now())
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = now()
      RETURNING value, updated_at
    `;
  } else if (expectedVersion === null) {
    rows = await sql`
      INSERT INTO lineup_fanta.runtime_settings (key, value, updated_at)
      VALUES (${String(key)}, ${payload}::jsonb, now())
      ON CONFLICT (key) DO NOTHING
      RETURNING value, updated_at
    `;
  } else {
    if (typeof expectedVersion !== "string") throw new TypeError("Versione runtime setting non valida");
    rows = await sql`
      UPDATE lineup_fanta.runtime_settings
      SET value = ${payload}::jsonb,
          updated_at = now()
      WHERE key = ${String(key)} AND xmin::text = ${expectedVersion}
      RETURNING value, updated_at
    `;
  }
  return runtimeSettingRecord(rows[0]);
}

async function updateLeagueSettings(league, settings) {
  await ensureSchema();
  return createNarrowUpdateStore(sqlClient()).updateLeagueSettings(league, settings);
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

async function seedFantasyTeams(league, teams) {
  await ensureSchema();
  return createNarrowUpdateStore(sqlClient()).seedFantasyTeams(league, teams);
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

async function updateTeamIdentity(league, teamKey, profile, logo) {
  await ensureSchema();
  return createNarrowUpdateStore(sqlClient()).updateTeamIdentity(league, teamKey, profile, logo);
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
// Il checkpoint ha una tabella separata dal manifest pubblico e non e' mai
// servibile ai client.

async function readRefreshCheckpoint(league) {
  if (!databaseConfigured()) return null;
  await ensureSchema();
  return (await createRefreshCheckpointStore(sqlClient()).read(league))?.checkpoint || null;
}

async function acquireRefreshCheckpoint(league, owner, leaseMs) {
  await ensureSchema();
  return createRefreshCheckpointStore(sqlClient()).acquire(league, owner, leaseMs);
}

async function writeRefreshCheckpoint(league, payload, owner, fencingToken, leaseMs) {
  await ensureSchema();
  return createRefreshCheckpointStore(sqlClient()).update(league, owner, fencingToken, payload, leaseMs);
}

async function renewRefreshCheckpoint(league, owner, fencingToken, leaseMs) {
  await ensureSchema();
  return createRefreshCheckpointStore(sqlClient()).renew(league, owner, fencingToken, leaseMs);
}

async function clearRefreshCheckpoint(league, owner, fencingToken) {
  await ensureSchema();
  return createRefreshCheckpointStore(sqlClient()).clear(league, owner, fencingToken);
}

async function releaseRefreshCheckpoint(league, owner, fencingToken) {
  await ensureSchema();
  return createRefreshCheckpointStore(sqlClient()).release(league, owner, fencingToken);
}

async function publishManifestAndClearRefreshCheckpoint(league, owner, fencingToken, state) {
  await ensureSchema();
  return createRefreshCheckpointStore(sqlClient()).publish(league, owner, fencingToken, state);
}

async function upsertPlayerOverrideWithRefreshLease(league, owner, fencingToken, playerKey, playerId, playerName = "") {
  await ensureSchema();
  return createRefreshCheckpointStore(sqlClient()).upsertPlayerOverride(
    league,
    owner,
    fencingToken,
    playerKey,
    playerId,
    playerName
  );
}

async function upsertTeamOverridesWithRefreshLease(league, owner, fencingToken, entries) {
  const rows = Array.isArray(entries) ? entries : [];
  if (!rows.length) return true;
  await ensureSchema();
  const store = createRefreshCheckpointStore(sqlClient());
  for (const entry of rows) {
    if (!await store.upsertTeamOverride(league, owner, fencingToken, entry)) return false;
  }
  return true;
}

module.exports = {
  acquireRefreshCheckpoint,
  clearManifestCache,
  clearRefreshCheckpoint,
  createAuthThrottleStore,
  createBsdQuotaStore,
  createNarrowUpdateStore,
  createRefreshCheckpointStore,
  databaseConfigured,
  deleteLogoAccess,
  ensureSchema,
  incrementBsdQuota,
  listTeamLogoMetadata,
  markBsdQuotaRateLimited,
  publishManifestAndClearRefreshCheckpoint,
  readFantasyTeams,
  readBsdQuota,
  readLogoAccessRows,
  readManifestCache,
  readPlayerOverrides,
  readRefreshCheckpoint,
  readRuntimeSetting,
  renewRefreshCheckpoint,
  releaseRefreshCheckpoint,
  readTeamLogo,
  readTeamOverrides,
  seedFantasyTeams,
  sqlClient,
  upsertLogoAccess,
  upsertPlayerOverride,
  upsertPlayerOverrideWithRefreshLease,
  updateLeagueSettings,
  updateTeamIdentity,
  upsertTeamOverrides,
  upsertTeamOverridesWithRefreshLease,
  writeFantasyTeams,
  writeManifestCache,
  writeRefreshCheckpoint,
  writeRuntimeSetting,
  writeTeamLogo
};
