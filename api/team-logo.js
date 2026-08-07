const crypto = require("node:crypto");
const { noStore, methodNotAllowed, readBody } = require("../lib/http.cjs");
const { checkCode } = require("../lib/logo-access.cjs");
const { loadLeagueAssets, teamNamesFromAssets } = require("../lib/listone.cjs");
const { databaseConfigured, readTeamLogo, writeTeamLogo } = require("../lib/neon.cjs");
const { leagueId, readTeamProfiles, saveTeamProfiles, teamLogoUrl } = require("../lib/settings.cjs");

const MAX_BYTES = 512 * 1024;

function decodeUpload(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Immagine non valida");
  const mimeType = String(raw.mimeType || "");
  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) throw new Error("Formato non supportato");
  const data = String(raw.dataBase64 || "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error("Immagine non valida");
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("Immagine troppo pesante: massimo 512 KB");
  return { bytes, mimeType };
}

async function knownTeamNames(id, profiles) {
  try {
    return [...new Set(teamNamesFromAssets((await loadLeagueAssets(id)).assets))];
  } catch {
    return Object.keys(profiles.teams || {});
  }
}

async function handleGet(req, res) {
  const id = leagueId(req.query?.league);
  const teamName = String(req.query?.team || "").trim();
  if (!teamName) return res.status(400).json({ error: "Fantasquadra non valida" });
  if (!databaseConfigured()) return res.status(404).end();

  const logo = await readTeamLogo(id, teamName);
  if (!logo?.bytes?.length) return res.status(404).end();
  const etag = `"${logo.sha256}"`;
  if (String(req.headers["if-none-match"] || "") === etag) return res.status(304).end();
  res.setHeader("Content-Type", logo.mimeType);
  res.setHeader("Content-Length", String(logo.bytes.length));
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=31536000, immutable");
  return res.status(200).send(logo.bytes);
}

async function handlePost(req, res) {
  noStore(res);
  const body = readBody(req);
  const id = leagueId(body.leagueId);
  const teamName = String(body.teamName || "").trim();
  const profiles = await readTeamProfiles(id);
  const names = await knownTeamNames(id, profiles);
  if (!names.includes(teamName)) throw new Error("Fantasquadra non riconosciuta");
  if (!(await checkCode(id, teamName, body.code))) return res.status(401).json({ error: "Codice stemma errato" });
  const upload = decodeUpload(body.upload);
  const sha256 = crypto.createHash("sha256").update(upload.bytes).digest("hex");

  if (!databaseConfigured()) {
    throw new Error("DATABASE_URL non configurata: caricamento stemma bloccato");
  }
  await writeTeamLogo(id, teamName, upload.mimeType, upload.bytes, sha256);
  const logoUrl = teamLogoUrl(id, teamName, sha256);

  profiles.teams[teamName] = { ...(profiles.teams[teamName] || {}), logoUrl };
  await saveTeamProfiles(id, profiles);
  return res.status(200).json({ message: "Stemma aggiornato.", logoUrl });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Operazione stemma non riuscita" });
  }
};
