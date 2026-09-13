#!/usr/bin/env node
import fs from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export const DEFAULT_HOST = "127.0.0.1";
export const API_ROUTES = Object.freeze([
  "settings",
  "admin",
  "team-logo",
  "discipline",
  "player-media",
  "player-photo",
  "regolamento",
  "regolamento-img",
  "calendario",
  "calendario-img",
  "crest"
]);

const PUBLIC_DIRECTORIES = new Set(["assets", "css", "fp", "js", "pd"]);

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

async function handleApi(req, res, url, apiHandlers, logger) {
  const handler = apiHandlers.get(url.pathname);
  if (!handler) return false;
  req.query = Object.fromEntries(url.searchParams.entries());
  req.body = req.method !== "GET" ? await readBody(req) : undefined;
  try { await handler(req, createApiResponse(res)); }
  catch (error) {
    logger.error(`Errore API locale ${url.pathname}:`, error);
    if (!res.writableEnded) { res.statusCode = 500; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify({ error: "Errore interno API locale" })); }
  }
  return true;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function safeFilePath(pathname, serverRoot = process.cwd()) {
  let decoded;
  try { decoded = decodeURIComponent(String(pathname || "")); }
  catch { return null; }
  if (!decoded.startsWith("/") || decoded.includes("\0")) return null;

  const segments = decoded.replaceAll("\\", "/").split("/").filter(Boolean);
  const isPlayerImage = segments[0] === ".lineup-runtime" && segments[1] === "player-images" && segments.length > 2;
  const checkedSegments = isPlayerImage ? segments.slice(2) : segments;
  if (checkedSegments.some((segment) => segment === "." || segment === ".." || segment.startsWith("."))) return null;

  const relative = decoded === "/" ? "index.html" : segments.join("/");
  const isPublic = relative === "index.html"
    || PUBLIC_DIRECTORIES.has(segments[0])
    || (segments[0] === "data" && ["fp", "pd"].includes(segments[1]));
  if (!isPlayerImage && !isPublic) return null;

  const root = path.resolve(serverRoot);
  const absolute = path.resolve(root, relative);
  return isInside(root, absolute) ? absolute : null;
}

export async function resolveStaticPath(pathname, serverRoot = process.cwd()) {
  const root = path.resolve(serverRoot);
  const requested = safeFilePath(pathname, root);
  if (!requested) return null;
  const candidates = pathname === "/"
    ? [requested]
    : pathname.endsWith("/")
      ? [path.join(requested, "index.html")]
      : [requested, path.join(requested, "index.html")];
  let realRoot;
  try { realRoot = await fs.realpath(root); }
  catch { return null; }
  for (const candidate of candidates) {
    try {
      const realCandidate = await fs.realpath(candidate);
      if (isInside(realRoot, realCandidate) && (await fs.stat(realCandidate)).isFile()) return realCandidate;
    } catch {}
  }
  return null;
}

function loadApiHandlers(root, logger) {
  const handlers = new Map();
  for (const route of API_ROUTES) {
    const pathname = `/api/${route}`;
    try { handlers.set(pathname, require(path.join(root, "api", `${route}.js`))); }
    catch (error) { logger.warn(`API locale non caricata (${pathname}):`, error.message); }
  }
  return handlers;
}

export function createDevServer({ root: rootOption = process.cwd(), logger = console } = {}) {
  const root = path.resolve(rootOption);
  const apiHandlers = loadApiHandlers(root, logger);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (await handleApi(req, res, url, apiHandlers, logger)) return;
    const filePath = await resolveStaticPath(url.pathname, root);
    if (!filePath) { noStore(res); res.statusCode = 404; res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.end("404 - File non trovato"); return; }
    try {
      const body = await fs.readFile(filePath);
      if (url.pathname.startsWith("/.lineup-runtime/player-images/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else noStore(res);
      res.statusCode = 200;
      res.setHeader("Content-Type", mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream"); res.end(body);
    } catch (error) { logger.error("Errore file statico:", error); res.statusCode = 500; res.end("Errore interno"); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || process.cwd());
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || DEFAULT_HOST;
  const server = createDevServer({ root });
  server.listen(port, host, () => {
    console.log(`✓ FantaHub live: http://${host}:${port}`);
    console.log(`✓ Admin FP: http://${host}:${port}/fp/admin-links/`);
    console.log(`✓ Admin PD: http://${host}:${port}/pd/admin-links/`);
    if (process.env.ADMIN_LINKS_PASSWORD_HASH) console.log("✓ API admin, loghi, disciplina e media attive");
    console.log("✓ Cache disabilitata durante lo sviluppo");
  });
}
