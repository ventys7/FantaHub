import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardAsset } from "../types";
import { copyTradeText, TradeSummaryModal } from "./TradeSummaryModal";

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

const SUMMARY = {
  managerA: "Casa",
  managerB: "Villa",
  aGives: [makeAsset({ assetCode: "a1", role: "D", displayName: "Difensore Casa" })],
  bGives: [makeAsset({ assetCode: "b1", role: "D", displayName: "Difensore Villa" })],
  credits: 0
};

const TEXT = "🔄 SCAMBIO · Casa ↔ Villa";

describe("TradeSummaryModal", () => {
  it("non renderizza nulla quando chiusa", () => {
    const { container } = render(<TradeSummaryModal open={false} summary={SUMMARY} text={TEXT} media={media} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra lo scambio visivo con offerta e ricezione", () => {
    render(<TradeSummaryModal open summary={SUMMARY} text={TEXT} media={media} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Riepilogo scambio" })).toBeInTheDocument();
    expect(screen.getByText("Difensore Casa")).toBeInTheDocument();
    expect(screen.getByText("Difensore Villa")).toBeInTheDocument();
    // badge di ruolo per ciascuna riga
    expect(screen.getAllByText("D").length).toBeGreaterThanOrEqual(2);
  });

  it("mostra la riga crediti quando prevista", () => {
    render(<TradeSummaryModal open summary={{ ...SUMMARY, credits: 5 }} text={TEXT} media={media} onClose={() => {}} />);
    expect(screen.getByText(/\+5 crediti da Casa a Villa/)).toBeInTheDocument();
  });

  it("non mostra la riga crediti senza crediti", () => {
    render(<TradeSummaryModal open summary={SUMMARY} text={TEXT} media={media} onClose={() => {}} />);
    expect(screen.queryByText(/crediti da/)).not.toBeInTheDocument();
  });

  it("copia il testo negli appunti e mostra conferma", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
    render(<TradeSummaryModal open summary={SUMMARY} text={TEXT} media={media} onClose={() => {}} />);
    const button = screen.getByRole("button", { name: "Copia messaggio" });
    fireEvent.click(button);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEXT);
    expect(await screen.findByRole("button", { name: "Copiato ✓" })).toBeInTheDocument();
  });

  it("chiude al click su Chiudi", () => {
    const onClose = vi.fn();
    render(<TradeSummaryModal open summary={SUMMARY} text={TEXT} media={media} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("chiude al click sul backdrop", () => {
    const onClose = vi.fn();
    render(<TradeSummaryModal open summary={SUMMARY} text={TEXT} media={media} onClose={onClose} />);
    fireEvent.click(document.querySelector(".lf-trade-summary")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("copyTradeText usa il fallback quando clipboard non disponibile", async () => {
    const original = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    document.execCommand = vi.fn(() => true);
    await expect(copyTradeText(TEXT)).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: original });
  });
});
