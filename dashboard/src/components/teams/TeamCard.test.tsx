import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TeamSquad } from "./types";
import { TeamCard } from "./TeamCard";

const media = { player: () => null, crest: () => "" };

function makeSquad(credits: number | null): TeamSquad {
  return {
    managerName: "Casa",
    credits,
    logoUrl: "",
    displayName: "",
    players: [],
    isComplete: false,
    roleCounts: { P: 0, D: 0, C: 0, A: 0 },
    totalPlayers: 0
  };
}

describe("TeamCard", () => {
  it("mostra zero crediti come 0", () => {
    render(<TeamCard team={makeSquad(0)} leagueId="fp" media={media} />);
    expect(screen.getByText("Crediti").parentElement).toHaveTextContent("0");
  });

  it("mostra crediti sconosciuti con un trattino", () => {
    render(<TeamCard team={makeSquad(null)} leagueId="fp" media={media} />);
    expect(screen.getByText("Crediti").parentElement).toHaveTextContent("—");
  });
});
