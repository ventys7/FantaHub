"use strict";

// Test unitari del FaceBridge (nessuna rete reale: global.fetch e' mockato).
// Coperta la catena: A-exact -> A-surname -> B-full -> B-surname+team,
// il retry sul 429 di Wikimedia e la cache condivisa.

const test = require("node:test");
const assert = require("node:assert/strict");
const { lookupFace, flushCache, normalizeName } = require("../lib/media/face-bridge.cjs");

function wikiPayload(pages) {
  const out = { query: { pages: {} } };
  pages.forEach((page, idx) => {
    out.query.pages[String(page.pageid)] = {
      pageid: page.pageid,
      title: page.title,
      index: page.index ?? idx + 1,
      ...(page.extract !== undefined ? { extract: page.extract } : {}),
      ...(page.thumbnail ? { thumbnail: { source: page.thumbnail, width: 600, height: 600 } } : {})
    };
  });
  return out;
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "1" },
    json: async () => payload
  };
}

// Stub globale di fetch: ogni elemento di urlQueue risponde alla chiamata i-esima.
async function withFetch(urlQueue, handler) {
  const originalFetch = global.fetch;
  let next = 0;
  global.fetch = async (url) => {
    const entry = urlQueue[next++];
    if (entry === undefined) throw new Error(`fetch non previsto: ${url}`);
    return typeof entry === "function" ? entry(url) : entry;
  };
  try {
    return await handler();
  } finally {
    global.fetch = originalFetch;
  }
}

test("normalizeName strips diacritics", () => {
  assert.equal(normalizeName("Viktor Gyökeres"), "viktor gyokeres");
  assert.equal(normalizeName("Diego-Mario"), "diego mario");
});

test("A-exact: titolo Wikipedia esatto vince con una sola chiamata", async () => {
  await withFetch([
    () => jsonResponse(200, wikiPayload([
      {
        pageid: 1,
        title: "Marcus Rashford",
        extract: "Marcus Rashford is an English professional footballer.",
        thumbnail: "https://upload.example.com/rashford.jpg"
      }
    ]))
  ], async () => {
    const hit = await lookupFace("Marcus Rashford", "Manchester United");
    assert.equal(hit.source, "wikimedia");
    assert.equal(hit.tier, "exact");
    assert.equal(hit.url, "https://upload.example.com/rashford.jpg");
  });
});

test("A-surname: dopo il miss esatto si passa al cognome con estratto da calciatore", async () => {
  await withFetch([
    () => jsonResponse(200, wikiPayload([])),
    () => jsonResponse(200, wikiPayload([
      {
        pageid: 2,
        title: "Zinédine Zidane",
        extract: "Zinédine Zidane is a French former footballer and manager.",
        thumbnail: "https://upload.example.com/zidane.jpg"
      }
    ]))
  ], async () => {
    const hit = await lookupFace("Zinedine Zidane", "");
    assert.equal(hit.source, "wikimedia");
    assert.equal(hit.tier, "surname");
    assert.equal(hit.url, "https://upload.example.com/zidane.jpg");
  });
});

test("A-surname: estratto che non cita un calciatore -> nessun hit", async () => {
  await withFetch([
    () => jsonResponse(200, wikiPayload([])),
    () => jsonResponse(200, wikiPayload([
      {
        pageid: 3,
        title: "Giovanni Ferrari",
        extract: "Giovanni Ferrari is an Italian painter and politician.",
        thumbnail: "https://upload.example.com/ferrari.jpg"
      }
    ])),
    // TheSportsDB: nessun risultato per il cognome
    () => jsonResponse(200, { player: [] })
  ], async () => {
    const hit = await lookupFace("Giovanni Ferrari", "Bologna");
    assert.equal(hit, null);
  });
});

test("A-exact: il 429 di Wikipedia ritenta con backoff e poi risolve", async () => {
  await withFetch([
    () => jsonResponse(429, {}),
    () => jsonResponse(200, wikiPayload([
      {
        pageid: 4,
        title: "Erling Haaland",
        extract: "Erling Haaland is a Norwegian professional footballer.",
        thumbnail: "https://upload.example.com/haaland.jpg"
      }
    ]))
  ], async () => {
    const hit = await lookupFace("Erling Haaland", "Manchester City");
    assert.equal(hit.tier, "exact");
  });
});

test("B-full: TheSportsDB cutout quando Wikipedia non trova nulla", async () => {
  await withFetch([
    () => jsonResponse(200, wikiPayload([])),
    () => jsonResponse(200, wikiPayload([])), // nemmeno per cognome
    () => jsonResponse(200, {
      player: [
        {
          strPlayer: "Emiliano Martínez",
          strTeam: "Aston Villa",
          strCutout: "https://cdn.thesportsdb.com/martinez.png"
        }
      ]
    })
  ], async () => {
    const hit = await lookupFace("Emiliano Martinez", "Aston Villa");
    assert.equal(hit.source, "thesportsdb");
    assert.equal(hit.tier, "exact");
    assert.equal(hit.type, "cutout");
  });
});

test("A-surname: estratto non calcistico respinto (tema biblico/pittorico)", async () => {
  await withFetch([
    () => jsonResponse(200, wikiPayload([])),
    () => jsonResponse(200, wikiPayload([
      {
        pageid: 3,
        title: "Gabriel",
        extract: "In the Abrahamic religions, Gabriel is an archangel...",
        thumbnail: "https://upload.example.com/ghent-altarpiece.jpg"
      }
    ])),
    // TheSportsDB: nessun risultato
    () => jsonResponse(200, { player: [] })
  ], async () => {
    const hit = await lookupFace("Gabriel", "Arsenal");
    assert.equal(hit, null);
  });
});

test("A-exact a un token: titolo esatto ambiguo richiede estratto calcistico", async () => {
  await withFetch([
    () => jsonResponse(200, wikiPayload([
      {
        pageid: 6,
        title: "Gabriel",
        extract: "Gabriel is an archangel in the Abrahamic religions.",
        thumbnail: "https://upload.example.com/gabriel-angel.jpg"
      }
    ])),
    () => jsonResponse(200, { player: [] })
  ], async () => {
    const hit = await lookupFace("Gabriel", "Arsenal");
    assert.equal(hit, null);
  });
});

test("A-exact a nome multi-token non richiede estratto (titolo disambigua)", async () => {
  await withFetch([
    () => jsonResponse(200, wikiPayload([
      {
        pageid: 7,
        title: "Gabriel Jesus",
        extract: "Gabriel Jesus is a Brazilian professional footballer.",
        thumbnail: "https://upload.example.com/gabriel-jesus.jpg"
      }
    ]))
  ], async () => {
    const hit = await lookupFace("Gabriel Jesus", "Arsenal");
    assert.equal(hit.tier, "exact");
  });
});

test("B-surname: senza match di squadra non si accetta il falso positivo", async () => {
  await withFetch([
    () => jsonResponse(200, wikiPayload([])),
    () => jsonResponse(200, wikiPayload([])),
    () => jsonResponse(200, {
      player: [
        {
          strPlayer: "Jorge Fernández",
          strTeam: "Boca Juniors",
          strCutout: "https://cdn.thesportsdb.com/fernandez.png"
        }
      ]
    })
  ], async () => {
    const hit = await lookupFace("Juan Fernández", "Real Madrid");
    assert.equal(hit, null);
  });
});

test("la cache condivisa evita richieste duplicate", async () => {
  flushCache();
  let calls = 0;
  await withFetch([
    () => {
      calls += 1;
      return jsonResponse(200, wikiPayload([
        {
          pageid: 5,
          title: "Kolo Touré",
          extract: "Kolo Touré is an Ivorian professional footballer.",
          thumbnail: "//upload.example.com/kolo.jpg"
        }
      ]));
    }
  ], async () => {
    const first = await lookupFace("Kolo Toure", "Arsenal");
    const second = await lookupFace("Kolo Toure", "Arsenal");
    assert.equal(first.url, "https://upload.example.com/kolo.jpg");
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
  });
  flushCache();
});

test("missing name restituisce null senza network", async () => {
  flushCache();
  const hit = await lookupFace("", "Fake FC");
  assert.equal(hit, null);
  flushCache();
});