const {
  consumeAuthAttempt,
  isAuthenticated,
  passwordHash,
  resetAuthAttempts,
  setLogin,
  setLogout,
  verifyPassword
} = require("../lib/admin-auth.cjs");
const { methodNotAllowed, noStore, readBody } = require("../lib/http.cjs");
const { loadLeagueAssets, teamNamesFromAssets } = require("../lib/listone.cjs");
const { resetCode, pruneStaleLogoCodes } = require("../lib/logo-access.cjs");
const { migrateLegacyRuntimeToNeon } = require("../lib/migrate-neon.cjs");
const { leagueId, readSettings, readTeamProfiles, saveLeagueSettings } = require("../lib/settings.cjs");

async function adminState(rawLeagueId) {
  const id = leagueId(rawLeagueId);
  const settings = await readSettings();
  const profiles = await readTeamProfiles(id);
  let names;
  try {
    names = [...new Set(teamNamesFromAssets((await loadLeagueAssets(id)).assets))];
    try { await pruneStaleLogoCodes(id, names); } catch {}
  } catch {
    names = Object.keys(profiles.teams || {});
  }
  return {
    leagueId: id,
    settings: settings.leagues[id],
    teams: names.sort((a, b) => a.localeCompare(b, "it")),
    profiles: profiles.teams
  };
}

module.exports = async function handler(req, res) {
  noStore(res);
  const hash = passwordHash();
  if (!hash) return res.status(503).json({ error: "ADMIN_LINKS_PASSWORD_HASH non configurato" });

  if (req.method === "GET") {
    try {
      const id = leagueId(req.query?.league);
      const authenticated = isAuthenticated(req);
      if (!authenticated) return res.status(200).json({ authenticated: false, leagueId: id });
      return res.status(200).json({ authenticated: true, ...(await adminState(id)) });
    } catch (error) {
      return res.status(400).json({ error: error.message || "Operazione admin non riuscita" });
    }
  }

  if (req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);

  try {
    const body = readBody(req);
    const action = String(body.action || "");
    const id = leagueId(body.leagueId);
    if (action === "login") {
      const throttle = { purpose: "admin", league: id, req };
      const attempt = await consumeAuthAttempt(throttle);
      if (!attempt.allowed) {
        res.setHeader("Retry-After", String(attempt.retryAfter));
        return res.status(429).json({ error: "Troppi tentativi. Riprova più tardi." });
      }
      if (!(await verifyPassword(body.password, hash))) return res.status(401).json({ error: "Password errata" });
      await resetAuthAttempts(throttle);
      setLogin(req, res);
      return res.status(200).json({ authenticated: true, ...(await adminState(id)) });
    }
    if (action === "logout") {
      setLogout(req, res);
      return res.status(200).json({ authenticated: false, leagueId: id });
    }
    if (!isAuthenticated(req)) return res.status(401).json({ error: "Sessione admin scaduta" });

    if (action === "save-settings") {
      await saveLeagueSettings(id, body.settings);
      return res.status(200).json({ message: "Collegamenti aggiornati.", authenticated: true, ...(await adminState(id)) });
    }
    if (action === "reset-logo-code") {
      const code = await resetCode(id, body.teamName);
      return res.status(200).json({ code, teamName: body.teamName, leagueId: id });
    }
    if (action === "prune-logo-codes") {
      let names = Array.isArray(body.currentTeamNames) ? body.currentTeamNames : null;
      if (!names) {
        try { names = [...new Set(teamNamesFromAssets((await loadLeagueAssets(id)).assets))]; } catch {}
      }
      const removedCount = await pruneStaleLogoCodes(id, names || []);
      return res.status(200).json({ removedCount, leagueId: id, authenticated: true, ...(await adminState(id)) });
    }
    if (action === "migrate-neon") {
      const migration = await migrateLegacyRuntimeToNeon();
      return res.status(200).json({ migration, authenticated: true, ...(await adminState(id)) });
    }

    return res.status(400).json({ error: "Azione non riconosciuta" });
  } catch (error) {
    if (error?.statusCode === 503) return res.status(503).json({ error: "Servizio temporaneamente non disponibile" });
    return res.status(400).json({ error: error.message || "Operazione non riuscita" });
  }
};

module.exports.adminState = adminState;
