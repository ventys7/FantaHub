"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("active runtime stores logos and configuration in Neon without Blob write fallbacks", () => {
  const teamLogoApi = source("api/team-logo.js");
  const settings = source("lib/settings.cjs");
  const logoAccess = source("lib/logo-access.cjs");
  const migration = source("lib/migrate-neon.cjs");

  assert.doesNotMatch(teamLogoApi, /uploadImmutableImage|writeBuffer|writeJson/);
  assert.match(teamLogoApi, /writeTeamLogo/);
  assert.match(settings, /scrittura runtime bloccata per evitare fallback Blob/);
  assert.match(logoAccess, /reset codice bloccato per evitare fallback Blob/);
  assert.doesNotMatch(migration, /writeJson|writeBuffer|uploadImmutableImage/);
  assert.match(migration, /readJson/);
});

test("Vercel configuration is deterministic, hardened and exposes no media cron", () => {
  const config = JSON.parse(source("vercel.json"));
  assert.equal(config.crons, undefined);
  assert.equal(config.functions?.["api/admin.js"]?.maxDuration, 300);
  assert.equal(config.functions?.["api/player-media.js"]?.maxDuration, 300);
  assert.match(config.installCommand, /^npm ci /);

  const ruleHeaders = (pattern) => {
    const entry = config.headers?.find((item) => item.source === pattern);
    return entry
      ? Object.fromEntries(entry.headers.map((header) => [header.key, header.value]))
      : {};
  };

  // Vercel applica in merge TUTTE le regole headers che matchano la richiesta:
  // il DENY vive nelle regole pagina e NON nel catch-all, altrimenti colpirebbe
  // anche gli endpoint API esentati (es. /api/regolamento) e romperebbe l'iframe.
  const globalHeaders = ruleHeaders("/:path*");
  assert.equal(globalHeaders["X-Content-Type-Options"], "nosniff");
  assert.equal(globalHeaders["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(globalHeaders["X-Frame-Options"], undefined);

  assert.equal(ruleHeaders("/api/regolamento")["X-Frame-Options"], undefined);
  assert.equal(ruleHeaders("/api/regolamento-img")["X-Frame-Options"], undefined);

  const hardenedPages = [
    "/", "/index.html",
    "/fp", "/fp/", "/fp/index.html",
    "/pd", "/pd/", "/pd/index.html",
    "/fp/admin-links", "/fp/admin-links/", "/fp/admin-links/index.html",
    "/pd/admin-links", "/pd/admin-links/", "/pd/admin-links/index.html",
    "/js/:path*", "/css/:path*", "/manifests/:path*",
    "/assets/dashboard/:path*", "/data/:path*"
  ];
  for (const page of hardenedPages) {
    const headers = ruleHeaders(page);
    assert.equal(headers["X-Frame-Options"], "DENY", `${page} deve esporre DENY`);
    assert.equal(headers["X-Content-Type-Options"], "nosniff", `${page} deve avere nosniff`);
    assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin", `${page} deve avere la referrer policy`);
  }
});

test("team logo URLs are served by the Neon-backed API", () => {
  const { teamLogoUrl } = require("../lib/settings.cjs");
  const url = teamLogoUrl("fp", "Nicolò - Gabriele", "abcdef1234567890");
  assert.match(url, /^\/api\/team-logo\?/);
  assert.match(url, /league=fp/);
  assert.match(url, /team=Nicol%C3%B2\+-\+Gabriele/);
  assert.match(url, /v=abcdef1234567890/);
});
