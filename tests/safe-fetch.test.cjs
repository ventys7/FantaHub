"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

function mockRequest(routes, calls = []) {
  return (options, callback) => {
    const route = routes[calls.length];
    calls.push(options);
    const request = new EventEmitter();
    let timeoutHandler;
    request.setTimeout = (_timeoutMs, handler) => { timeoutHandler = handler; };
    request.destroy = (error) => queueMicrotask(() => request.emit("error", error));
    request.end = () => queueMicrotask(() => {
      if (route.timeout) return timeoutHandler();
      if (route.error) return request.emit("error", route.error);
      const response = new EventEmitter();
      response.statusCode = route.statusCode ?? 200;
      response.headers = route.headers || { "content-type": "text/plain" };
      response.destroyed = false;
      response.destroy = () => { response.destroyed = true; };
      response.resume = () => { response.resumed = true; };
      route.response = response;
      callback(response);
      if (route.hang) return;
      queueMicrotask(() => {
        for (const chunk of route.chunks || []) {
          if (response.destroyed) return;
          response.emit("data", Buffer.from(chunk));
        }
        if (!response.destroyed) response.emit("end");
      });
    });
    return request;
  };
}

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

test("safeFetch accepts credential-free HTTPS and pins the approved address", async () => {
  const calls = [];
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  const result = await safeFetch("https://Example.com/data.csv", {
    lookup: async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 }
    ],
    request: mockRequest([{ headers: { "content-type": "text/csv; charset=utf-8" }, chunks: ["a,b\n1,2"] }], calls),
    allowedMimeTypes: ["text/csv"]
  });

  const pinned = await new Promise((resolve, reject) => {
    calls[0].lookup(calls[0].hostname, {}, (error, address, family) => error ? reject(error) : resolve({ address, family }));
  });
  assert.deepEqual(pinned, { address: "93.184.216.34", family: 4 });
  assert.equal(calls[0].hostname, "example.com");
  assert.equal(result.body.toString(), "a,b\n1,2");
});

test("safeFetch rejects malformed, non-HTTPS, and credentialed URLs before DNS", async () => {
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  let lookups = 0;
  const lookup = async () => { lookups += 1; return [{ address: "93.184.216.34", family: 4 }]; };
  for (const url of ["not a url", "http://example.com/file", "https://user@example.com/file", "https://user:secret@example.com/file"]) {
    await assert.rejects(safeFetch(url, { lookup, request: mockRequest([]) }), /URL|HTTPS|credenzial/i);
  }
  assert.equal(lookups, 0);
});

test("safeFetch rejects literal non-public IPv4 and IPv6 addresses", async () => {
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  const addresses = [
    "0.0.0.0", "10.0.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "192.88.99.1", "192.168.1.1", "224.0.0.1",
    "[::]", "[::1]", "[::ffff:127.0.0.1]", "[64:ff9b::7f00:1]", "[64:ff9b:1::7f00:1]",
    "[100:0:0:1::1]", "[2001:2::1]", "[2001:db8::1]", "[2002:7f00:1::]", "[3fff::1]", "[5f00::1]",
    "[fd00::1]", "[fe80::1]", "[ff02::1]"
  ];
  for (const address of addresses) {
    await assert.rejects(
      safeFetch(`https://${address}/`, { lookup: publicLookup, request: mockRequest([]) }),
      /pubblic|consentit|indirizzo/i,
      address
    );
  }
});

test("pinned lookup honors the Node all-address callback contract", async () => {
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  let pinnedAnswers;
  const request = (options, callback) => {
    const req = new EventEmitter();
    req.setTimeout = () => {};
    req.destroy = (error) => queueMicrotask(() => req.emit("error", error));
    req.end = () => options.lookup(options.hostname, { all: true }, (error, answers) => {
      if (error) return req.emit("error", error);
      pinnedAnswers = answers;
      const response = new EventEmitter();
      response.statusCode = 200;
      response.headers = { "content-type": "text/plain" };
      response.destroy = () => {};
      callback(response);
      queueMicrotask(() => response.emit("end"));
    });
    return req;
  };

  await safeFetch("https://example.com/", { lookup: publicLookup, request });

  assert.deepEqual(pinnedAnswers, [{ address: "93.184.216.34", family: 4 }]);
});

test("safeFetch rejects local hostnames including case and trailing-dot bypasses", async () => {
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  for (const hostname of ["localhost", "LOCALHOST.", "api.local", "API.LOCAL.", "service.internal", "SERVICE.INTERNAL."]) {
    await assert.rejects(
      safeFetch(`https://${hostname}/`, { lookup: publicLookup, request: mockRequest([]) }),
      /host|consentit/i,
      hostname
    );
  }
});

test("safeFetch rejects a hostname when any DNS answer is non-public", async () => {
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  let requests = 0;
  await assert.rejects(safeFetch("https://example.com/file", {
    lookup: async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 }
    ],
    request: () => { requests += 1; }
  }), /pubblic|indirizzo/i);
  assert.equal(requests, 0);

  await assert.rejects(safeFetch("https://example.com/file", {
    lookup: async () => [{ address: "2001:db8::1", family: 6 }],
    request: () => { requests += 1; }
  }), /pubblic|indirizzo/i);
  assert.equal(requests, 0);
});

test("safeFetch manually follows bounded redirects and revalidates every target", async () => {
  const calls = [];
  const lookups = [];
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  const lookup = async (hostname) => {
    lookups.push(hostname);
    return [{ address: hostname === "one.example" ? "93.184.216.34" : "142.250.74.14", family: 4 }];
  };
  const result = await safeFetch("https://one.example/start", {
    lookup,
    request: mockRequest([
      { statusCode: 302, headers: { location: "https://two.example/final" } },
      { headers: { "content-type": "text/plain" }, chunks: ["ok"] }
    ], calls),
    allowedMimeTypes: ["text/plain"]
  });
  assert.deepEqual(lookups, ["one.example", "two.example"]);
  assert.equal(calls.length, 2);
  assert.equal(result.body.toString(), "ok");

  const boundedCalls = [];
  await assert.rejects(safeFetch("https://one.example/start", {
    lookup: publicLookup,
    request: mockRequest([
      { statusCode: 302, headers: { location: "/1" } },
      { statusCode: 302, headers: { location: "/2" } },
      { statusCode: 302, headers: { location: "/3" } }
    ], boundedCalls),
    maxRedirects: 2
  }), /redirect/i);
  assert.equal(boundedCalls.length, 3);
});

test("safeFetch rejects an unsafe redirect without making or consuming a second request", async () => {
  const calls = [];
  const routes = [{ statusCode: 302, headers: { location: "https://127.0.0.1/private" }, chunks: ["secret"] }];
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  await assert.rejects(safeFetch("https://example.com/start", {
    lookup: publicLookup,
    request: mockRequest(routes, calls)
  }), /pubblic|indirizzo/i);
  assert.equal(calls.length, 1);
  assert.equal(routes[0].response.listenerCount("data"), 0);
});

test("safeFetch enforces declared and streamed byte limits while allowing the exact limit", async () => {
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  const exact = await safeFetch("https://example.com/exact", {
    lookup: publicLookup,
    request: mockRequest([{ headers: { "content-type": "text/plain", "content-length": "4" }, chunks: ["12", "34"] }]),
    allowedMimeTypes: ["text/plain"],
    maxBytes: 4
  });
  assert.equal(exact.body.length, 4);

  await assert.rejects(safeFetch("https://example.com/declared", {
    lookup: publicLookup,
    request: mockRequest([{ headers: { "content-type": "text/plain", "content-length": "5" }, chunks: [] }]),
    allowedMimeTypes: ["text/plain"],
    maxBytes: 4
  }), /dimension|byte|grande/i);

  await assert.rejects(safeFetch("https://example.com/streamed", {
    lookup: publicLookup,
    request: mockRequest([{ headers: { "content-type": "text/plain" }, chunks: ["1234", "5"] }]),
    allowedMimeTypes: ["text/plain"],
    maxBytes: 4
  }), /dimension|byte|grande/i);
});

test("safeFetch accepts MIME parameters and rejects MIME types outside the allowlist", async () => {
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  const accepted = await safeFetch("https://example.com/page", {
    lookup: publicLookup,
    request: mockRequest([{ headers: { "content-type": "text/html; charset=UTF-8" }, chunks: ["<p>ok</p>"] }]),
    allowedMimeTypes: ["text/html"]
  });
  assert.equal(accepted.mimeType, "text/html");
  await assert.rejects(safeFetch("https://example.com/page", {
    lookup: publicLookup,
    request: mockRequest([{ headers: { "content-type": "application/json" }, chunks: ["{}"] }]),
    allowedMimeTypes: ["text/html"]
  }), /MIME|content-type/i);
});

test("safeFetch reports request errors and timeouts", async () => {
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  await assert.rejects(safeFetch("https://example.com/error", {
    lookup: publicLookup,
    request: mockRequest([{ error: new Error("socket failed") }])
  }), /socket failed/);
  await assert.rejects(safeFetch("https://example.com/timeout", {
    lookup: publicLookup,
    request: mockRequest([{ timeout: true }]),
    timeoutMs: 10
  }), /timeout/i);
});

test("safeFetch applies a hard deadline when a response never ends", { timeout: 200 }, async () => {
  const { safeFetch } = require("../lib/safe-fetch.cjs");
  await assert.rejects(safeFetch("https://example.com/hang", {
    lookup: publicLookup,
    request: mockRequest([{ headers: { "content-type": "text/plain" }, hang: true }]),
    timeoutMs: 10
  }), /timeout/i);
});

test("legacy remote images use the shared 512 KiB raster-only transport", async (t) => {
  const safePath = require.resolve("../lib/safe-fetch.cjs");
  const migratePath = require.resolve("../lib/migrate-neon.cjs");
  const previousSafe = require.cache[safePath];
  const calls = [];
  require.cache[safePath] = {
    id: safePath,
    filename: safePath,
    loaded: true,
    exports: {
      safeFetch: async (url, options) => {
        calls.push({ url, options });
        return { body: Buffer.from("image"), mimeType: "image/webp" };
      }
    }
  };
  delete require.cache[migratePath];
  t.after(() => {
    delete require.cache[migratePath];
    if (previousSafe) require.cache[safePath] = previousSafe;
    else delete require.cache[safePath];
  });

  const { readLegacyImage } = require("../lib/migrate-neon.cjs");
  const image = await readLegacyImage("https://cdn.example/logo.webp");
  assert.equal(calls[0].options.maxBytes, 512 * 1024);
  assert.deepEqual(calls[0].options.allowedMimeTypes, ["image/png", "image/jpeg", "image/webp"]);
  assert.equal(image.mimeType, "image/webp");
});
