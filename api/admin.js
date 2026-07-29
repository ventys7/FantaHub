const { isAuthenticated, passwordHash, setLogin, setLogout, verifyPassword } = require("../lib/admin-auth.cjs");
const { methodNotAllowed, noStore, readBody } = require("../lib/http.cjs");
const { loadLeagueAssets, teamNamesFromAssets } = require("../lib/listone.cjs");
const { resetCode } = require("../lib/logo-access.cjs");
const { migrateLegacyRuntimeToNeon } = require("../lib/migrate-neon.cjs");
const { leagueId, readSettings, readTeamProfiles, saveLeagueSettings } = require("../lib/settings.cjs");

async function adminState(rawLeagueId) {
  const id = leagueId(rawLeagueId);
  const settings = await readSettings();
  const profiles = await readTeamProfiles(id);
  let names = Object.keys(profiles.teams || {});
  try { names = [...new Set([...names, ...teamNamesFromAssets((await loadLeagueAssets(id)).assets)])]; } catch {}
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
  const body = readBody(req);
  const action = String(body.action || "");
  const id = leagueId(body.leagueId);

  try {
    if (action === "login") {
      if (!(await verifyPassword(body.password, hash))) return res.status(401).json({ error: "Password errata" });
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
    if (action === "migrate-neon") {
      const migration = await migrateLegacyRuntimeToNeon();
      return res.status(200).json({ migration, authenticated: true, ...(await adminState(id)) });
    }

    return res.status(400).json({ error: "Azione non riconosciuta" });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Operazione non riuscita" });
  }
};
