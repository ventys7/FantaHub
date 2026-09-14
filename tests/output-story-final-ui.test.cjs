const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function loadStory() {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      addEventListener() {},
      classList: { remove() {}, toggle() {} },
      disabled: false,
      hidden: false,
      removeAttribute(name) { if (name === "src") this.src = ""; },
      setAttribute() {},
      src: "",
      textContent: ""
    });
    return elements.get(id);
  };
  const gradient = { addColorStop() {} };
  const canvasContext = new Proxy({
    createLinearGradient: () => gradient,
    measureText: (text) => ({ width: String(text).length * 10 })
  }, {
    get(target, property) { return property in target ? target[property] : () => {}; }
  });
  const canvas = {
    getContext: () => canvasContext,
    toBlob: (callback) => callback({ type: "image/png" })
  };
  const created = [];
  const revoked = [];
  const URL = {
    createObjectURL() {
      const url = `blob:${created.length + 1}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (url) => revoked.push(url)
  };
  const model = {
    allowedModules: ["343", "352", "433", "442", "451", "532", "541"],
    bench: [],
    definitions: { bench: [], starter: [] },
    manager: "Paolo",
    module: "4-3-3",
    moduleRaw: "433",
    slots: { bench: {}, starter: {} },
    starters: [],
    team: []
  };
  const window = {
    FormationModel: { build: () => model },
    LINEUP_FANTA: { league: { id: "fp", name: "FP", theme: {} } },
    addEventListener() {},
    clearTimeout,
    matchMedia: () => ({ matches: false }),
    setTimeout
  };
  const context = {
    Date,
    File: class {},
    Image: class {},
    Intl,
    Map,
    Math,
    Promise,
    Set,
    URL,
    console,
    document: {
      body: { appendChild() {} },
      createElement: (tag) => tag === "canvas" ? canvas : element(tag),
      getElementById: element
    },
    navigator: { maxTouchPoints: 0, platform: "", userAgent: "" },
    requestAnimationFrame: (callback) => callback(),
    setModalOpen() {},
    showToast() {},
    window
  };
  vm.createContext(context);
  const source = read("js/story.js").replace(
    "return Object.freeze({ open, close });",
    "return Object.freeze({ open, close, currentUrl: () => currentUrl });"
  );
  vm.runInContext(source, context, { filename: "story.js" });
  return { created, elements, revoked, story: window.LineupStory, window };
}

test("Visualizza/Copia renders one direct output without format previews", () => {
  for (const file of ["index.html", "fp/index.html", "pd/index.html"]) {
    const html = read(file);
    assert.match(html, /id="outputText" readonly aria-label="Output formazione"/);
    assert.match(html, /id="copyOutputBtn"[^>]*>Copia formazione</);
    assert.doesNotMatch(html, /Anteprima per WhatsApp|Anteprima per Docs|Seleziona un’anteprima/);
  }

  const output = read("js/output.js");
  assert.match(output, /function buildOutputText\(\)/);
  assert.match(output, /renderOutput\(\);\s*toggleModal\(true\)/);
  assert.doesNotMatch(output, /buildWhatsAppOutput|buildDocsOutput|copyWhatsAppBtn|copyDocsBtn/);
});

test("9:16 cards keep role, portrait, player name and team in formation order", () => {
  const story = read("js/story.js");
  const shirt = story.slice(story.indexOf("function drawShirt"), story.indexOf("function drawStarterRows"));
  const role = shirt.indexOf("roleStyle.fill");
  const portrait = shirt.indexOf("portraitSize");
  const name = shirt.indexOf("const name =");
  const team = shirt.indexOf("const team =");

  assert.ok(role >= 0 && portrait > role && name > portrait && team > name);
  assert.match(shirt, /const height = 158|portraitY = y \+ 40/);
  assert.match(shirt, /centerX - 16, y \+ 10, 32, 22/);
  assert.match(shirt, /lastNameY \+ lineHeight \/ 2 \+ 8/);
});

test("formation role badges are slightly smaller and the unified text output is visually structured", () => {
  const css = read("css/formation-clean.css");
  const output = read("js/output.js");

  assert.match(css, /\.formation-shirt__role \{[\s\S]*?width: 21px;[\s\S]*?height: 18px;[\s\S]*?font-size: \.56rem;/);
  assert.match(output, /`Modulo \${model\.module}`/);
  assert.match(output, /XI TITOLARE/);
  assert.match(output, /"TOTALE:"/);
  assert.doesNotMatch(output, /- TOTALE:/);
  assert.match(output, /PANCHINA/);
  assert.match(output, /🟨 P|🟦 D|🟩 C|🟥 A/);
  assert.doesNotMatch(output, /⚽ FORMAZIONE/);
  assert.doesNotMatch(output, /━/);

  const xi = output.indexOf("XI TITOLARE");
  const totale = output.indexOf('"TOTALE:"');
  const panchina = output.indexOf("PANCHINA");
  assert.ok(xi >= 0 && totale > xi && panchina > totale);
});

test("standings keep inline penalties and remove the duplicate strip below the table", () => {
  const standings = read("dashboard/src/pages/Standings.tsx");
  const css = read("dashboard/src/styles/standings.css");

  assert.match(standings, /className="lf-standings-penalty"/);
  assert.doesNotMatch(standings, /lf-standings-penalty-note|penalizedTeams/);
  assert.doesNotMatch(css, /\.lf-standings-penalty-note/);
});

test("story preview revokes only its active object URL", async () => {
  const { created, elements, revoked, story } = loadStory();

  await story.open();
  const preview = elements.get("storyPreviewImage");
  assert.equal(preview.src, "blob:1");
  assert.equal(story.currentUrl(), "blob:1");

  story.close();
  assert.deepEqual(revoked, ["blob:1"]);
  assert.equal(preview.src, "");
  assert.equal(story.currentUrl(), null);

  story.close();
  assert.deepEqual(revoked, ["blob:1"]);

  await story.open();
  assert.deepEqual(created, ["blob:1", "blob:2"]);
  assert.deepEqual(revoked, ["blob:1"]);
  assert.equal(preview.src, "blob:2");

  story.close();
  assert.deepEqual(revoked, ["blob:1", "blob:2"]);
  assert.doesNotMatch(read("js/story.js"), /currentUrl \|\| URL\.createObjectURL/);
  assert.match(read("js/story.js"), /if \(temporaryUrl\) URL\.revokeObjectURL\(temporaryUrl\)/);
});

test("formation text output has no header or bars and totals between XI and bench", () => {
  const stubElement = () => ({
    addEventListener() {},
    cloneNode() { return stubElement(); },
    replaceWith() {}
  });
  const model = {
    manager: "Paolo",
    module: "3-4-3",
    goalkeeperBenchLabels: ["Crystal Palace"],
    starters: [
      { index: 0, player: { r: "P", n: "Henderson" } },
      { index: 1, player: { r: "D", n: "Gvardiol" } },
      { index: 2, player: { r: "A", n: "Rayan" } }
    ],
    bench: [
      { index: 3, player: { r: "D", n: "Mukiele" } },
      { index: 4, player: { r: "P", n: "Qualcuno" } }
    ]
  };
  const outputContext = {
    window: { FormationModel: { build: () => ({ ...model }) } },
    document: {
      body: { appendChild() {}, removeChild() {} },
      createElement: () => stubElement(),
      getElementById: () => stubElement()
    },
    navigator: {},
    console,
    showToast() {},
    setModalOpen() {},
    currentManager: "Paolo"
  };
  vm.createContext(outputContext);
  vm.runInContext(read("js/output.js"), outputContext, { filename: "output.js" });
  const text = vm.runInContext("buildOutputText()", outputContext);

  assert.equal(text, [
    "Modulo 3-4-3",
    "XI TITOLARE",
    "🟨 P  Henderson",
    "🟦 D  Gvardiol",
    "🟥 A  Rayan",
    "",
    "TOTALE:",
    "",
    "PANCHINA",
    "🟨 P  Crystal Palace",
    "🟦 D  Mukiele"
  ].join("\n"));
});

test("output and story validate Switch Plus against the complete formation model", async () => {
  const model = {
    allowedModules: ["343", "352", "433", "442", "451", "532", "541"],
    bench: [],
    moduleRaw: "433",
    starters: [],
    team: []
  };
  let outputSwitchInput = null;
  const outputContext = {
    window: {
      FormationModel: { build: () => model },
      LineupSwitch: {
        getPairForModel(input) {
          outputSwitchInput = input;
          return null;
        }
      }
    }
  };
  vm.createContext(outputContext);
  const outputSource = read("js/output.js");
  vm.runInContext(outputSource.slice(0, outputSource.indexOf("function getGoalkeeperBenchLabels")), outputContext);
  vm.runInContext("buildLineupModel()", outputContext);

  assert.equal(outputSwitchInput.moduleRaw, "433");
  assert.deepEqual(outputSwitchInput.allowedModules, model.allowedModules);

  const loaded = loadStory();
  let storySwitchInput = null;
  loaded.window.LineupSwitch = {
    getPairForModel(input) {
      storySwitchInput = input;
      return null;
    }
  };
  await loaded.story.open();

  assert.equal(storySwitchInput.moduleRaw, "433");
  assert.deepEqual(storySwitchInput.allowedModules, model.allowedModules);
});
