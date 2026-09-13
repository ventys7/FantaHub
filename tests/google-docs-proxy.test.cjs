"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const MODULE_PATH = require.resolve("../lib/google-docs-session.cjs");

function loadSession() {
  delete require.cache[MODULE_PATH];
  return require(MODULE_PATH);
}

function response(body, contentType, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    headers: { "content-type": contentType, ...init.headers },
  });
}

async function withFetch(fetchImpl, run) {
  const original = global.fetch;
  global.fetch = fetchImpl;
  try {
    await run();
  } finally {
    global.fetch = original;
  }
}

test("configured documents must be credential-free HTTPS Google Docs document URLs", () => {
  const { publishedDocUrl } = loadSession();

  assert.equal(
    publishedDocUrl("https://docs.google.com/document/d/example/edit"),
    "https://docs.google.com/document/d/example/pub?embedded=true"
  );
  for (const value of [
    "http://docs.google.com/document/d/example/edit",
    "https://user:secret@docs.google.com/document/d/example/edit",
    "https://docs.google.com/spreadsheets/d/example/edit",
    "https://docs.google.com.evil.test/document/d/example/edit",
  ]) assert.equal(publishedDocUrl(value), "");
});

test("redirects are followed only while every hop remains HTTPS on docs.google.com", async () => {
  const blocked = [
    "http://docs.google.com/document/d/example/pub",
    "https://127.0.0.1/document/d/example/pub",
    "https://evil.test/document/d/example/pub",
  ];

  for (const location of blocked) {
    const calls = [];
    await withFetch(async (url) => {
      calls.push(String(url));
      return response(null, "text/html", { status: 302, headers: { location } });
    }, async () => {
      const { fetchDocHtml } = loadSession();
      await assert.rejects(
        fetchDocHtml("regolamento", "fp", "https://docs.google.com/document/d/example/pub"),
        /Google Docs response rejected/
      );
    });
    assert.equal(calls.length, 1, `${location} must stop before a second request`);
  }
});

test("cookies remain isolated by document kind and league", async () => {
  const requests = [];
  await withFetch(async (url, options) => {
    requests.push({ url: String(url), cookie: options.headers.cookie || "" });
    const isAsset = String(url).includes("docs-images-rt");
    const cookie = requests.length === 1 ? "reg=one; Path=/" : requests.length === 2 ? "cal=two; Path=/" : null;
    return response(isAsset ? new Uint8Array([0x89, 0x50, 0x4e, 0x47]) : "<html></html>", isAsset ? "image/png" : "text/html", {
      headers: cookie ? { "set-cookie": cookie } : {},
    });
  }, async () => {
    const { fetchDocHtml, fetchDocAsset } = loadSession();
    const doc = "https://docs.google.com/document/d/example/pub";
    await fetchDocHtml("regolamento", "fp", doc);
    await fetchDocHtml("calendario", "fp", doc);
    await fetchDocAsset("regolamento", "fp", "https://docs.google.com/docs-images-rt/reg", doc);
    await fetchDocAsset("calendario", "fp", "https://docs.google.com/docs-images-rt/cal", doc);
    await fetchDocAsset("regolamento", "pd", "https://docs.google.com/docs-images-rt/pd", doc);
  });

  assert.equal(requests[2].cookie, "reg=one");
  assert.equal(requests[3].cookie, "cal=two");
  assert.equal(requests[4].cookie, "");
});

test("HTML requires text/html and is capped using streamed bytes", async () => {
  await withFetch(async () => response("not html", "text/plain"), async () => {
    const { fetchDocHtml } = loadSession();
    await assert.rejects(
      fetchDocHtml("regolamento", "fp", "https://docs.google.com/document/d/example/pub"),
      /Google Docs response rejected/
    );
  });

  const oversized = new Uint8Array(2 * 1024 * 1024 + 1);
  await withFetch(async () => response(oversized, "text/html"), async () => {
    const { fetchDocHtml } = loadSession();
    await assert.rejects(
      fetchDocHtml("regolamento", "fp", "https://docs.google.com/document/d/example/pub"),
      /Google Docs response rejected/
    );
  });
});

test("assets require raster image MIME and are capped using streamed bytes", async () => {
  for (const contentType of ["text/html", "image/svg+xml"]) {
    await withFetch(async () => response("bad", contentType), async () => {
      const { fetchDocAsset } = loadSession();
      await assert.rejects(
        fetchDocAsset("regolamento", "fp", "https://docs.google.com/docs-images-rt/key"),
        /Google Docs response rejected/
      );
    });
  }

  const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
  await withFetch(async () => response(oversized, "image/png"), async () => {
    const { fetchDocAsset } = loadSession();
    await assert.rejects(
      fetchDocAsset("regolamento", "fp", "https://docs.google.com/docs-images-rt/key"),
      /Google Docs response rejected/
    );
  });
});

function mockResponse() {
  return {
    headers: {},
    statusCode: 0,
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(value) { this.body = value; return this; },
    end() { return this; },
    json(value) { this.body = value; return this; },
  };
}

async function runHtmlHandler(apiPath) {
  const settingsPath = require.resolve("../lib/settings.cjs");
  const sessionPath = require.resolve("../lib/google-docs-session.cjs");
  const resolvedApi = require.resolve(apiPath);
  const saved = new Map([[settingsPath, require.cache[settingsPath]], [sessionPath, require.cache[sessionPath]]]);
  const field = apiPath.includes("regolamento") ? "regolamentoDocUrl" : "calendarioDocUrl";
  require.cache[settingsPath] = {
    id: settingsPath,
    filename: settingsPath,
    loaded: true,
    exports: { leagueId: () => "fp", readSettings: async () => ({ leagues: { fp: { [field]: "https://docs.google.com/document/d/example/pub" } } }) },
  };
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      publishedDocUrl: (url) => url,
      fetchDocHtml: async () => "<html><head></head><body></body></html>",
    },
  };
  delete require.cache[resolvedApi];
  const res = mockResponse();
  try {
    await require(apiPath)({ method: "GET", query: { league: "fp" } }, res);
    return res;
  } finally {
    delete require.cache[resolvedApi];
    for (const [key, value] of saved) {
      if (value) require.cache[key] = value;
      else delete require.cache[key];
    }
  }
}

test("both HTML proxies apply a restrictive CSP sandbox and no-store", async () => {
  for (const apiPath of ["../api/regolamento.js", "../api/calendario.js"]) {
    const res = await runHtmlHandler(apiPath);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Content-Security-Policy"], "sandbox");
    assert.doesNotMatch(res.headers["Content-Security-Policy"], /allow-(scripts|forms|popups|top-navigation)/);
    assert.match(res.headers["Cache-Control"], /no-store/);
  }
});
