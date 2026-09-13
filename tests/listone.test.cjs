"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { teamNamesFromAssets } = require("../lib/listone.cjs");

test("teamNamesFromAssets extracts unique sorted team names from assets", () => {
  const assets = [
    { ownerTag: "Paolo" },
    { ownerTag: "Luca" },
    { ownerTag: "Marco" },
    { ownerTag: "paolo" }
  ];
  const names = teamNamesFromAssets(assets);
  // The function does not normalize case, so "Paolo" and "paolo" are distinct
  assert.deepEqual(names, ["Luca", "Marco", "Paolo", "paolo"]);
});

test("teamNamesFromAssets returns empty array for empty assets", () => {
  assert.deepEqual(teamNamesFromAssets([]), []);
});

test("teamNamesFromAssets filters blank owner tags", () => {
  const assets = [
    { ownerTag: "Paolo" },
    { ownerTag: "" },
    { ownerTag: "  " },
    { ownerTag: null }
  ];
  const names = teamNamesFromAssets(assets);
  assert.deepEqual(names, ["Paolo"]);
});

test("teamNamesFromAssets uses Italian locale for sorting", () => {
  const assets = [
    { ownerTag: "Àngela" },
    { ownerTag: "Zorro" },
    { ownerTag: "Andrea" }
  ];
  const names = teamNamesFromAssets(assets);
  assert.deepEqual(names, ["Andrea", "Àngela", "Zorro"]);
});

test("loadLeagueAssets requires valid league ID", async () => {
  const { loadLeagueAssets } = require("../lib/listone.cjs");
  await assert.rejects(
    () => loadLeagueAssets("invalid"),
    /Lega non valida/
  );
});

test("fetchText rejects non-HTTPS and credentialed sources", async () => {
  const { fetchText } = require("../lib/listone.cjs");
  for (const url of ["http://example.com/list.csv", "https://user@example.com/list.csv", "bad-url"]) {
    await assert.rejects(fetchText(url), /URL|HTTPS|credenzial/i);
  }
});

test("fetchText uses the shared 2 MiB CSV/text transport", async (t) => {
  const safePath = require.resolve("../lib/safe-fetch.cjs");
  const listonePath = require.resolve("../lib/listone.cjs");
  const previousSafe = require.cache[safePath];
  const calls = [];
  require.cache[safePath] = {
    id: safePath,
    filename: safePath,
    loaded: true,
    exports: {
      safeFetch: async (url, options) => {
        calls.push({ url, options });
        return { body: Buffer.from("Tag,Ruolo,Nome,Squadra\n") };
      }
    }
  };
  delete require.cache[listonePath];
  t.after(() => {
    delete require.cache[listonePath];
    if (previousSafe) require.cache[safePath] = previousSafe;
    else delete require.cache[safePath];
  });

  const { fetchText } = require("../lib/listone.cjs");
  await fetchText("https://example.com/list.csv");
  assert.equal(calls[0].options.maxBytes, 2 * 1024 * 1024);
  assert.deepEqual(calls[0].options.allowedMimeTypes, ["text/csv", "text/plain"]);
});
