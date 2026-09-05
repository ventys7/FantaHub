import { describe, expect, it } from "vitest";
import { parseStandingsCsv } from "./standings";

const HEADER = "Pos,Nome,Punti,Vittorie,Pareggi,Sconfitte,Gol Fatti,Gol Subiti,Differenza Reti,Fanta Punti";

describe("parseStandingsCsv with sparse cells", () => {
  it("shows rows with empty numeric cells defaulted to zero", () => {
    const csv = [
      HEADER,
      ",Squadra Alfa,,,,,,,,",
      ",Squadra Beta,10,3,1,0,9,4,,305"
    ].join("\n");
    const data = parseStandingsCsv(csv);
    expect(data.league).toHaveLength(2);
    expect(data.league[0]).toMatchObject({
      team: "Squadra Alfa",
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      fantasyPoints: 0,
      played: 0,
      position: 1
    });
    expect(data.league[1]).toMatchObject({ team: "Squadra Beta", position: 2, played: 4 });
  });

  it("keeps skipping rows without a team name", () => {
    const csv = [HEADER, ",,,,,,,,,"].join("\n");
    expect(parseStandingsCsv(csv).league).toHaveLength(0);
  });

  it("still throws when required headers are missing", () => {
    expect(() => parseStandingsCsv("Nome,Punti\nSquadra Alfa,10")).toThrow(/colonne richieste/);
  });
});
