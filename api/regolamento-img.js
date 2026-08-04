const { methodNotAllowed } = require("../lib/http.cjs");
const { leagueId, readSettings } = require("../lib/settings.cjs");
const { fetchDocAsset } = require("../lib/regolamento-session.cjs");

/* Solo asset di immagini di Google Docs: niente SSRF. */
const ASSET_RE = /^[A-Za-z0-9_=.\-]+$/;

function pubUrl(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl || "")); } catch { return ""; }
  if (url.hostname !== "docs.google.com") return "";
  url.pathname = url.pathname.replace(/\/edit(?:\/.*)?$/i, "/pub");
  if (!url.search) url.search = "?embedded=true";
  return url.toString();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const id = leagueId(req.query?.league);
    const key = String(req.query?.u || "");
    if (!key || !ASSET_RE.test(key)) return res.status(400).end();

    const settings = await readSettings();
    const pub = pubUrl(settings.leagues?.[id]?.regolamentoDocUrl || "");
    if (!pub) return res.status(404).end();

    const asset = await fetchDocAsset(id, `https://docs.google.com/docs-images-rt/${key}`, pub);
    res.setHeader("Content-Type", asset.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=31536000, immutable");
    return res.status(200).send(asset.buffer);
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).send(error.message || "Asset non disponibile");
  }
};
