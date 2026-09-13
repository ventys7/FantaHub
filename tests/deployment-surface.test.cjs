const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
}

test("Vercel upload excludes private and development files", async () => {
  const contents = await readFile(path.join(ROOT, ".vercelignore"), "utf8");
  const entries = new Set(contents.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));

  for (const entry of [
    ".env*",
    ".lineup-backup-*",
    ".lineup-runtime/",
    ".serena/",
    ".swarm/",
    ".tmp/",
    ".claude-flow/",
    "docs/",
    "tests/",
    "scripts/_exp*.cjs",
    "ruvector.db",
    "**/*.map"
  ]) {
    assert.ok(entries.has(entry), `missing ${entry}`);
  }
});

test("dashboard builds without public source maps", async () => {
  const config = (await import(pathToFileURL(path.join(ROOT, "dashboard/vite.config.js")).href)).default;

  assert.equal(config.build.sourcemap, false);
});

test("supported Node and compiler checks are enforced before build", async () => {
  const rootPackage = await json("package.json");
  const dashboardPackage = await json("dashboard/package.json");
  const verify = rootPackage.scripts.verify;

  assert.equal(rootPackage.engines.node, ">=20");
  assert.equal(rootPackage.scripts["test:types"], "npm --prefix dashboard run test:types");
  assert.equal(dashboardPackage.scripts["test:types"], "tsc --noEmit -p tsconfig.test.json");
  assert.ok(verify.indexOf("npm run typecheck") < verify.indexOf("npm run build"));
  assert.ok(verify.indexOf("npm run test:types") < verify.indexOf("npm run build"));
});

test("dashboard test TypeScript has a dedicated compiler scope", async () => {
  const productionConfig = await json("dashboard/tsconfig.json");
  const testConfig = await json("dashboard/tsconfig.test.json");

  assert.ok(productionConfig.exclude.includes("src/**/*.test.tsx"));
  assert.deepEqual(testConfig.include, ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**/*.ts"]);
  assert.deepEqual(testConfig.exclude, []);
});

test("static checks reject source maps in public assets", async () => {
  const script = await readFile(path.join(ROOT, "scripts/check-static.sh"), "utf8");

  assert.match(script, /rglob\(["']\*\.map["']\)/);
});
