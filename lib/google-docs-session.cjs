"use strict";

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_REDIRECTS = 5;
const HTML_LIMIT = 2 * 1024 * 1024;
const IMAGE_LIMIT = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const sessions = new Map();

function googleUrl(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl || "")); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.port || url.username || url.password) return null;
  return url;
}

function publishedDocUrl(rawUrl) {
  const url = googleUrl(rawUrl);
  if (!url || !/^\/document\/d\/(?:e\/)?[A-Za-z0-9_-]+\/(?:edit|pub)(?:\/.*)?$/i.test(url.pathname)) return "";
  url.pathname = url.pathname.replace(/\/edit(?:\/.*)?$/i, "/pub");
  if (!url.search) url.search = "?embedded=true";
  url.hash = "";
  return url.toString();
}

function assetUrl(rawUrl) {
  const url = googleUrl(rawUrl);
  return url && /^\/docs-images-rt\/[A-Za-z0-9_=.\-]+$/.test(url.pathname) ? url.toString() : "";
}

function parseSetCookie(setCookie) {
  const pair = String(setCookie || "").split(";")[0].trim();
  return pair.includes("=") ? pair : null;
}

function sessionKey(kind, leagueId) {
  return `${kind}:${leagueId}`;
}

async function fetchWithSession(kind, leagueId, rawUrl, accept) {
  const key = sessionKey(kind, leagueId);
  const session = sessions.get(key);
  if (session && Date.now() - session.refreshedAt > SESSION_TTL_MS) sessions.delete(key);
  let url = googleUrl(rawUrl);
  if (!url) throw new Error("Google Docs response rejected");

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const headers = { "user-agent": UA, accept };
    const cookie = sessions.get(key)?.cookie;
    if (cookie) headers.cookie = cookie;
    const response = await fetch(url, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    const setCookie = response.headers.getSetCookie?.() || [response.headers.get("set-cookie")];
    const pairs = setCookie.map(parseSetCookie).filter(Boolean).join("; ");
    if (pairs) sessions.set(key, { cookie: pairs, refreshedAt: Date.now() });

    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirects === MAX_REDIRECTS) throw new Error("Google Docs response rejected");
    url = googleUrl(new URL(location, url));
    if (!url) throw new Error("Google Docs response rejected");
  }

  throw new Error("Google Docs response rejected");
}

async function readLimited(response, limit) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error("Google Docs response rejected");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

function contentType(response) {
  return String(response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
}

async function fetchDocHtml(kind, leagueId, rawUrl) {
  const url = publishedDocUrl(rawUrl);
  if (!url) throw new Error("Google Docs response rejected");
  const response = await fetchWithSession(kind, leagueId, url, "text/html");
  if (!response.ok || contentType(response) !== "text/html") throw new Error("Google Docs response rejected");
  return (await readLimited(response, HTML_LIMIT)).toString("utf8");
}

async function fetchDocAsset(kind, leagueId, rawAssetUrl, rawPubUrl) {
  const url = assetUrl(rawAssetUrl);
  if (!url) throw new Error("Google Docs response rejected");
  let response = await fetchWithSession(kind, leagueId, url, "image/*");
  if ((response.status === 400 || response.status === 401) && rawPubUrl) {
    await fetchDocHtml(kind, leagueId, rawPubUrl);
    response = await fetchWithSession(kind, leagueId, url, "image/*");
  }
  const type = contentType(response);
  if (!response.ok || !IMAGE_TYPES.has(type)) throw new Error("Google Docs response rejected");
  return { buffer: await readLimited(response, IMAGE_LIMIT), contentType: type };
}

module.exports = { fetchDocHtml, fetchDocAsset, publishedDocUrl };
