"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const {
  clearManifestCache,
  databaseConfigured,
  ensureSchema,
  readRuntimeSetting,
  seedFantasyTeams,
  upsertLogoAccess,
  upsertPlayerOverride,
  upsertTeamOverrides,
  writeRuntimeSetting,
  writeTeamLogo
} = require("./neon.cjs");
const { normalizeSettings, teamLogoUrl } = require("./settings.cjs");
const { safeFetch } = require("./safe-fetch.cjs");
const { readBuffer, readJson } = require("./storage.cjs");


async function readRepositoryJson(relativePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), relativePath), "utf8"));
  } catch {
    return structuredClone(fallback);
  }
}

function mimeFromPath(value) {
  const pathname = String(value || "").toLowerCase().split("?")[0];
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

function isRejectedLogoError(error) {
  const message = String(error?.message || "");
  const status = message.match(/^HTTP (\d{3})$/)?.[1];
  if (status) return Number(status) >= 400 && Number(status) < 500 && ![408, 425, 429].includes(Number(status));
  return /URL non valido|Solo URL HTTPS|credenziali non consentito|Hostname locale|Indirizzo IP non pubblico|DNS senza indirizzi pubblici|MIME Content-Type non consentito|Corpo oltre il limite di byte|Troppi redirect HTTPS/.test(message);
}

const defaultDependencies = {
  clearManifestCache,
  databaseConfigured,
  ensureSchema,
  normalizeSettings,
  readBuffer,
  readJson,
  readRepositoryJson,
  readRuntimeSetting,
  safeFetch,
  seedFantasyTeams,
  teamLogoUrl,
  upsertLogoAccess,
  upsertPlayerOverride,
  upsertTeamOverrides,
  writeRuntimeSetting,
  writeTeamLogo,
  now: () => new Date().toISOString()
};

function createMigration(dependencies = {}) {
  const deps = { ...defaultDependencies, ...dependencies };

  async function readLegacyImage(reference) {
    const value = String(reference || "").trim();
    if (!value) return null;
    if (value.startsWith("/.lineup-runtime/")) {
      const bytes = await deps.readBuffer(value.slice("/.lineup-runtime/".length));
      return bytes?.length ? { bytes, mimeType: mimeFromPath(value) } : null;
    }
    if (!/^https?:\/\//i.test(value)) return null;
    const response = await deps.safeFetch(value, {
      timeoutMs: 15000,
      maxBytes: 512 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      headers: { Accept: "image/png,image/jpeg,image/webp" }
    });
    const bytes = response.body;
    return bytes.length ? { bytes, mimeType: response.mimeType } : null;
  }

  async function migrateSettings() {
    const repository = deps.normalizeSettings(await deps.readRepositoryJson("data/settings.json", {}));
    const legacy = await deps.readJson("settings.json", null);
    const settings = deps.normalizeSettings(legacy || repository, repository);
    settings.updatedAt = deps.now();
    await deps.writeRuntimeSetting("settings", settings);
    return Boolean(legacy);
  }

  async function migrateLeague(league) {
    const warnings = [];
    const fallbackTeams = await deps.readRepositoryJson(`data/${league}/teams.json`, { version: 1, teams: {} });
    const legacyTeams = await deps.readJson(`teams/${league}.json`, null);
    const teams = structuredClone(legacyTeams?.teams || fallbackTeams?.teams || {});
    const legacyAccess = await deps.readJson(`logo-access/${league}.json`, null);
    let logoCodes = 0;
    let logos = 0;

    for (const [teamName, entry] of Object.entries(legacyAccess?.teams || {})) {
      if (!entry?.codeHash) continue;
      await deps.upsertLogoAccess(league, teamName, entry.codeHash);
      logoCodes += 1;
    }

    for (const [teamName, profile] of Object.entries(teams)) {
      const logoUrl = String(profile?.logoUrl || "").trim();
      if (!logoUrl) continue;
      teams[teamName] = { ...(profile || {}), logoUrl: "" };
      let image;
      try {
        image = await readLegacyImage(logoUrl);
      } catch (error) {
        if (!isRejectedLogoError(error)) throw error;
        warnings.push(`${league.toUpperCase()} · ${teamName}: ${error.message || "migrazione stemma fallita"}`);
        continue;
      }
      if (!image) {
        warnings.push(`${league.toUpperCase()} · ${teamName}: stemma legacy non leggibile`);
        continue;
      }
      if (image.bytes.length > 512 * 1024) {
        warnings.push(`${league.toUpperCase()} · ${teamName}: stemma oltre 512 KB`);
        continue;
      }
      const sha256 = crypto.createHash("sha256").update(image.bytes).digest("hex");
      await deps.writeTeamLogo(league, teamName, image.mimeType, image.bytes, sha256);
      teams[teamName] = { ...(profile || {}), logoUrl: deps.teamLogoUrl(league, teamName, sha256) };
      logos += 1;
    }

    await deps.seedFantasyTeams(league, teams);

    let playerOverrides = 0;
    const legacyManifest = await deps.readJson(`media/${league}.json`, null);
    for (const [key, entry] of Object.entries(legacyManifest?.players || {})) {
      const id = String(entry?.externalId || "").trim();
      if (!/^\d+$/.test(id) || entry?.provider !== "bsd") continue;
      if (!String(entry?.matchedBy || "").includes("manual")) continue;
      await deps.upsertPlayerOverride(league, key, id, entry.externalName || entry.listoneName || "");
      playerOverrides += 1;
    }

    const teamRows = [];
    const legacyCatalog = await deps.readJson(`media/bsd/catalog-${league}.json`, null);
    for (const [teamKey, team] of Object.entries(legacyCatalog?.teams || {})) {
      const id = String(team?.id || "").trim();
      if (!/^\d+$/.test(id)) continue;
      teamRows.push({ teamKey, id, name: team.name || team.listoneName || teamKey });
    }
    await deps.upsertTeamOverrides(league, teamRows);

    return {
      league,
      success: true,
      teams: Object.keys(teams).length,
      logoCodes,
      logos,
      playerOverrides,
      teamOverrides: teamRows.length,
      warnings
    };
  }

  async function migrateLegacyRuntimeToNeon() {
    if (!deps.databaseConfigured()) throw new Error("DATABASE_URL non configurata");
    await deps.ensureSchema();
    const markerKey = "migration:blob-to-neon:v1";
    const previous = await deps.readRuntimeSetting(markerKey);
    if (previous?.value?.complete) {
      return {
        alreadyMigrated: true,
        migratedAt: previous.value.migratedAt || previous.updatedAt,
        settingsFromBlob: Boolean(previous.value.settingsFromBlob),
        leagues: previous.value.leagues || [],
        warnings: []
      };
    }
    const warnings = [];
    const settingsFromBlob = await migrateSettings();
    const leagues = [];
    for (const league of ["fp", "pd"]) {
      try {
        const migrated = await migrateLeague(league);
        await deps.clearManifestCache(league);
        leagues.push(migrated);
      } catch {
        leagues.push({ league, success: false, error: `Migrazione ${league.toUpperCase()} non riuscita`, warnings: [] });
      }
    }
    const result = {
      alreadyMigrated: false,
      migratedAt: deps.now(),
      settingsFromBlob,
      leagues,
      warnings: [...warnings, ...leagues.flatMap((item) => item.warnings)]
    };
    if (leagues.every((item) => item.success)) {
      await deps.writeRuntimeSetting(markerKey, {
        complete: true,
        migratedAt: result.migratedAt,
        settingsFromBlob,
        leagues
      });
    }
    return result;
  }

  return { migrateLegacyRuntimeToNeon, readLegacyImage };
}

const migration = createMigration();

module.exports = {
  createMigration,
  migrateLegacyRuntimeToNeon: migration.migrateLegacyRuntimeToNeon,
  readLegacyImage: migration.readLegacyImage
};
