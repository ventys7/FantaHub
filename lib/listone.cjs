"use strict";

const { parseLeagueCsv } = require("../js/csv-parser.js");
const { leagueId, readSettings } = require("./settings.cjs");
const { safeFetch } = require("./safe-fetch.cjs");

async function fetchText(url, timeoutMs = 12000) {
  const response = await safeFetch(url, {
    timeoutMs,
    maxBytes: 2 * 1024 * 1024,
    allowedMimeTypes: ["text/csv", "text/plain"],
    headers: { Accept: "text/csv,text/plain;q=0.9" }
  });
  const text = response.body.toString("utf8");
  if (/^\s*<!doctype html/i.test(text)) throw new Error("La fonte ha restituito HTML invece del CSV");
  return text;
}

async function loadLeagueAssets(rawLeagueId) {
  const id = leagueId(rawLeagueId);
  const settings = await readSettings();
  const url = settings.leagues[id].listoneCsvUrl;
  if (!url) return { assets: [], csvText: "", url: "" };
  const csvText = await fetchText(url);
  return { ...parseLeagueCsv(csvText, { extraSlots: id === "fp" }), csvText, url };
}

function teamNamesFromAssets(assets) {
  return [...new Set(assets.map((asset) => String(asset.ownerTag || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
}

module.exports = { fetchText, loadLeagueAssets, teamNamesFromAssets };
