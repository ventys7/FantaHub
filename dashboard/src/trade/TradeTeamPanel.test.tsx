import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardAsset } from "../types";
import { TradeTeamPanel } from "./TradeTeamPanel";

function makeAsset(overrides: Partial<DashboardAsset>): DashboardAsset {
  return {
    assetCode: "p1",
    displayName: "Giocatore",
    docsName: "Giocatore",
    role: "A",
    realTeam: "Squadra",
    quotation: 100,
    purchasePrice: 50,
    ownerTag: "Casa",
    managerCredits: null,
    type: "player",
    active: true,
    isFreeAgent: false,
    ...overrides
  };
}

const media = { player: () => null, crest: () => "" };

const assets = [
  makeAsset({ assetCode: "p1", role: "P", displayName: "Due - Tre", realTeam: "Athletic" }),
  makeAsset({ assetCode: "p2", role: "D", displayName: "Difensore Uno", realTeam: "Inter" }),
  makeAsset({ assetCode: "p3", role: "D", displayName: "Difensore Due", realTeam: "Milan" }),
  makeAsset({ assetCode: "p4", role: "A", displayName: "Attaccante Uno", realTeam: "Roma" })
];

describe("TradeTeamPanel", () => {
  it("mostra il nome del proprietario e la rosa", () => {
    render(<TradeTeamPanel managerName="Nicolò - Gabriele" assets={assets} selected={new Set()} onToggle={() => {}} media={media} />);
    expect(screen.getByRole("heading", { name: "Nicolò - Gabriele" })).toBeInTheDocument();
    expect(screen.getByText("Blocco Athletic")).toBeInTheDocument();
    expect(screen.getByText("Difensore Uno")).toBeInTheDocument();
    expect(screen.getByText("Attaccante Uno")).toBeInTheDocument();
    expect(screen.getByText("Nessuna selezione")).toBeInTheDocument();
  });

  it("chiama onToggle con l'assetCode al click sulla riga", () => {
    const onToggle = vi.fn();
    render(<TradeTeamPanel managerName="Casa" assets={assets} selected={new Set()} onToggle={onToggle} media={media} />);
    fireEvent.click(screen.getByText("Difensore Uno"));
    expect(onToggle).toHaveBeenCalledWith("p2");
  });

  it("seleziona il blocco portieri come unità singola", () => {
    const onToggle = vi.fn();
    render(<TradeTeamPanel managerName="Casa" assets={assets} selected={new Set()} onToggle={onToggle} media={media} />);
    fireEvent.click(screen.getByText("Blocco Athletic"));
    expect(onToggle).toHaveBeenCalledWith("p1");
  });

  it("mostra il conteggio dei selezionati", () => {
    render(
      <TradeTeamPanel
        managerName="Casa"
        assets={assets}
        selected={new Set(["p2", "p4"])}
        onToggle={() => {}}
        media={media}
      />
    );
    expect(screen.getByText("2 selezionati")).toBeInTheDocument();
  });

  it("evidenzia le righe selezionate", () => {
    render(
      <TradeTeamPanel
        managerName="Casa"
        assets={assets}
        selected={new Set(["p2"])}
        onToggle={() => {}}
        media={media}
      />
    );
    const row = screen.getByText("Difensore Uno").closest("button");
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(row?.className).toContain("is-selected");
  });

  it("filtra per ruolo", () => {
    render(<TradeTeamPanel managerName="Casa" assets={assets} selected={new Set()} onToggle={() => {}} media={media} />);
    fireEvent.click(screen.getByRole("button", { name: "D" }));
    expect(screen.getByText("Difensore Uno")).toBeInTheDocument();
    expect(screen.getByText("Difensore Due")).toBeInTheDocument();
    expect(screen.queryByText("Attaccante Uno")).not.toBeInTheDocument();
    expect(screen.queryByText("Blocco Athletic")).not.toBeInTheDocument();
  });
});
