#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(process.argv[2] || process.cwd());
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";

const apiHandlers = new Map();
for (const route of ["settings", "admin", "team-logo", "discipline", "player-media", "regolamento", "regolamento-img", "crest"]) {
  const pathname = `/api/${route}`;
  try { apiHandlers.set(pathname, require(path.join(root, "api", `${route}.js`))); }
  catch (error) { console.warn(`API locale non caricata (${pathname}):`, error.message); }
}

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".csv", "text/csv; charset=utf-8"],
  [".svg", "image/svg+xml"], [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".webp", "image/webp"], [".ico", "image/x-icon"]
]);

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache"); res.setHeader("Expires", "0");
}

function createApiResponse(res) {
  noStore(res);
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(payload)); return res; };
  res.send = (payload) => { if (Buffer.isBuffer(payload) || typeof payload === "string") res.end(payload); else res.json(payload); return res; };
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return undefined;
  const text = Buffer.concat(chunks).toString("utf8");
  if (String(req.headers["content-type"] || "").includes("application/json")) {
    try { return JSON.parse(text); } catch { return text; }
  }
  return text;
}

async function handleApi(req, res, url) {
  const handler = apiHandlers.get(url.pathname);
  if (!handler) return false;
  req.query = Object.fromEntries(url.searchParams.entries());
  req.body = req.method !== "GET" ? await readBody(req) : undefined;
  try { await handler(req, createApiResponse(res)); }
  catch (error) {
    console.error(`Errore API locale ${url.pathname}:`, error);
    if (!res.writableEnded) { res.statusCode = 500; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify({ error: "Errore interno API locale" })); }
  }
  return true;
}

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded.startsWith("/.lineup-runtime/")) {
    const relative = decoded.slice("/.lineup-runtime/".length);
    const absolute = path.resolve(root, ".lineup-runtime", relative);
    const runtimeRoot = path.resolve(root, ".lineup-runtime");
    return absolute.startsWith(runtimeRoot + path.sep) ? absolute : null;
  }
  const normalized = path.normalize(decoded).replace(/^([.][.][/\\])+/, "");
  const relative = normalized.replace(/^[/\\]+/, "");
  const absolute = path.resolve(root, relative);
  return absolute.startsWith(root + path.sep) || absolute === root ? absolute : null;
}

async function resolveStaticPath(pathname) {
  const requested = safeFilePath(pathname);
  if (!requested) return null;
  const candidates = pathname.endsWith("/") ? [path.join(requested, "index.html")] : [requested, path.join(requested, "index.html")];
  for (const candidate of candidates) {
    try { if ((await fs.stat(candidate)).isFile()) return candidate; } catch {}
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (await handleApi(req, res, url)) return;
  const filePath = await resolveStaticPath(url.pathname);
  if (!filePath) { noStore(res); res.statusCode = 404; res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.end("404 - File non trovato"); return; }
  try {
    const body = await fs.readFile(filePath);
    if (url.pathname.startsWith("/.lineup-runtime/player-images/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else noStore(res);
    res.statusCode = 200;
    res.setHeader("Content-Type", mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream"); res.end(body);
  } catch (error) { console.error("Errore file statico:", error); res.statusCode = 500; res.end("Errore interno"); }
});

server.listen(port, host, () => {
  console.log(`✓ FantaHub live: http://localhost:${port}`);
  console.log(`✓ Admin FP: http://localhost:${port}/fp/admin-links/`);
  console.log(`✓ Admin PD: http://localhost:${port}/pd/admin-links/`);
  if (process.env.ADMIN_LINKS_PASSWORD_HASH) console.log("✓ API admin, loghi, disciplina e media attive");
  console.log("✓ Cache disabilitata durante lo sviluppo");
});
