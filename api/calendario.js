const { noStore, methodNotAllowed } = require("../lib/http.cjs");
const { leagueId, readSettings } = require("../lib/settings.cjs");
const { fetchDocHtml, publishedDocUrl } = require("../lib/google-docs-session.cjs");

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

const MOBILE_VIEWER = /android|iphone|ipad|ipod|mobile|tablet|phone/i;

function isMobileViewer(req) {
  return MOBILE_VIEWER.test(String(req.headers?.["user-agent"] || ""));
}

module.exports = async function handler(req, res) {
  // Desktop: i link navigano dentro il frame (sandbox piena).
  // Mobile: i tap escono in una tab vera del browser (app Google Docs se
  // installata). Senza allow-popups la nuova tab resterebbe bloccata, e senza
  // escape erediterebbe la sandbox rompendo Docs: servono entrambi, più
  // <base target="_blank"> per tutte le ancore senza target.
  const mobile = isMobileViewer(req);
  noStore(res);
  res.setHeader("Content-Security-Policy", mobile ? "sandbox allow-popups allow-popups-to-escape-sandbox" : "sandbox");
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const id = leagueId(req.query?.league);
    const settings = await readSettings();
    const pub = publishedDocUrl(settings.leagues?.[id]?.calendarioDocUrl || "");
    if (!pub) return res.status(404).send("Calendario non configurato");

    const html = await fetchDocHtml("calendario", id, pub);
    const rewritten = html.replace(
      /src="https:\/\/docs\.google\.com\/docs-images-rt\/([A-Za-z0-9_=.\-]+)"/g,
      (_, key) => `src="/api/calendario-img?league=${encodeURIComponent(id)}&u=${encodeURIComponent(key)}"`
    );
    const injected = rewritten.includes("</head>")
      ? rewritten.replace("</head>", `${INJECTED}</head>`)
      : `${INJECTED}${rewritten}`;
    const targeted = mobile
      ? (injected.includes("<head>")
        ? injected.replace("<head>", '<head><base target="_blank">')
        : `<base target="_blank">${injected}`)
      : injected;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(targeted);
  } catch {
    return res.status(502).send("Calendario non disponibile");
  }
};
