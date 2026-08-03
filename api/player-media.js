const { isAuthenticated } = require("../lib/admin-auth.cjs");
const { methodNotAllowed, readBody } = require("../lib/http.cjs");
const { leagueId } = require("../lib/settings.cjs");
const {
  directLinkManual,
  directLinkTeam,
  directMediaStatus,
  publicManifest,
  directReadManifest,
  refreshDirectManifest,
  directSearchProvider,
  directSearchProviderTeams
} = require("../lib/player-media.cjs");

function publicCache(res) {
  // Manual Neon overrides must be visible immediately on every public page.
  // The manifest itself is already cached in Neon/server memory, so CDN caching only creates stale UI.
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
}

function privateNoStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const authenticated = isAuthenticated(req);
      const fresh = String(req.query?.fresh || "") === "1" && authenticated;
      const id = leagueId(req.query?.league);
      if (fresh) {
        privateNoStore(res);
        return res.status(200).json(await directMediaStatus(id, { fresh: true }));
      }
      publicCache(res);
      return res.status(200).json(publicManifest(await directReadManifest(id)));
    }

    if (req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
    privateNoStore(res);
    if (!isAuthenticated(req)) return res.status(401).json({ error: "Accesso admin richiesto" });

    const body = readBody(req);
    const id = leagueId(body.leagueId);

    if (["refresh", "sync-missing", "full-sync", "continue-sync", "continue-full-sync"].includes(body.action)) {
      return res.status(200).json(publicManifest(await refreshDirectManifest(id)));
    }
    if (body.action === "search") {
      return res.status(200).json(await directSearchProvider(id, body.query, body.teamName, {
        includeDatabase: Boolean(body.includeDatabase)
      }));
    }
    if (body.action === "search-team") {
      return res.status(200).json({ candidates: await directSearchProviderTeams(id, body.teamName) });
    }
    if (["link", "link-id"].includes(body.action)) {
      const entry = await directLinkManual(id, body.key, body.candidate || {
        id: body.externalId,
        name: body.externalName,
        teamName: body.teamName
      });
      return res.status(200).json({ entry });
    }
    if (body.action === "link-team") {
      const linked = await directLinkTeam(id, body.teamName, body.externalId, body.externalName);
      return res.status(200).json(linked);
    }
    return res.status(400).json({ error: "Azione non riconosciuta" });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Media non disponibili" });
  }
};
