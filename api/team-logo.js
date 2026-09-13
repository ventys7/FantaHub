const crypto = require("node:crypto");
const { noStore, methodNotAllowed, readBody } = require("../lib/http.cjs");
const { checkCode } = require("../lib/logo-access.cjs");
const { loadLeagueAssets, teamNamesFromAssets } = require("../lib/listone.cjs");
const { databaseConfigured, readTeamLogo, updateTeamIdentity } = require("../lib/neon.cjs");
const { leagueId, readTeamProfiles, saveTeamProfiles, teamLogoUrl } = require("../lib/settings.cjs");

const MAX_BYTES = 512 * 1024;

function decodeUpload(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Immagine non valida");
  const mimeType = String(raw.mimeType || "");
  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) throw new Error("Formato non supportato");
  const data = String(raw.dataBase64 || "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 !== 0) throw new Error("Immagine non valida");
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("Immagine troppo pesante: massimo 512 KB");
  if (bytes.toString("base64") !== data) throw new Error("Immagine non valida");
  const validSignature = mimeType === "image/png"
    ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
    : mimeType === "image/jpeg"
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" && bytes.readUInt32LE(4) + 8 === bytes.length;
  if (!validSignature) throw new Error("Immagine non valida");
  return { bytes, mimeType };
}

async function knownTeamNames(id, profiles) {
  try {
    return [...new Set(teamNamesFromAssets((await loadLeagueAssets(id)).assets))];
  } catch {
    return Object.keys(profiles.teams || {});
  }
}

const MAX_DISPLAY_NAME = 24;

function normName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

// Nome fantasquadra: "" = nessun alias (mostra il partecipante).
// undefined = campo assente, conserva il valore esistente.
function resolveDisplayName(profiles, teamName, raw) {
  if (raw === undefined) return undefined;
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.length > MAX_DISPLAY_NAME) throw new Error("Nome fantasquadra troppo lungo: massimo 24 caratteri");
  const norm = normName(value);
  if (norm === normName(teamName)) return "";
  for (const [other, profile] of Object.entries(profiles.teams || {})) {
    if (other === teamName) continue;
    const otherDisplay = String(profile?.displayName || "").trim();
    if (otherDisplay && normName(otherDisplay) === norm) throw new Error("Nome fantasquadra già utilizzato");
    if (normName(other) === norm) throw new Error("Nome fantasquadra già utilizzato");
  }
  return value;
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
  const access = await checkCode(id, teamName, body.code, req);
  if (access.throttled) {
    res.setHeader("Retry-After", String(access.retryAfter));
    return res.status(429).json({ error: "Troppi tentativi. Riprova più tardi." });
  }
  if (!access.verified) return res.status(401).json({ error: "Codice stemma errato" });
  const displayName = resolveDisplayName(profiles, teamName, body.displayName);
  const hasUpload = body.upload !== undefined && body.upload !== null;
  let logoUrl = profiles.teams[teamName]?.logoUrl || "";
  let logo;
  if (hasUpload) {
    const upload = decodeUpload(body.upload);
    const sha256 = crypto.createHash("sha256").update(upload.bytes).digest("hex");

    if (!databaseConfigured()) {
      throw new Error("DATABASE_URL non configurata: caricamento stemma bloccato");
    }
    logo = { ...upload, sha256 };
    logoUrl = teamLogoUrl(id, teamName, sha256);
  }

  const profile = { ...(profiles.teams[teamName] || {}), logoUrl };
  if (displayName !== undefined) profile.displayName = displayName;
  if (databaseConfigured()) {
    await updateTeamIdentity(id, teamName, profile, logo);
  } else {
    profiles.teams[teamName] = profile;
    await saveTeamProfiles(id, profiles);
  }
  const savedName = profile.displayName || "";
  const message = hasUpload && displayName !== undefined
    ? "Stemma e nome aggiornati."
    : hasUpload ? "Stemma aggiornato." : "Nome fantasquadra aggiornato.";
  return res.status(200).json({ message, logoUrl, displayName: savedName });
}

async function handler(req, res) {
  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    if (error?.code === "23505" && error?.constraint === "fantasy_teams_display_name_unique") {
      return res.status(400).json({ error: "Nome fantasquadra già utilizzato" });
    }
    if (error?.statusCode === 503) return res.status(503).json({ error: "Servizio temporaneamente non disponibile" });
    return res.status(400).json({ error: error.message || "Operazione stemma non riuscita" });
  }
}

handler.decodeUpload = decodeUpload;
module.exports = handler;
