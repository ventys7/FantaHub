const { loadDiscipline } = require("../lib/discipline.cjs");
const { methodNotAllowed } = require("../lib/http.cjs");
const { leagueId, readSettings } = require("../lib/settings.cjs");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const id = leagueId(req.query?.league);
    const settings = await readSettings();
    const sourceUrl = settings.leagues[id].disciplineDocUrl;
    const data = await loadDiscipline(sourceUrl);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json({ leagueId: id, ...data, configured: Boolean(sourceUrl) });
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: error.message || "Richiami e penalizzazioni non disponibili" });
  }
};
