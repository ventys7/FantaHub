"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { LOCAL_ROOT, readBuffer, statBuffer, uploadImmutableImage } = require("../lib/storage.cjs");

const STORAGE_PATH = require.resolve("../lib/storage.cjs");

async function isolatedStorage(t) {
  const originalCwd = process.cwd();
  const originalModule = require.cache[STORAGE_PATH];
  const root = await fs.mkdtemp(path.join(require("node:os").tmpdir(), "lineup-storage-test-"));
  process.chdir(root);
  delete require.cache[STORAGE_PATH];
  const storage = require(STORAGE_PATH);
  t.after(async () => {
    process.chdir(originalCwd);
    delete require.cache[STORAGE_PATH];
    if (originalModule) require.cache[STORAGE_PATH] = originalModule;
    await fs.rm(root, { recursive: true, force: true });
  });
  return { root, storage };
}

test("immutable image uploads expose a verifiable content-addressed key", async () => {
  const folder = `tests/player-faces/${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const bytes = Buffer.from("lineup-fanta-storage-verification");
  const expectedDigest = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12);

  const stored = await uploadImmutableImage(folder, "portrait", bytes, "image/png");
  assert.match(stored.key, new RegExp(`portrait-${expectedDigest}\\.png$`));
  assert.equal(stored.digest, expectedDigest);
  assert.deepEqual(await readBuffer(stored.key), bytes);
  const metadata = await statBuffer(stored.key);
  assert.equal(metadata.size, bytes.length);

  await fs.rm(path.join(LOCAL_ROOT, ...folder.split("/")), { recursive: true, force: true });
});

test("readJson returns a cloned fallback only when the file is missing", async (t) => {
  const { storage } = await isolatedStorage(t);
  const fallback = { version: 1 };

  const result = await storage.readJson("missing.json", fallback);

  assert.deepEqual(result, fallback);
  assert.notEqual(result, fallback);
});

test("readJson rejects malformed JSON without exposing its path or contents", async (t) => {
  const { root, storage } = await isolatedStorage(t);
  await fs.mkdir(storage.LOCAL_ROOT, { recursive: true });
  await fs.writeFile(path.join(storage.LOCAL_ROOT, "settings.json"), "{private-token");

  await assert.rejects(storage.readJson("settings.json", {}), (error) => {
    assert.match(error.message, /JSON runtime non valido/);
    assert.doesNotMatch(error.message, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(error.message, /private-token/);
    return true;
  });
});

test("concurrent writeJson calls leave one complete JSON document", async (t) => {
  const { storage } = await isolatedStorage(t);
  const target = path.join(storage.LOCAL_ROOT, "state.json");
  const originalRename = fs.rename;
  const originalRandomUUID = crypto.randomUUID;
  let renameCalls = 0;
  let writeBodiesStarted = 0;
  let notifyFirstRename;
  let releaseFirstRename;
  const firstRenameReached = new Promise((resolve) => { notifyFirstRename = resolve; });
  const firstRenameReleased = new Promise((resolve) => { releaseFirstRename = resolve; });
  fs.rename = async (from, to) => {
    if (path.resolve(to) === target) {
      renameCalls += 1;
      if (renameCalls === 1) {
        notifyFirstRename();
        await firstRenameReleased;
      }
    }
    return originalRename(from, to);
  };
  crypto.randomUUID = () => {
    writeBodiesStarted += 1;
    return originalRandomUUID();
  };
  t.after(() => {
    fs.rename = originalRename;
    crypto.randomUUID = originalRandomUUID;
  });

  const first = storage.writeJson("state.json", { winner: "alpha" });
  await firstRenameReached;
  const second = storage.writeJson("state.json", { winner: "beta" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writeBodiesStarted, 1);
  assert.equal(renameCalls, 1);
  releaseFirstRename();
  await Promise.all([first, second]);

  const document = JSON.parse(await fs.readFile(target, "utf8"));
  assert.equal(writeBodiesStarted, 2);
  assert.equal(renameCalls, 2);
  assert.equal(document.winner, "beta");
});

test("writeJson creates private files and preserves an existing target mode", async (t) => {
  const { storage } = await isolatedStorage(t);
  const target = path.join(storage.LOCAL_ROOT, "state.json");

  await storage.writeJson("state.json", { value: "first" });
  assert.equal((await fs.stat(target)).mode & 0o777, 0o600);

  await fs.chmod(target, 0o640);
  await storage.writeJson("state.json", { value: "second" });
  assert.equal((await fs.stat(target)).mode & 0o777, 0o640);
});

test("writeJson preserves the target and cleans its temp file when rename fails", async (t) => {
  const { storage } = await isolatedStorage(t);
  await storage.writeJson("state.json", { value: "previous" });
  const originalRename = fs.rename;
  fs.rename = async () => { throw new Error("rename blocked"); };
  t.after(() => { fs.rename = originalRename; });

  await assert.rejects(storage.writeJson("state.json", { value: "next" }), /rename blocked/);

  assert.equal((await storage.readJson("state.json")).value, "previous");
  assert.deepEqual(await fs.readdir(storage.LOCAL_ROOT), ["state.json"]);
  fs.rename = originalRename;
  await storage.writeJson("state.json", { value: "recovered" });
  assert.equal((await storage.readJson("state.json")).value, "recovered");
});
