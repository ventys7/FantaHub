"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const RUNTIME_PREFIX = "lineup-fanta-runtime";
const LOCAL_ROOT = path.join(process.cwd(), ".lineup-runtime");
let blobSdkPromise = null;

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

function blobPath(key) {
  return `${RUNTIME_PREFIX}/${cleanKey(key)}`;
}

function findEnv(exactName, suffix) {
  const exact = String(process.env[exactName] || "").trim();
  if (exact) return exact;
  const matches = Object.entries(process.env)
    .filter(([name, value]) => name.endsWith(suffix) && String(value || "").trim())
    .map(([, value]) => String(value).trim());
  return matches.length === 1 ? matches[0] : "";
}

function blobOptions() {
  const token = findEnv("BLOB_READ_WRITE_TOKEN", "BLOB_READ_WRITE_TOKEN");
  if (token) return { token };
  const storeId = findEnv("BLOB_STORE_ID", "BLOB_STORE_ID");
  const oidcToken = String(process.env.VERCEL_OIDC_TOKEN || "").trim();
  return storeId && oidcToken ? { storeId, oidcToken } : {};
}

function useLocal() {
  return !process.env.VERCEL && Object.keys(blobOptions()).length === 0;
}

async function blobSdk() {
  if (!blobSdkPromise) blobSdkPromise = import("@vercel/blob");
  return blobSdkPromise;
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  const chunks = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function readBuffer(key) {
  if (useLocal()) {
    try { return await fs.readFile(localPath(key)); }
    catch (error) { if (error?.code === "ENOENT") return null; throw error; }
  }

  try {
    const { get } = await blobSdk();
    const result = await get(blobPath(key), { access: "public", useCache: false, ...blobOptions() });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return streamToBuffer(result.stream);
  } catch (error) {
    if (/not found|404/i.test(String(error?.message || ""))) return null;
    throw error;
  }
}

async function statBuffer(reference) {
  const value = String(reference || "").trim();
  if (!value) throw new Error("Riferimento storage non valido");

  if (useLocal()) {
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

  try {
    const { head } = await blobSdk();
    const target = /^https?:\/\//i.test(value) ? value : blobPath(value);
    const metadata = await head(target, blobOptions());
    return metadata ? { ...metadata, source: "blob" } : null;
  } catch (error) {
    if (/not found|404/i.test(String(error?.message || ""))) return null;
    throw error;
  }
}

async function writeBuffer(key, value, options = {}) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  if (useLocal()) {
    const target = localPath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return { url: `/.lineup-runtime/${cleanKey(key)}`, source: "local", pathname: target };
  }

  const { put } = await blobSdk();
  const blob = await put(blobPath(key), buffer, {
    access: "public",
    allowOverwrite: options.allowOverwrite !== false,
    contentType: options.contentType || "application/octet-stream",
    cacheControlMaxAge: options.cacheControlMaxAge ?? 60,
    ...blobOptions()
  });
  return { url: blob.url, source: "blob", pathname: blob.pathname };
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
  RUNTIME_PREFIX,
  blobOptions,
  readBuffer,
  readJson,
  statBuffer,
  uploadImmutableImage,
  useLocal,
  writeBuffer,
  writeJson
};
