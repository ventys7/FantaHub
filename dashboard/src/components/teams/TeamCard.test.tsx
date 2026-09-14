import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DashboardAsset } from "../../types";
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
    extraSlots: { D: null, C: null, A: null },
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

function makeAsset(overrides: Partial<DashboardAsset> = {}): DashboardAsset {
  return { assetCode: "extra-d", displayName: "Extra D", docsName: "Extra D", role: "D", realTeam: "Inter", quotation: 7, purchasePrice: 9, ownerTag: "Casa", managerCredits: null, type: "player", active: true, isFreeAgent: false, isExtra: true, ...overrides };
}

  it("mostra le tre righe Extra Slot con stato pieno o libero", () => {
    const team = { ...makeSquad(0), extraSlots: { D: makeAsset(), C: null, A: null } };
    render(<TeamCard team={team} leagueId="fp" media={media} />);

    const section = screen.getByRole("region", { name: "Extra Slot" });
    expect(within(section).getByText("Extra Slot")).toBeInTheDocument();
    const defender = within(section).getByLabelText("Extra Slot D");
    expect(within(defender).getByText("Extra D")).toBeInTheDocument();
    expect(within(defender).getByText("Inter")).toBeInTheDocument();
    expect(within(defender).getByText("7")).toBeInTheDocument();
    expect(within(defender).getByText("9")).toBeInTheDocument();
    expect(within(within(section).getByLabelText("Extra Slot C")).getByText("Libero")).toBeInTheDocument();
    expect(within(within(section).getByLabelText("Extra Slot A")).getByText("Slot non assegnato")).toBeInTheDocument();
    expect(screen.queryByLabelText("Extra Slot P")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "P: 0/2" }));
    expect(within(screen.getByRole("region", { name: "Extra Slot" })).getAllByLabelText(/Extra Slot [DCA]/)).toHaveLength(3);
  });

  it("nasconde gli Extra Slot su PD anche con slot pieni", () => {
    const team = { ...makeSquad(0), extraSlots: { D: makeAsset(), C: null, A: null } };
    render(<TeamCard team={team} leagueId="pd" media={media} />);

    expect(screen.queryByRole("region", { name: "Extra Slot" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Extra Slot/)).not.toBeInTheDocument();
    expect(screen.queryByText("Extra D")).not.toBeInTheDocument();
  });
});
