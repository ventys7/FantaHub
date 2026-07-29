#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const checkOnly = process.argv.includes("--check");
const template = readFileSync(resolve(root, "index.html"), "utf8");
const iconVersion = "8";

const routes = {
  fp: {
    name: "PianginaCUP",
    favicon: `/fp/favicon.svg?v=${iconVersion}`,
    appleTouchIcon: "/fp/apple-touch-icon.png?v=5",
    themeColor: "#7c3aed"
  },
  pd: {
    name: "LaLigaCUP",
    favicon: `/pd/favicon.svg?v=${iconVersion}`,
    appleTouchIcon: "/pd/apple-touch-icon.png?v=5",
    themeColor: "#b91c1c"
  }
};

function renderRoutePage(id, identity) {
  const staticHead = [
    `  <meta name="theme-color" content="${identity.themeColor}" data-lineup-static-identity>`,
    `  <meta name="mobile-web-app-capable" content="yes" data-lineup-static-identity>`,
    `  <meta name="apple-mobile-web-app-capable" content="yes" data-lineup-static-identity>`,
    `  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" data-lineup-static-identity>`,
    `  <meta name="apple-mobile-web-app-title" content="${identity.name}" data-lineup-static-identity>`,
    `  <link rel="icon" type="image/svg+xml" href="${identity.favicon}" data-lineup-static-identity>`,
    `  <link rel="apple-touch-icon" sizes="180x180" href="${identity.appleTouchIcon}" data-lineup-static-identity>`
  ].join("\n");

  // replaceAll ensures every occurrence is replaced, not just the first
  return template
    .replaceAll('<html lang="it">', `<html lang="it" data-static-league-identity="${id}">`)
    .replaceAll('<title>Lineup Fanta</title>', `<title>${identity.name} · Lineup Fanta</title>`)
    .replaceAll('<script src="js/config.js"></script>', `${staticHead}\n<script src="js/config.js"></script>`);
}

const outOfSync = [];
for (const [id, identity] of Object.entries(routes)) {
  const target = resolve(root, id, "index.html");
  const expected = renderRoutePage(id, identity);
  let current = null;
  try {
    current = readFileSync(target, "utf8");
  } catch {
    // Generated below when not running in verification mode.
  }

  if (current !== expected) {
    outOfSync.push(`${id}/index.html`);
    if (!checkOnly) {
      mkdirSync(resolve(root, id), { recursive: true });
      writeFileSync(target, expected, "utf8");
    }
  }
}

if (checkOnly && outOfSync.length) {
  console.error(`Route statiche non aggiornate: ${outOfSync.join(", ")}`);
  console.error("Esegui: node scripts/generate-route-pages.mjs");
  process.exit(1);
}

if (!checkOnly) {
  console.log(`✓ Route statiche aggiornate: ${outOfSync.length || 0}`);
}
