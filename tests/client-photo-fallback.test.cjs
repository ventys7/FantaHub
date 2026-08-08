"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("player-media exposes the shared guardPhoto helper with an error handler", () => {
  const media = source("js/player-media.js");
  assert.match(media, /function guardPhoto\(image/);
  assert.match(media, /addEventListener\("error"/);
  assert.match(media, /LineupPlayerMedia = Object\.freeze\([\s\S]*guardPhoto[,}\s]/);
});

test("every player <img> call site wires the photo fallback (roster, picker, gk-modal, slots-render)", () => {
  const roster = source("js/roster.js");
  assert.match(roster, /guardPhoto\?\.\(image, \{ fallbackText: mediaLetter, mediaNode: media \}\)/);
  assert.match(roster, /media\.textContent = mediaLetter;/);

  const picker = source("js/picker.js");
  assert.match(picker, /guardPhoto\?\.\(image, \{ fallbackText: letter, mediaNode: portrait \}\)/);
  assert.match(picker, /portrait\.textContent = letter;/);

  const gkModal = source("js/gk-modal.js");
  assert.match(gkModal, /guardPhoto\?\.\(image, \{ fallbackText: "P", mediaNode: photo \}\)/);

  const slots = source("js/slots-render.js");
  assert.match(slots, /guardPhoto\?\.\(image, \{/);
  assert.match(slots, /onError: \(\) => \{/);
  assert.match(slots, /portrait\.hidden = true;/);
  assert.match(slots, /formation-shirt--has-photo/);
});

test("admin candidate thumbnails get a letter fallback via an image error listener", () => {
  const admin = source("js/admin-links.js");
  assert.match(admin, /createElement\("img"\)/);
  assert.match(admin, /image\.addEventListener\("error"/);
  assert.match(admin, /candidate-thumb-fallback/);
  const css = source("css/admin-links.css");
  assert.match(css, /\.candidate-thumb-fallback \{/);
});

test("admin media status handles a degraded player-media payload", () => {
  const admin = source("js/admin-links.js");
  assert.match(admin, /DEGRADED_MEDIA_MESSAGE/);
  assert.match(admin, /non raggiungibile/i);
  assert.match(admin, /manifest\?\.degraded/);
  assert.match(admin, /degradedMessage/);
  assert.match(admin, /Sorgente foto \(BSD\) NON raggiungibile: sono mostrati i dati dell'ultima sincronizzazione riuscita/);
  assert.match(admin, /da controllare/);
});

test("admin refresh stays JSON/200 driven and never leaves the button spinning on degraded response", () => {
  const admin = source("js/admin-links.js");
  assert.match(admin, /result\?\.manifest\?\.degraded/);
  assert.match(admin, /setMediaButtonsDisabled\(false\)/);
  assert.match(admin, /DEGRADED_MEDIA_MESSAGE/);
});