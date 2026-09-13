import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DashboardAsset } from "../types";
import { GoalkeeperBlock } from "./GoalkeeperBlock";

function makeAsset(overrides: Partial<DashboardAsset>): DashboardAsset {
  return {
    assetCode: "gk1",
    displayName: "Gigi Buffon - Wojciech Szczęsny",
    docsName: "Gigi Buffon - Wojciech Szczęsny",
    role: "P",
    realTeam: "Juventus",
    quotation: 10,
    purchasePrice: 5,
    ownerTag: "Casa",
    managerCredits: null,
    type: "player",
    active: true,
    isFreeAgent: false,
    ...overrides
  };
}

const noMedia = { player: () => null };

function renderBlock(asset: DashboardAsset, ownerLogos?: Record<string, string>) {
  const utils = render(<GoalkeeperBlock asset={asset} expanded={false} onToggle={() => {}} media={noMedia} ownerLogos={ownerLogos} />);
  // Il blocco ha due versioni (desktop/mobile): la riga proprietario mobile è quella con lo stemma.
  return utils;
}

describe("GoalkeeperBlock (stemma proprietario, blocco mobile)", () => {
  it("mostra lo stemma della fantasquadra nella versione mobile quando c'è un logo", () => {
    renderBlock(makeAsset({ ownerTag: "Nicolò - Gabriele" }), { "nicolo gabriele": "https://example.com/stemma.png" });
    const logos = document.querySelectorAll("img.lf-owner-logo");
    expect(logos.length).toBe(1);
    expect(logos[0]).toHaveAttribute("src", "https://example.com/stemma.png");
    expect(screen.queryByText("👤")).not.toBeInTheDocument();
  });

  it("cade sull'emoji quando il proprietario non ha un logo caricato", () => {
    renderBlock(makeAsset({ ownerTag: "Casa" }), { "altra squadra": "https://example.com/x.png" });
    expect(document.querySelector("img.lf-owner-logo")).not.toBeInTheDocument();
    expect(screen.getByText("👤")).toBeInTheDocument();
    expect(screen.getAllByText("Casa").length).toBeGreaterThan(0);
  });

  it("resta emoji per gli svincolati (nessun lookup)", () => {
    renderBlock(makeAsset({ ownerTag: "" }), { "casa": "https://example.com/x.png" });
    expect(document.querySelector("img.lf-owner-logo")).not.toBeInTheDocument();
    expect(screen.getByText("👤")).toBeInTheDocument();
    expect(screen.getAllByText("Svincolato").length).toBeGreaterThan(0);
  });

  it("espandere il blocco non rompe la riga proprietario", () => {
    const { rerender } = renderBlock(makeAsset({ ownerTag: "Casa" }), { "casa": "https://example.com/stemma.png" });
    expect(document.querySelector("img.lf-owner-logo")).toHaveAttribute("src", "https://example.com/stemma.png");
    fireEvent.click(screen.getAllByRole("button", { name: /Blocco Juventus/ })[0]);
    rerender(<GoalkeeperBlock asset={makeAsset({ ownerTag: "Casa" })} expanded={true} onToggle={() => {}} media={noMedia} ownerLogos={{ "casa": "https://example.com/stemma.png" }} />);
    expect(document.querySelector("img.lf-owner-logo")).toHaveAttribute("src", "https://example.com/stemma.png");
    expect(screen.getByText("Gigi Buffon")).toBeInTheDocument();
  });

  it("sincronizza lo stato disclosure dei pulsanti con il pannello", () => {
    const asset = makeAsset({ ownerTag: "Casa" });
    const { rerender } = renderBlock(asset);
    const collapsedButtons = screen.getAllByRole("button", { name: /Blocco Juventus/ });
    const panelId = collapsedButtons[0].getAttribute("aria-controls");

    expect(panelId).toBeTruthy();
    collapsedButtons.forEach((button) => {
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveAttribute("aria-controls", panelId);
    });

    rerender(<GoalkeeperBlock asset={asset} expanded onToggle={() => {}} media={noMedia} />);

    screen.getAllByRole("button", { name: /Blocco Juventus/ }).forEach((button) => {
      expect(button).toHaveAttribute("aria-expanded", "true");
      expect(button).toHaveAttribute("aria-controls", panelId);
    });
    expect(document.getElementById(panelId!)).toHaveClass("lf-block-expanded");
  });
});
