const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
let importListenCalls = 0;
let modulePromise;

function loadDevServer() {
  if (modulePromise) return modulePromise;
  const originalListen = http.Server.prototype.listen;
  http.Server.prototype.listen = function interceptedListen() {
    importListenCalls += 1;
    return this;
  };
  modulePromise = import(pathToFileURL(path.join(ROOT, "scripts/dev-server.mjs")).href)
    .finally(() => { http.Server.prototype.listen = originalListen; });
  return modulePromise;
}

test("importing the dev server does not open a socket", async () => {
  const devServer = await loadDevServer();

  assert.equal(importListenCalls, 0);
  assert.equal(devServer.DEFAULT_HOST, "127.0.0.1");
  assert.equal(typeof devServer.createDevServer, "function");
});

test("player-photo is part of the local API surface", async () => {
  const { API_ROUTES, DEFAULT_HOST, createDevServer } = await loadDevServer();
  assert.ok(API_ROUTES.includes("player-photo"));

  const server = createDevServer({ root: ROOT });
  await new Promise((resolve) => server.listen(0, DEFAULT_HOST, resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://${DEFAULT_HOST}:${address.port}/api/player-photo?id=bad`);
    assert.equal(response.status, 400);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("only public static paths and player images are allowed", async () => {
  const { safeFilePath } = await loadDevServer();
  for (const pathname of [
    "/",
    "/index.html",
    "/css/style.css",
    "/assets/identity/fp-logo.png",
    "/data/fp/teams.json",
    "/fp/",
    "/js/app.js",
    "/.lineup-runtime/player-images/player.png"
  ]) {
    assert.ok(safeFilePath(pathname, ROOT), `expected public path: ${pathname}`);
  }

  for (const pathname of [
    "/.env.local",
    "/.git/config",
    "/../package.json",
    "/%2e%2e/package.json",
    "/css/../../package.json",
    "/css/%2e%2e/%2e%2e/package.json",
    "/%E0%A4%A",
    "/.lineup-runtime/settings.json",
    "/.lineup-runtime/player-images/.secret",
    "/package.json",
    "/docs/ARCHITECTURE.md",
    "/lib/storage.cjs"
  ]) {
    assert.equal(safeFilePath(pathname, ROOT), null, `expected private path: ${pathname}`);
  }
});

test("static resolution rejects symlink directory escapes", async () => {
  const { resolveStaticPath } = await loadDevServer();
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "fantahub-dev-server-"));
  const publicRoot = path.join(parent, "public");
  const outside = path.join(parent, "outside");
  await fs.mkdir(path.join(publicRoot, "assets"), { recursive: true });
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, "secret.txt"), "secret");
  await fs.symlink(outside, path.join(publicRoot, "assets", "escape"));

  try {
    assert.equal(await resolveStaticPath("/assets/escape/secret.txt", publicRoot), null);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});
