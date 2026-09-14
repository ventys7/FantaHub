(function exposeCsvParser(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LineupCsvParser = api;
})(typeof window === "undefined" ? null : window, function createCsvParser() {
  "use strict";

  const ROLE_MAP = Object.freeze({
    portieri: "P", portiere: "P", por: "P", goalkeeper: "P", goalkeepers: "P", gk: "P", p: "P",
    difensore: "D", difensori: "D", dif: "D", defender: "D", defenders: "D", def: "D", d: "D",
    centrocampista: "C", centrocampisti: "C", cen: "C", midfielder: "C", midfielders: "C", mid: "C", c: "C",
    attaccante: "A", attaccanti: "A", att: "A", forward: "A", forwards: "A", striker: "A", strikers: "A", fw: "A", a: "A"
  });

  const HEADER_ALIASES = Object.freeze({
    assetCode: ["asset_code", "assetcode", "codice_asset", "codice", "code", "id"],
    displayName: ["display_name", "displayname", "nome", "player", "giocatore", "name"],
    docsName: ["docs_name", "docsname", "nome_docs", "nome_documenti"],
    role: ["role", "ruolo", "posizione"],
    realTeam: ["real_team", "realteam", "squadra_reale", "squadra", "club"],
    quotation: ["quotation", "quotazione", "budget", "credito", "crediti", "cr"],
    purchasePrice: ["purchase_price", "purchaseprice", "prezzo_acquisto", "prezzoacquisto", "costo_acquisto", "costo"],
    ownerTag: ["owner_tag", "ownertag", "tag", "manager", "partecipante", "owner", "proprietario", "fantasquadra", "team"],
    type: ["type", "tipo", "asset_type"],
    active: ["active", "attivo", "attiva", "stato"]
  });

  const FREE_AGENT_LABELS = new Set([
    "", "svincolato", "svincolati", "libero", "liberi", "free", "free_agent", "freeagent"
  ]);
  const IGNORED_OWNER_LABELS = new Set(["tag", "ricordi"]);
  const EXTRA_PREFIX = /^\s*\[\s*e\s*\]\s*/i;

  function normalizeToken(value) {
    return String(value ?? "")
      .replace(/^\uFEFF/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function countDelimiterOutsideQuotes(line, delimiter) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted && char === delimiter) count += 1;
    }
    return count;
  }

  function detectDelimiter(line) {
    return countDelimiterOutsideQuotes(line, ";") > countDelimiterOutsideQuotes(line, ",")
      ? ";"
      : ",";
  }

  function splitLine(line, delimiter = detectDelimiter(line)) {
    const values = [];
    let current = "";
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        values.push(current.trim());
        current = "";
      } else current += char;
    }

    values.push(current.trim());
    return values;
  }

  function createHeaderMap(columns) {
    const normalized = columns.map(normalizeToken);
    const headerMap = {};

    Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
      const accepted = new Set(aliases.map(normalizeToken));
      const index = normalized.findIndex((header) => accepted.has(header));
      if (index !== -1) headerMap[field] = index;
    });

    const hasHeader = Object.keys(headerMap).length >= 2 && (
      headerMap.displayName !== undefined
      || headerMap.role !== undefined
      || headerMap.ownerTag !== undefined
    );
    return { hasHeader, headerMap };
  }

  function readColumn(columns, headerMap, field, fallbackIndex) {
    const index = headerMap[field] ?? fallbackIndex;
    return index === undefined ? "" : String(columns[index] ?? "").trim();
  }

  function normalizeRole(value) {
    const key = normalizeToken(value);
    if (!key) return "U";
    if (ROLE_MAP[key]) return ROLE_MAP[key];
    const upper = String(value).trim().toUpperCase();
    return ["P", "D", "C", "A"].includes(upper) ? upper : "U";
  }

  function parseNumber(value, fallback) {
    const raw = String(value ?? "").trim();
    if (!raw || !/^[+-]?\d+(?:[.,]\d+)?$/.test(raw)) return fallback;
    const number = Number(raw.replace(",", "."));
    return Number.isFinite(number) ? number : fallback;
  }

  function parseActive(value) {
    const normalized = normalizeToken(value);
    return !normalized || !new Set([
      "false", "0", "no", "n", "inactive", "inattivo", "inattiva", "disattivato", "disattivata"
    ]).has(normalized);
  }

  function normalizeAssetType(value, role, displayName) {
    const normalized = normalizeToken(value);
    const goalkeeperBlock = [
      "goalkeeper_block", "goalkeeperblock", "blocco_portieri", "blocco_portiere"
    ].includes(normalized) || (role === "P" && /\s+-\s+/.test(displayName));
    return goalkeeperBlock ? "goalkeeper_block" : (normalized || "player");
  }

  function fallbackAssetCode(role, displayName, sourceIndex) {
    const slug = normalizeToken(displayName).replace(/_/g, "-") || "asset";
    return `${role || "U"}-${slug}-${sourceIndex}`.toUpperCase();
  }

  function normalizeOwner(ownerRaw, role, extraSlots) {
    const hasExtraPrefix = Boolean(extraSlots && EXTRA_PREFIX.test(ownerRaw));
    const ownerTag = hasExtraPrefix
      ? ownerRaw.replace(EXTRA_PREFIX, "").trim()
      : ownerRaw;
    return { ownerTag, isExtra: hasExtraPrefix && ["D", "C", "A"].includes(role) };
  }

  function normalizeAsset(columns, headerMap, sourceIndex, extraSlots) {
    const ownerRaw = readColumn(columns, headerMap, "ownerTag", 0);
    const role = normalizeRole(readColumn(columns, headerMap, "role", 1));
    const { ownerTag, isExtra } = normalizeOwner(ownerRaw, role, extraSlots);
    const ownerKey = normalizeToken(ownerTag);
    if (IGNORED_OWNER_LABELS.has(ownerKey)) return null;

    const displayName = readColumn(columns, headerMap, "displayName", 2);
    const realTeam = readColumn(columns, headerMap, "realTeam", 3);
    if (!displayName) return null;

    const isFreeAgent = FREE_AGENT_LABELS.has(ownerKey);
    const assetCode = readColumn(columns, headerMap, "assetCode");

    return Object.freeze({
      assetCode: assetCode || fallbackAssetCode(role, displayName, sourceIndex),
      displayName,
      docsName: readColumn(columns, headerMap, "docsName") || displayName,
      role,
      realTeam,
      quotation: parseNumber(readColumn(columns, headerMap, "quotation", 4), 0),
      purchasePrice: parseNumber(readColumn(columns, headerMap, "purchasePrice", 5), 0),
      ownerTag: isFreeAgent ? "" : ownerTag,
      managerCredits: null,
      type: normalizeAssetType(readColumn(columns, headerMap, "type"), role, displayName),
      active: parseActive(readColumn(columns, headerMap, "active")),
      isExtra,
      isFreeAgent,
      sourceIndex
    });
  }

  function findHeader(lines) {
    for (let index = 0; index < Math.min(lines.length, 30); index += 1) {
      for (const delimiter of [",", ";"]) {
        const { hasHeader, headerMap } = createHeaderMap(splitLine(lines[index], delimiter));
        const required = ["ownerTag", "role", "displayName", "realTeam"];
        if (hasHeader && required.every((field) => headerMap[field] !== undefined)) {
          return { index, delimiter, headerMap };
        }
      }
    }
    return null;
  }

  function parseManagerCredits(lines, delimiter) {
    const credits = new Map();
    for (let rowIndex = 7; rowIndex < lines.length; rowIndex += 1) {
      const columns = splitLine(lines[rowIndex], delimiter);
      const managerKey = normalizeToken(columns[14]);
      const value = parseNumber(columns[15], null);
      if (managerKey && value !== null) credits.set(managerKey, value);
    }
    return credits;
  }

  function parseLeagueCsv(csvText, options = {}) {
    const lines = String(csvText ?? "").split(/\r?\n/);
    if (!lines.some((line) => line.trim())) throw new Error("CSV vuoto");

    const header = findHeader(lines);
    const firstMeaningful = lines.findIndex((line) => line.trim());
    const delimiter = header?.delimiter ?? detectDelimiter(lines[firstMeaningful]);
    const headerMap = header?.headerMap ?? {};
    const startIndex = header ? header.index + 1 : firstMeaningful;
    const sourceOffset = startIndex + 1;
    const creditsByManager = parseManagerCredits(lines, delimiter);
    const extraSlots = Boolean(options.extraSlots);

    const assets = lines.slice(startIndex)
      .map((line, index) => normalizeAsset(splitLine(line, delimiter), headerMap, index + sourceOffset, extraSlots))
      .filter(Boolean)
      .map((asset) => Object.freeze({
        ...asset,
        managerCredits: asset.ownerTag
          ? creditsByManager.get(normalizeToken(asset.ownerTag)) ?? null
          : null
      }));

    return { assets, creditsByManager };
  }

  return Object.freeze({
    detectDelimiter,
    normalizeToken,
    parseLeagueCsv,
    splitLine
  });
});
