const { noStore, methodNotAllowed } = require("../lib/http.cjs");
const { leagueId, readSettings } = require("../lib/settings.cjs");
const { fetchDocHtml } = require("../lib/regolamento-session.cjs");

const GOOGLE_HOST = "docs.google.com";

/* Trasforma l'URL configurato in URL pub embeddabile (stessa logica del client). */
function pubUrl(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl || "")); } catch { return ""; }
  if (url.hostname !== GOOGLE_HOST) return "";
  url.pathname = url.pathname.replace(/\/edit(?:\/.*)?$/i, "/pub");
  if (!url.search) url.search = "?embedded=true";
  return url.toString();
}

/* Iniettati nel documento pub: viewport (assente nel pub di Google, senza viewport
   i browser mobile scalano male) e regole mobile-only che comprimono immagini,
   wrapper larghi e tabelle (Google lascia width originali tipo 1427px e padding
   da 72pt che straripano su frame stretti). Il desktop resta invariato. */
const INJECTED = `<meta name="viewport" content="width=device-width, initial-scale=1"><style>
@media (max-width: 560px) {
  .doc-content { padding-left: 16pt !important; padding-right: 16pt !important; }
  .c53 { padding: 24pt 24pt 24pt 24pt !important; }
  span[style*="inline-block"] { max-width: 100% !important; }
  img { max-width: 100% !important; height: auto !important; margin-left: 0 !important; }
  table { max-width: 100% !important; margin-left: 0 !important; }
  body { overflow-x: hidden; }
}
</style>`;

module.exports = async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const id = leagueId(req.query?.league);
    const settings = await readSettings();
    const pub = pubUrl(settings.leagues?.[id]?.regolamentoDocUrl || "");
    if (!pub) return res.status(404).send("Regolamento non configurato");

    const html = await fetchDocHtml(id, pub);
    const rewritten = html.replace(
      /src="https:\/\/docs\.google\.com\/docs-images-rt\/([A-Za-z0-9_=.\-]+)"/g,
      (_, key) => `src="/api/regolamento-img?league=${encodeURIComponent(id)}&u=${encodeURIComponent(key)}"`
    );
    const injected = rewritten.includes("</head>")
      ? rewritten.replace("</head>", `${INJECTED}</head>`)
      : `${INJECTED}${rewritten}`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(injected);
  } catch (error) {
    return res.status(502).send(`Regolamento non disponibile: ${error.message || "errore"}`);
  }
};
