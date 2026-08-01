const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

/* Minimal DOM stub sufficient to exercise renderSwitchPicker. */
function makeEl(tag) {
  return {
    tagName: tag.toUpperCase(),
    className: "",
    style: {},
    textContent: "",
    children: [],
    onclick: null,
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(node) {
      this.children.push(node);
      return node;
    },
    replaceChildren() {
      this.children = [];
    },
  };
}

function loadSwitchModals() {
  const source = fs.readFileSync(path.join(root, "js/switch-modals.js"), "utf8");

  global.document = { createElement: makeEl };
  global.roleColors = { P: "#111111", D: "#222222", C: "#333333", A: "#444444" };
  global.createPickerPhoto = (player) => {
    const el = makeEl("div");
    el.photoOf = player.n;
    return el;
  };
  global.window = {};
  global.setModalOpen = () => {};
  global.currentManager = undefined;
  global.db = {};

  vm.runInThisContext(source);
}

function rowsOf(listEl) {
  return listEl.children.filter(
    (child) => child.className.includes("picker-player") && !child.className.includes("in-slot")
  );
}

test("renderSwitchPicker: selezione fuori dai filtri mostra la card con ✕ e onClear parte al click", () => {
  loadSwitchModals();

  const listEl = makeEl("div");
  const entries = [
    { index: 0, player: { n: "Barella", r: "C", t: "Inter" } },
    { index: 1, player: { n: "Theo", r: "D", t: "Milan" } },
  ];
  let cleared = false;
  let selected = null;

  renderSwitchPicker(
    listEl,
    entries,
    { index: 7, player: { n: "Messi", r: "A", t: "Inter" } }, // index 7 non è in entries
    (index) => {
      selected = index;
    },
    () => {
      cleared = true;
    }
  );

  assert.equal(listEl.children.length, 3, "card selezione + 2 righe");

  const card = listEl.children[0];
  assert.equal(card.className, "picker-player in-slot");
  assert.ok(card.children.some((el) => el.className === "picker-remove-btn"), "✕ presente");
  const cardInfo = card.children.find((el) => el.className === "player-info");
  assert.equal(cardInfo.children[0].textContent, "Messi");
  assert.equal(card.children.find((el) => el.className === "badge").style.background, "#444444");
  assert.equal(card.children.find((el) => el.photoOf).photoOf, "Messi", "faccetta presente");

  // click sulla card → clear, non select
  card.onclick();
  assert.equal(cleared, true);
  assert.equal(selected, null);

  // click su una riga → select con index giusto
  rowsOf(listEl)[0].onclick();
  assert.equal(selected, 0);
});

test("renderSwitchPicker: senza selezione non c'è card ✕ e nessuna riga è marcata selected", () => {
  loadSwitchModals();

  const listEl = makeEl("div");
  const entries = [
    { index: 0, player: { n: "Barella", r: "C", t: "Inter" } },
    { index: 1, player: { n: "Theo", r: "D", t: "Milan" } },
  ];

  renderSwitchPicker(listEl, entries, null, () => {}, () => {});

  assert.equal(listEl.children.length, 2, "solo le righe, nessuna card");
  assert.ok(rowsOf(listEl).every((row) => !row.className.includes(" in-slot")));
  assert.ok(rowsOf(listEl).every((row) => !row.className.includes("selected")));
});

test("renderSwitchPicker: riga selezionata presente nei filtri → classe selected e ✓", () => {
  loadSwitchModals();

  const listEl = makeEl("div");
  const entries = [
    { index: 0, player: { n: "Barella", r: "C", t: "Inter" } },
    { index: 1, player: { n: "Theo", r: "D", t: "Milan" } },
  ];

  renderSwitchPicker(listEl, entries, { index: 1, player: entries[1].player }, () => {}, () => {});

  assert.equal(listEl.children.length, 3, "card + 2 righe");
  const rows = rowsOf(listEl);
  assert.equal(rows[0].className, "picker-player");
  assert.equal(rows[1].className, "picker-player selected");
  assert.equal(rows[1].children.at(-1).textContent, "✓");
});

test("renderSwitchPicker: lista vuota con selezione → card ✕ + messaggio vuoto", () => {
  loadSwitchModals();

  const listEl = makeEl("div");
  let cleared = false;

  renderSwitchPicker(
    listEl,
    [],
    { index: 2, player: { n: "Dybala", r: "A", t: "Roma" } },
    () => {},
    () => {
      cleared = true;
    }
  );

  assert.equal(listEl.children.length, 2, "card + messaggio");
  assert.equal(listEl.children[0].className, "picker-player in-slot");
  assert.equal(listEl.children[1].textContent, "Nessun calciatore disponibile");

  listEl.children[0].onclick();
  assert.equal(cleared, true);
});

test("renderSwitchPicker: ruolo sconosciuto usa il fallback rosso", () => {
  loadSwitchModals();

  const listEl = makeEl("div");
  renderSwitchPicker(listEl, [{ index: 0, player: { n: "X", r: "ZZ", t: "" } }], null, () => {}, () => {});

  const badge = listEl.children[0].children.find((el) => el.className === "badge");
  assert.equal(badge.style.background, "#dc3545");
  assert.equal(badge.textContent, "ZZ");
});
