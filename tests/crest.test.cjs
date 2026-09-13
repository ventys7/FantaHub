"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/crest.js");

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
    end(value) { this.body = value ?? null; return this; }
  };
}

test("crest proxy rejects non-numeric team ids", async () => {
  const previous = global.fetch;
  global.fetch = async () => { throw new Error("fetch non deve partire"); };
  try {
    const res = responseRecorder();
    await handler({ method: "GET", query: { id: "arsenal" } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(String(res.body?.error || ""), /ID squadra/i);
  } finally {
    global.fetch = previous;
  }
});

test("crest proxy rejects oversized responses before buffering them", async () => {
  const previous = global.fetch;
  let arrayBufferCalled = false;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "image/png", "content-length": String(3 * 1024 * 1024) }),
    body: null,
    async arrayBuffer() { arrayBufferCalled = true; return new ArrayBuffer(0); }
  });
  try {
    const res = responseRecorder();
    await handler({ method: "GET", query: { id: "42" } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(arrayBufferCalled, false);
    assert.match(String(res.body?.error || ""), /non disponibile|troppo pesante/i);
  } finally {
    global.fetch = previous;
  }
});

test("crest proxy rejects active SVG without returning its bytes", async () => {
  const previous = global.fetch;
  const payloads = [
    "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
    "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'></svg>",
    "<svg xmlns='http://www.w3.org/2000/svg'><image href='https://evil.test/a.png'/></svg>"
  ];
  try {
    for (const payload of payloads) {
      global.fetch = async () => new Response(payload, {
        status: 200,
        headers: { "content-type": "image/svg+xml" }
      });
      const res = responseRecorder();
      await handler({ method: "GET", query: { id: "42" } }, res);
      assert.equal(res.statusCode, 502);
      assert.equal(Buffer.isBuffer(res.body), false);
      assert.doesNotMatch(JSON.stringify(res.body), /<svg/i);
    }
  } finally {
    global.fetch = previous;
  }
});

test("crest proxy keeps raster formats and long-lived cache headers", async () => {
  const previous = global.fetch;
  const payload = Buffer.from([137, 80, 78, 71]);
  let mimeType = "image/png";
  global.fetch = async (url, options) => {
    assert.equal(String(url), "https://kick-off-tau.vercel.app/api/crest/42");
    assert.doesNotMatch(options.headers.Accept, /svg/i);
    return new Response(payload, {
      status: 200,
      headers: { "content-type": mimeType, "content-length": String(payload.length) }
    });
  };
  try {
    for (mimeType of ["image/png", "image/jpeg", "image/webp", "image/avif"]) {
      const res = responseRecorder();
      await handler({ method: "GET", query: { id: "42" } }, res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, payload);
      assert.equal(res.headers["content-type"], mimeType);
      assert.match(res.headers["cache-control"], /s-maxage=2592000/);
    }
  } finally {
    global.fetch = previous;
  }
});

test("crest proxy enforces the 2 MiB cap on actual streamed bytes", async () => {
  const previous = global.fetch;
  global.fetch = async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), {
    status: 200,
    headers: { "content-type": "image/png" }
  });
  try {
    const res = responseRecorder();
    await handler({ method: "GET", query: { id: "42" } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(Buffer.isBuffer(res.body), false);
  } finally {
    global.fetch = previous;
  }
});

test("crest proxy rejects non-GET methods", async () => {
  const previous = global.fetch;
  global.fetch = async () => { throw new Error("fetch non deve partire"); };
  try {
    const res = responseRecorder();
    await handler({ method: "POST", query: { id: "42" } }, res);
    assert.equal(res.statusCode, 405);
  } finally {
    global.fetch = previous;
  }
});
