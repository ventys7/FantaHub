"use strict";

const https = require("node:https");
const dns = require("node:dns/promises");
const { BlockList, isIP } = require("node:net");

const BLOCKED_ADDRESSES = new BlockList();
for (const [address, prefix, type] of [
  ["0.0.0.0", 8, "ipv4"], ["10.0.0.0", 8, "ipv4"], ["100.64.0.0", 10, "ipv4"],
  ["127.0.0.0", 8, "ipv4"], ["169.254.0.0", 16, "ipv4"], ["172.16.0.0", 12, "ipv4"],
  ["192.0.0.0", 24, "ipv4"], ["192.0.2.0", 24, "ipv4"], ["192.88.99.0", 24, "ipv4"],
  ["192.168.0.0", 16, "ipv4"],
  ["198.18.0.0", 15, "ipv4"], ["198.51.100.0", 24, "ipv4"], ["203.0.113.0", 24, "ipv4"],
  ["224.0.0.0", 4, "ipv4"], ["240.0.0.0", 4, "ipv4"],
  ["::", 128, "ipv6"], ["::1", 128, "ipv6"],
  ["64:ff9b::", 96, "ipv6"], ["64:ff9b:1::", 48, "ipv6"], ["100::", 64, "ipv6"],
  ["100:0:0:1::", 64, "ipv6"], ["2001::", 23, "ipv6"], ["2001:db8::", 32, "ipv6"],
  ["2002::", 16, "ipv6"],
  ["3fff::", 20, "ipv6"], ["5f00::", 16, "ipv6"], ["fc00::", 7, "ipv6"], ["fe80::", 10, "ipv6"],
  ["fec0::", 10, "ipv6"], ["ff00::", 8, "ipv6"]
]) BLOCKED_ADDRESSES.addSubnet(address, prefix, type);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function parseSafeUrl(value, base) {
  let url;
  try { url = new URL(value, base); }
  catch { throw new Error("URL non valido"); }
  if (url.protocol !== "https:") throw new Error("Solo URL HTTPS consentiti");
  if (url.username || url.password) throw new Error("URL con credenziali non consentito");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (!normalized || normalized === "localhost" || normalized.endsWith(".localhost") ||
      normalized === "local" || normalized.endsWith(".local") ||
      normalized === "internal" || normalized.endsWith(".internal")) {
    throw new Error("Hostname locale non consentito");
  }
  return { url, hostname };
}

function assertPublicAddress(address, family) {
  const version = isIP(address);
  if (!version || (family && Number(family) !== version) || BLOCKED_ADDRESSES.check(address, `ipv${version}`)) {
    throw new Error("Indirizzo IP non pubblico");
  }
}

async function resolvePublic(hostname, lookup, timeoutMs) {
  const literalFamily = isIP(hostname);
  const answers = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await withTimeout(lookup(hostname, { all: true, verbatim: true }), timeoutMs);
  if (!Array.isArray(answers) || !answers.length) throw new Error("DNS senza indirizzi pubblici");
  for (const answer of answers) assertPublicAddress(answer?.address, answer?.family);
  return answers[0];
}

function withTimeout(promise, timeoutMs) {
  if (timeoutMs <= 0) return Promise.reject(new Error("Timeout richiesta HTTPS"));
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Timeout richiesta HTTPS")), timeoutMs); })
  ]).finally(() => clearTimeout(timer));
}

function requestOnce(url, address, options, timeoutMs) {
  if (timeoutMs <= 0) return Promise.reject(new Error("Timeout richiesta HTTPS"));
  const { request, headers, maxBytes, allowedMimeTypes } = options;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const pinnedLookup = (_hostname, lookupOptions, callback) => {
      if (typeof lookupOptions === "function") callback = lookupOptions;
      const pinned = { address: address.address, family: Number(address.family) };
      callback(null, lookupOptions?.all ? [pinned] : pinned.address, pinned.family);
    };
    const requestOptions = {
      protocol: "https:",
      hostname: url.hostname.replace(/^\[|\]$/g, ""),
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers,
      lookup: pinnedLookup,
      agent: false
    };
    let req;
    try {
      req = request(requestOptions, (response) => {
        const statusCode = Number(response.statusCode || 0);
        if (REDIRECT_STATUSES.has(statusCode)) {
          response.destroy();
          const location = response.headers.location;
          if (!location) return finish(reject, new Error("Redirect senza destinazione"));
          return finish(resolve, { redirect: location });
        }
        if (statusCode < 200 || statusCode >= 300) {
          response.destroy();
          return finish(reject, new Error(`HTTP ${statusCode}`));
        }

        const mimeType = String(response.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
        if (allowedMimeTypes.length && !allowedMimeTypes.includes(mimeType)) {
          response.destroy();
          return finish(reject, new Error("MIME Content-Type non consentito"));
        }
        const declared = response.headers["content-length"];
        if (declared !== undefined && (!/^\d+$/.test(String(declared)) || Number(declared) > maxBytes)) {
          response.destroy();
          return finish(reject, new Error("Corpo oltre il limite di byte"));
        }

        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          if (settled) return;
          const bytes = Buffer.from(chunk);
          size += bytes.length;
          if (size > maxBytes) {
            response.destroy();
            finish(reject, new Error("Corpo oltre il limite di byte"));
          } else chunks.push(bytes);
        });
        response.on("end", () => finish(resolve, { body: Buffer.concat(chunks, size), mimeType, statusCode }));
        response.on("aborted", () => finish(reject, new Error("Risposta HTTPS interrotta")));
        response.on("error", (error) => finish(reject, error));
      });
    } catch (error) {
      return finish(reject, error);
    }
    req.on("error", (error) => finish(reject, error));
    const timeout = () => {
      const error = new Error("Timeout richiesta HTTPS");
      req.destroy(error);
      finish(reject, error);
    };
    req.setTimeout(timeoutMs, timeout);
    timer = setTimeout(timeout, timeoutMs);
    req.end();
  });
}

async function safeFetch(value, {
  lookup = dns.lookup,
  request = https.request,
  headers = {},
  maxBytes = 2 * 1024 * 1024,
  allowedMimeTypes = [],
  timeoutMs = 12000,
  maxRedirects = 3
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let current = parseSafeUrl(value);
  for (let redirects = 0; ; redirects += 1) {
    const remaining = deadline - Date.now();
    const address = await resolvePublic(current.hostname, lookup, remaining);
    const result = await requestOnce(current.url, address, {
      request,
      headers,
      maxBytes,
      allowedMimeTypes: allowedMimeTypes.map((type) => String(type).toLowerCase())
    }, deadline - Date.now());
    if (!result.redirect) return { ...result, url: current.url.toString() };
    if (redirects >= maxRedirects) throw new Error("Troppi redirect HTTPS");
    current = parseSafeUrl(result.redirect, current.url);
  }
}

module.exports = { safeFetch };
