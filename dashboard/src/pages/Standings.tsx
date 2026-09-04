import { useMemo, useState } from "react";
import {
  formatGoalDifference,
  formatStandingsNumber,
  type StandingRow,
  type StandingsData
} from "../standings";

type StandingsMode = "league" | "fantasy";
type SortKey = "goalsFor" | "goalsAgainst";
type SortDirection = "desc" | "asc";
type SortState = { key: SortKey; direction: SortDirection } | null;

interface StandingsProps {
  data: StandingsData;
  leagueName: string;
  teamLogos?: Record<string, string>;
  teamNames?: Record<string, string>;
}

function normalizeTeamName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}

function TeamCell({ team, teamLogos = {}, teamNames = {}, penalty = 0 }: { team: string; teamLogos?: Record<string, string>; teamNames?: Record<string, string>; penalty?: number }) {
  const displayName = teamNames[normalizeTeamName(team)] || "";
  const shownName = displayName || team;
  const initial = shownName.trim().charAt(0).toUpperCase() || "?";
  const logoUrl = teamLogos[normalizeTeamName(team)] || "";

  return (
    <div className="lf-standings-team-cell">
      <span className={`lf-standings-team-mark ${logoUrl ? "has-logo" : ""}`} aria-hidden="true">
        {logoUrl ? <img src={logoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : initial}
      </span>
      <span className="lf-standings-team-names">
        <strong>{shownName}</strong>
        {displayName && <small className="lf-standings-team-sub">{team}</small>}
      </span>
      {penalty > 0 && <span className="lf-standings-penalty" title={`${penalty} ${penalty === 1 ? "punto" : "punti"} di penalizzazione`}>−{penalty}</span>}
    </div>
  );
}

function sortRows(rows: StandingRow[], sort: SortState): StandingRow[] {
  if (!sort) return rows;

  return [...rows].sort((left, right) => {
    const difference = sort.direction === "desc"
      ? right[sort.key] - left[sort.key]
      : left[sort.key] - right[sort.key];

    return difference || left.position - right.position;
  });
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  const ariaSort = active
    ? sort.direction === "desc" ? "descending" : "ascending"
    : "none";
  const directionLabel = active
    ? sort.direction === "desc" ? "decrescente" : "crescente"
    : "ordine classifica";

  return (
    <th scope="col" aria-sort={ariaSort} className={active ? "is-sorted" : ""}>
      <button
        type="button"
        className="lf-standings-sort-button"
        onClick={() => onSort(sortKey)}
        title={`${label}: ${directionLabel}`}
        aria-label={`Ordina ${label}. Stato attuale: ${directionLabel}.`}
      >
        <span>{label}</span>
        <span className="lf-standings-sort-icon" aria-hidden="true">
          {active ? sort.direction === "desc" ? "↓" : "↑" : "↕"}
        </span>
      </button>
    </th>
  );
}

export function Standings({ data, leagueName, teamLogos = {}, teamNames = {} }: StandingsProps) {
  const [mode, setMode] = useState<StandingsMode>("league");
  const [sort, setSort] = useState<SortState>(null);

  const displayedLeague = useMemo(
    () => sortRows(data.league, sort),
    [data.league, sort]
  );

  function cycleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "desc" };
      }

      if (current.direction === "desc") {
        return { key, direction: "asc" };
      }

      return null;
    });
  }

  if (data.league.length === 0) {
    return (
      <div className="lf-standings-shell">
        <section className="lf-dashboard-card lf-standings-state">
          <strong>Classifica non ancora disponibile</strong>
          <p>La fonte di {leagueName} non è stata ancora configurata.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="lf-standings-shell">
      <section className="lf-dashboard-card lf-standings-card">
        <div className="lf-standings-toolbar" role="tablist" aria-label="Tipo di classifica">
          <button
            type="button"
            className={mode === "league" ? "is-active" : ""}
            role="tab"
            aria-selected={mode === "league"}
            onClick={() => setMode("league")}
          >
            Classifica
          </button>
          <button
            type="button"
            className={mode === "fantasy" ? "is-active" : ""}
            role="tab"
            aria-selected={mode === "fantasy"}
            onClick={() => setMode("fantasy")}
          >
            Fanta punti
          </button>
        </div>

        {mode === "league" ? (
          <>
          <div className="lf-standings-table-wrap" role="region" aria-label="Classifica generale" tabIndex={0}>
            <table className="lf-standings-table">
              <thead>
                <tr>
                  <th className="lf-standings-rank-col" scope="col">#</th>
                  <th className="lf-standings-team-col" scope="col">Squadra</th>
                  <th className="is-points" scope="col">Pt</th>
                  <th scope="col">G</th>
                  <th scope="col">V</th>
                  <th scope="col">N</th>
                  <th scope="col">P</th>
                  <SortableHeader label="GF" sortKey="goalsFor" sort={sort} onSort={cycleSort} />
                  <SortableHeader label="GS" sortKey="goalsAgainst" sort={sort} onSort={cycleSort} />
                  <th scope="col">DR</th>
                  <th scope="col">FP</th>
                </tr>
              </thead>
              <tbody>
                {displayedLeague.map((row, index) => {
                  const displayedPosition = sort ? index + 1 : row.position;

                  return (
                    <tr key={row.team} className={displayedPosition <= 3 ? `is-top-${displayedPosition}` : ""}>
                      <td className="lf-standings-rank-col"><b>{displayedPosition}</b></td>
                      <td className="lf-standings-team-col"><TeamCell team={row.team} teamLogos={teamLogos} teamNames={teamNames} penalty={row.penalty} /></td>
                      <td className="is-points"><strong>{row.points}</strong></td>
                      <td>{row.played}</td>
                      <td>{row.wins}</td>
                      <td>{row.draws}</td>
                      <td>{row.losses}</td>
                      <td>{row.goalsFor}</td>
                      <td>{row.goalsAgainst}</td>
                      <td className={row.goalDifference > 0 ? "is-positive" : row.goalDifference < 0 ? "is-negative" : ""}>
                        {formatGoalDifference(row.goalDifference)}
                      </td>
                      <td>{formatStandingsNumber(row.fantasyPoints)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="lf-standings-fantasy-wrap">
            <table className="lf-standings-table lf-standings-table--fantasy">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Squadra</th>
                  <th scope="col">Fanta punti</th>
                </tr>
              </thead>
              <tbody>
                {data.fantasy.map((row) => (
                  <tr key={row.team} className={row.position <= 3 ? `is-top-${row.position}` : ""}>
                    <td><b>{row.position}</b></td>
                    <td><TeamCell team={row.team} teamLogos={teamLogos} teamNames={teamNames} /></td>
                    <td className="is-fantasy-points"><strong>{formatStandingsNumber(row.fantasyPoints)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
