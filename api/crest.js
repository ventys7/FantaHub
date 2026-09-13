const { methodNotAllowed } = require("../lib/http.cjs");

const SOURCE = "https://kick-off-tau.vercel.app";
const MAX_BYTES = 2 * 1024 * 1024;

async function readLimitedBody(response) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("Immagine kick-off troppo pesante");
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("Immagine kick-off non valida");
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error("Immagine kick-off troppo pesante");
    }
    chunks.push(chunk);
  }
  if (!total) throw new Error("Immagine kick-off non valida");
  return Buffer.concat(chunks, total);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const id = String(req.query?.id || "").trim();
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "ID squadra non valido" });

  try {
    const response = await fetch(`${SOURCE}/api/crest/${id}`, {
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5" },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return res.status(response.status === 404 ? 404 : 502).end();
    const mimeType = String(response.headers.get("content-type") || "").split(";")[0].trim();
    if (!["image/png", "image/jpeg", "image/webp", "image/avif"].includes(mimeType)) {
      return res.status(502).json({ error: "kick-off ha restituito un formato immagine non valido" });
    }
    const bytes = await readLimitedBody(response);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=31536000");
    return res.status(200).send(bytes);
  } catch (error) {
    return res.status(502).json({ error: error?.name === "TimeoutError" ? "Timeout immagine kick-off" : "Immagine kick-off non disponibile" });
  }
};
