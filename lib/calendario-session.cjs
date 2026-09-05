/* Sessione Google Docs pub per il calendario: jar separato da quello del
   regolamento (stesso formato). Le sessioni Google sono chiavate per lega e
   ogni documento ha una propria sessione: con due doc per lega, condividere
   il jar del regolamento mescolerebbe i cookie dei due documenti. */
"use strict";

const SESSION_TTL_MS = 30 * 60 * 1000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const sessions = new Map(); // leagueId -> { cookie: string, refreshedAt: number }

function parseSetCookie(setCookie) {
  const pair = String(setCookie || "").split(";")[0].trim();
  return pair.includes("=") ? pair : null;
}

async function fetchWithSession(leagueId, url) {
  const headers = { "user-agent": UA, accept: "*/*" };
  const cookie = sessions.get(leagueId)?.cookie;
  if (cookie) headers.cookie = cookie;
  const response = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  const setCookie = response.headers.getSetCookie?.();
  if (setCookie?.length) {
    const pairs = setCookie.map(parseSetCookie).filter(Boolean).join("; ");
    if (pairs) sessions.set(leagueId, { cookie: pairs, refreshedAt: Date.now() });
  }
  return response;
}

/** Scarica l'HTML pub del documento della lega. */
async function fetchDocHtml(leagueId, pubUrl) {
  const response = await fetchWithSession(leagueId, pubUrl);
  if (!response.ok) throw new Error(`Google Docs non raggiungibile (${response.status})`);
  return response.text();
}

/** Scarica un asset docs-images-rt; su cookie scaduti rinfresca la sessione dal documento e riprova. */
async function fetchDocAsset(leagueId, assetUrl, pubUrl) {
  let response = await fetchWithSession(leagueId, assetUrl);
  const stale = response.status === 400 || response.status === 401;
  if (stale && pubUrl) {
    await fetchWithSession(leagueId, pubUrl); // rinfresca i cookie
    response = await fetchWithSession(leagueId, assetUrl);
  }
  if (!response.ok) throw new Error(`Asset non disponibile (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType: response.headers.get("content-type") || "image/jpeg" };
}

module.exports = { fetchDocHtml, fetchDocAsset, SESSION_TTL_MS };
