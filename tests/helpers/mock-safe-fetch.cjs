"use strict";

const path = require("node:path");

function installSafeFetchMock(root) {
  const safeFetchPath = require.resolve(path.join(root, "lib", "safe-fetch.cjs"));
  require.cache[safeFetchPath] = {
    id: safeFetchPath,
    filename: safeFetchPath,
    loaded: true,
    exports: {
      safeFetch: async (url) => {
        const response = await global.fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return {
          body: Buffer.from(await response.arrayBuffer()),
          mimeType: String(response.headers.get("content-type") || "").split(";", 1)[0]
        };
      }
    }
  };
}

module.exports = { installSafeFetchMock };
