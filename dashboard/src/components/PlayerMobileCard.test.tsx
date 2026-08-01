import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DashboardAsset } from "../types";
import { PlayerMobileCard } from "./PlayerMobileCard";

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

describe("PlayerMobileCard (stemma proprietario)", () => {
  it("mostra lo stemma della fantasquadra del proprietario quando c'è un logo", () => {
    render(<PlayerMobileCard player={makeAsset({ ownerTag: "Nicolò - Gabriele" })} ownerLogos={{ "nicolo gabriele": "https://example.com/stemma.png" }} />);
    const logo = document.querySelector("img.lf-owner-logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "https://example.com/stemma.png");
    expect(logo).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(screen.queryByText("👤")).not.toBeInTheDocument();
  });

  it("cade sull'emoji quando il proprietario non ha un logo caricato", () => {
    render(<PlayerMobileCard player={makeAsset({ ownerTag: "Casa" })} ownerLogos={{ "altra squadra": "https://example.com/x.png" }} />);
    expect(document.querySelector("img.lf-owner-logo")).not.toBeInTheDocument();
    expect(screen.getByText("👤")).toBeInTheDocument();
    expect(screen.getByText("Casa")).toBeInTheDocument();
  });

  it("resta emoji per gli svincolati (nessun lookup)", () => {
    render(<PlayerMobileCard player={makeAsset({ ownerTag: null })} ownerLogos={{ "casa": "https://example.com/x.png" }} />);
    expect(document.querySelector("img.lf-owner-logo")).not.toBeInTheDocument();
    expect(screen.getByText("👤")).toBeInTheDocument();
    expect(screen.getByText("Svincolato")).toBeInTheDocument();
  });
});
