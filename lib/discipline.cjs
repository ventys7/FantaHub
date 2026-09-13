"use strict";

const { safeFetch } = require("./safe-fetch.cjs");

const ENTITY_MAP = Object.freeze({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " });

function decodeEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITY_MAP[name.toLowerCase()] ?? match);
}

function stripInvisibleHtml(value) {
  return String(value || "")
    .replace(/<head\b[\s\S]*?<\/head>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "");
}

function plainText(value) {
  return decodeEntities(stripInvisibleHtml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|table|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function cleanLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isHeader(value, type) {
  const text = normalize(value).replace(/[^a-z]/g, "");
  return type === "recall" ? /^richiam/.test(text) : /^penalizz/.test(text);
}

function isGarbage(value) {
  const line = cleanLine(value);
  if (!line) return true;
  if (line.length > 450) return true;
  if (/^@import\b|^function\b|^var\b|^const\b|^let\b|^\/\*|copyright|sourcemappingurl|docs_install|_docs_|_f_toggles|closure_/i.test(line)) return true;
  if (/[{};]{3,}/.test(line)) return true;
  if (/prototype|object\.define|globalthis|array\.prototype|document\.addeventlistener/i.test(line)) return true;
  return false;
}

function extractDate(value) {
  const match = cleanLine(value).match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (!match) return "";
  return `${String(match[1]).padStart(2, "0")}/${String(match[2]).padStart(2, "0")}/${match[3]}`;
}

function managerName(value) {
  const text = cleanLine(value);
  const match = text.match(/\b(?:il|la)?\s*manager\s+(.+?)\s+(?:riceve|ha ricevuto|accumula|ottiene|subisce)\b/i);
  if (!match) return "";
  return cleanLine(match[1]).replace(/^[•·\-*–—\s]+/, "").slice(0, 100);
}

function negativeValue(value) {
  const match = String(value || "").replace(/−/g, "-").match(/(?:^|\s|\|)(-\d+(?:[.,]\d+)?)(?:\s|$|\|)/);
  if (!match) return null;
  const number = Number(match[1].replace(",", "."));
  return Number.isFinite(number) ? -Math.abs(number) : null;
}

function recallValue(value) {
  const text = cleanLine(value);
  const cumulative = text.match(/\((\d+)\s+richiam/i)?.[1] || text.match(/\b(\d+)\s+richiam/i)?.[1];
  return cumulative ? Math.max(1, Number(cumulative)) : 1;
}

function sentenceCase(value) {
  const text = cleanLine(value).replace(/^[,;:.\-–—\s]+|[,;:.\-–—\s]+$/g, "");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function cleanReason(value, name, type) {
  const escaped = String(name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let text = cleanLine(value)
    .replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–—]?\s*/i, "")
    .replace(new RegExp(`^(?:il|la)?\\s*manager\\s+${escaped}\\s+(?:riceve|ha ricevuto|accumula|ottiene|subisce)\\s*`, "i"), "")
    .replace(/^un\s+richiamo\s+per\s+/i, "")
    .replace(/^una?\s+penalizzazione(?:\s+di\s+-?\d+(?:[.,]\d+)?\s+punt[io])?\s*(?:per)?\s*/i, "")
    .replace(/^per\s+/i, "")
    .replace(/\(\s*\d+\s+richiam[oi]\s*\)\s*$/i, "")
    .replace(/\bentro i tempo prestabiliti\b/gi, "entro i tempi prestabiliti")
    .replace(/\s+/g, " ")
    .trim();

  if (/mancato inserimento dei voti/i.test(text)) return "Voti non inseriti entro il termine previsto";
  if (/mancato inserimento della formazione sul docs/i.test(text)) {
    return /12 ore/i.test(text) ? "Formazione non inserita nel documento entro 12 ore" : "Formazione non inserita nel documento";
  }
  if (/mancato inserimento della formazione/i.test(text)) return "Formazione non inviata entro la scadenza";
  if (!text || /^(?:un\s+richiamo|riceve)$/i.test(text)) return type === "penalty" ? "Penalizzazione disciplinare" : "Richiamo disciplinare";
  return sentenceCase(text);
}

function makeRecall(text) {
  const line = cleanLine(text);
  if (isGarbage(line) || !/\brichiam/i.test(line)) return null;
  const name = managerName(line);
  if (!name) return null;
  const date = extractDate(line);
  return { name, count: recallValue(line), date, reason: cleanReason(line, name, "recall"), note: line };
}

function makePenalty(text, numericHint = null) {
  const line = cleanLine(text);
  if (isGarbage(line)) return null;
  const name = managerName(line);
  if (!name) return null;
  const date = extractDate(line);
  let points = negativeValue(line);
  if (!Number.isFinite(points) && Number.isFinite(numericHint)) {
    const dateDay = Number(date.split("/")[0]);
    // Published Google Docs exposes hidden list anchors such as -25 beside an
    // entry dated 25/05. Ignore that anchor; a penalty without an explicit
    // trustworthy value is one point in this regulation.
    if (Math.abs(numericHint) !== dateDay) points = -Math.abs(numericHint);
  }
  if (!Number.isFinite(points)) points = -1;
  return { name, points, date, reason: cleanReason(line, name, "penalty"), note: line };
}

function parseRows(html) {
  const rows = [];
  for (const rowMatch of stripInvisibleHtml(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((match) => cleanLine(plainText(match[1])))
      .filter(Boolean);
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function collectFromRows(rows, recalls, penalties) {
  for (const cells of rows) {
    if (cells.some((cell) => isGarbage(cell))) continue;
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      if (!managerName(cell)) continue;
      const recall = makeRecall(cell);
      if (recall) { recalls.push(recall); continue; }
      const neighbors = [cells[index + 1], cells[index - 1]].filter(Boolean);
      const adjacent = neighbors.map(negativeValue).find(Number.isFinite);
      const penalty = makePenalty(cell, adjacent);
      if (penalty) penalties.push(penalty);
    }
  }
}

function collectFromText(html, recalls, penalties) {
  const lines = plainText(html).split(/\n+/).map(cleanLine).filter(Boolean);
  let section = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isGarbage(line)) continue;
    if (isHeader(line, "recall")) { section = "recall"; continue; }
    if (isHeader(line, "penalty")) { section = "penalty"; continue; }
    if (!section || !managerName(line)) continue;

    if (section === "recall") {
      const item = makeRecall(line);
      if (item) recalls.push(item);
      continue;
    }

    let numeric = negativeValue(line);
    if (!Number.isFinite(numeric)) {
      for (let offset = 1; offset <= 2; offset += 1) {
        const next = lines[index + offset];
        if (!next || isGarbage(next)) break;
        numeric = negativeValue(next);
        if (Number.isFinite(numeric)) { index += offset; break; }
        if (managerName(next) || isHeader(next, "recall") || isHeader(next, "penalty")) break;
      }
    }
    const item = makePenalty(line, numeric);
    if (item) penalties.push(item);
  }
}

function dedupe(items, valueKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${normalize(item.name)}|${item.date}|${item[valueKey]}|${normalize(item.note)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseDisciplineHtml(html) {
  const visible = stripInvisibleHtml(html);
  const recalls = [];
  const penalties = [];
  collectFromRows(parseRows(visible), recalls, penalties);
  if (!recalls.length && !penalties.length) collectFromText(visible, recalls, penalties);
  return {
    recalls: dedupe(recalls, "count"),
    penalties: dedupe(penalties, "points")
  };
}

function normalizePublishedDocUrl(rawUrl) {
  const raw = String(rawUrl || "").trim().replace(/\/pubva(?:\?.*)?$/i, "/pub");
  if (!raw) return "";
  let url;
  try { url = new URL(raw); }
  catch { return ""; }
  if (url.hostname === "docs.google.com") {
    url.pathname = url.pathname.replace(/\/edit(?:\/.*)?$/i, "/pub");
    url.search = "";
  }
  return url.toString();
}

async function loadDiscipline(url) {
  if (!url) return { recalls: [], penalties: [] };
  const response = await safeFetch(normalizePublishedDocUrl(url), {
    timeoutMs: 12000,
    maxBytes: 2 * 1024 * 1024,
    allowedMimeTypes: ["text/html"],
    headers: { Accept: "text/html" }
  });
  return parseDisciplineHtml(response.body.toString("utf8"));
}

module.exports = { loadDiscipline, normalizePublishedDocUrl, parseDisciplineHtml };
