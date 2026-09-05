export type StandingRow = {
  position: number;
  team: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  fantasyPoints: number;
  played: number;
  penalty: number;
};

export type FantasyStandingRow = {
  position: number;
  team: string;
  fantasyPoints: number;
  leaguePosition: number | null;
};

export type StandingsData = {
  league: StandingRow[];
  fantasy: FantasyStandingRow[];
};

function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const text = String(csvText ?? "").replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function normalizeLabel(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTeamKey(value: string): string {
  return normalizeLabel(value)
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function parseNumber(value: string | undefined): number | null {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");

  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string | undefined): number | null {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function findHeaderIndex(row: string[], label: string, from = 0): number {
  const target = normalizeLabel(label);
  for (let index = from; index < row.length; index += 1) {
    if (normalizeLabel(row[index]) === target) return index;
  }
  return -1;
}

export function parseStandingsCsv(csvText: string): StandingsData {
  const rows = parseCsv(csvText);
  const requiredHeaders = [
    "Nome",
    "Punti",
    "Vittorie",
    "Pareggi",
    "Sconfitte",
    "Gol Fatti",
    "Gol Subiti",
    "Differenza Reti",
    "Fanta Punti"
  ];

  const primaryHeaderRowIndex = rows.findIndex((row) =>
    requiredHeaders.every((header) => findHeaderIndex(row, header) >= 0)
  );

  if (primaryHeaderRowIndex < 0) {
    throw new Error("Il CSV Classifica non contiene le colonne richieste.");
  }

  const primaryHeader = rows[primaryHeaderRowIndex];
  const indexes = {
    name: findHeaderIndex(primaryHeader, "Nome"),
    points: findHeaderIndex(primaryHeader, "Punti"),
    wins: findHeaderIndex(primaryHeader, "Vittorie"),
    draws: findHeaderIndex(primaryHeader, "Pareggi"),
    losses: findHeaderIndex(primaryHeader, "Sconfitte"),
    goalsFor: findHeaderIndex(primaryHeader, "Gol Fatti"),
    goalsAgainst: findHeaderIndex(primaryHeader, "Gol Subiti"),
    goalDifference: findHeaderIndex(primaryHeader, "Differenza Reti"),
    fantasyPoints: findHeaderIndex(primaryHeader, "Fanta Punti")
  };

  const primaryRows: Omit<StandingRow, "position" | "penalty">[] = [];

  for (const row of rows.slice(primaryHeaderRowIndex + 1)) {
    const name = String(row[indexes.name] ?? "").trim();
    const normalizedWholeRow = row.map(normalizeLabel).join("|");

    if (normalizedWholeRow.includes("classifica per fp")) break;
    if (!name) continue;

    // Celle vuote = 0: se il CSV è presente la classifica si mostra sempre,
    // anche a inizio stagione con sole righe squadra. Resta fuori solo chi
    // non ha nemmeno il nome.
    const wins = parseInteger(row[indexes.wins]) ?? 0;
    const draws = parseInteger(row[indexes.draws]) ?? 0;
    const losses = parseInteger(row[indexes.losses]) ?? 0;
    const goalsFor = parseInteger(row[indexes.goalsFor]) ?? 0;
    const goalsAgainst = parseInteger(row[indexes.goalsAgainst]) ?? 0;

    primaryRows.push({
      team: name,
      points: parseInteger(row[indexes.points]) ?? 0,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      goalDifference: parseInteger(row[indexes.goalDifference]) ?? goalsFor - goalsAgainst,
      fantasyPoints: parseNumber(row[indexes.fantasyPoints]) ?? 0,
      played: wins + draws + losses
    });
  }

  const secondaryTitleRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeLabel(cell) === "classifica per fp")
  );

  const penaltyByTeam = new Map<string, number>();
  const fantasyRowsRaw: Array<{ team: string; fantasyPoints: number }> = [];

  if (secondaryTitleRowIndex >= 0) {
    const secondaryHeaderRowIndex = rows.findIndex((row, index) => {
      if (index <= secondaryTitleRowIndex) return false;
      const normalized = row.map(normalizeLabel);
      return (
        normalized.filter((cell) => cell === "nome").length >= 2 &&
        normalized.includes("fanta punti") &&
        normalized.includes("penalita")
      );
    });

    if (secondaryHeaderRowIndex >= 0) {
      const header = rows[secondaryHeaderRowIndex];
      const fantasyNameIndex = findHeaderIndex(header, "Nome");
      const fantasyPointsIndex = findHeaderIndex(header, "Fanta Punti", fantasyNameIndex + 1);
      const penaltyNameIndex = findHeaderIndex(header, "Nome", fantasyPointsIndex + 1);
      const penaltyValueIndex = findHeaderIndex(header, "Penalità", penaltyNameIndex + 1);

      for (const row of rows.slice(secondaryHeaderRowIndex + 1)) {
        const fantasyTeam = String(row[fantasyNameIndex] ?? "").trim();
        const fantasyPoints = parseNumber(row[fantasyPointsIndex]);
        if (fantasyTeam && fantasyPoints !== null) {
          fantasyRowsRaw.push({ team: fantasyTeam, fantasyPoints });
        }

        const penaltyTeam = String(row[penaltyNameIndex] ?? "").trim();
        const penalty = parseNumber(row[penaltyValueIndex]);
        if (penaltyTeam && penalty !== null && penalty !== 0) {
          penaltyByTeam.set(normalizeTeamKey(penaltyTeam), Math.abs(penalty));
        }
      }
    }
  }

  const league: StandingRow[] = primaryRows.map((row, index) => ({
    ...row,
    position: index + 1,
    penalty: penaltyByTeam.get(normalizeTeamKey(row.team)) ?? 0
  }));

  const primaryByTeam = new Map(
    league.map((row) => [normalizeTeamKey(row.team), row] as const)
  );

  const fantasySource = fantasyRowsRaw.length > 0
    ? fantasyRowsRaw
    : league
      .map((row) => ({ team: row.team, fantasyPoints: row.fantasyPoints }))
      .sort((left, right) => right.fantasyPoints - left.fantasyPoints);

  const fantasy: FantasyStandingRow[] = fantasySource.map((row, index) => ({
    position: index + 1,
    team: row.team,
    fantasyPoints: row.fantasyPoints,
    leaguePosition: primaryByTeam.get(normalizeTeamKey(row.team))?.position ?? null
  }));

  return { league, fantasy };
}

export function formatStandingsNumber(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1
  }).format(value);
}

export function formatGoalDifference(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}
