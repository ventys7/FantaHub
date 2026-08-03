"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const LOCAL_ROOT = path.join(process.cwd(), ".lineup-runtime");

function cleanKey(value) {
  let key = String(value || "").replace(/^\/+/, "");
  if (!key || /[\\<>:"|?*]/.test(key) || key.includes("..") || key.startsWith("~")) throw new Error("Chiave storage non valida");
  key = path.normalize(key).replace(/^\/+/, "");
  if (!key || key.startsWith("..")) throw new Error("Chiave storage non valida");
  return key;
}

function localPath(key) {
  return path.join(LOCAL_ROOT, ...cleanKey(key).split("/"));
}

async function readBuffer(key) {
  try { return await fs.readFile(localPath(key)); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

async function statBuffer(reference) {
  const value = String(reference || "").trim();
  if (!value) throw new Error("Riferimento storage non valido");

  const key = value.startsWith("/.lineup-runtime/")
    ? value.slice("/.lineup-runtime/".length)
    : value;
  try {
    const stats = await fs.stat(localPath(key));
    return { size: stats.size, pathname: localPath(key), contentType: "", source: "local" };
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeBuffer(key, value, options = {}) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const target = localPath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return { url: `/.lineup-runtime/${cleanKey(key)}`, source: "local", pathname: target };
}

async function readJson(key, fallback = null) {
  const buffer = await readBuffer(key);
  if (!buffer) return structuredClone(fallback);
  try { return JSON.parse(buffer.toString("utf8")); }
  catch { return structuredClone(fallback); }
}

async function writeJson(key, value) {
  const document = { ...value, updatedAt: new Date().toISOString() };
  const result = await writeBuffer(key, `${JSON.stringify(document, null, 2)}\n`, {
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 30
  });
  return { document, ...result };
}

function slugify(value) {
  return String(value || "asset")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 64) || "asset";
}

async function uploadImmutableImage(folder, name, bytes, mimeType = "image/png") {
  const extension = mimeType === "image/webp" ? "webp" : mimeType === "image/jpeg" ? "jpg" : "png";
  const digest = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const key = `${cleanKey(folder)}/${slugify(name)}-${digest}.${extension}`;
  const stored = await writeBuffer(key, bytes, {
    allowOverwrite: true,
    contentType: mimeType,
    cacheControlMaxAge: 31536000
  });
  return { ...stored, key, digest };
}

module.exports = {
  LOCAL_ROOT,
  readBuffer,
  readJson,
  statBuffer,
  uploadImmutableImage,
  writeJson
};
