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
    expect(screen.getByText("5 crediti da Casa a Villa")).toBeInTheDocument();
  });

  it("mostra i crediti richiesti da B verso A senza importi negativi", () => {
    render(<TradeSummaryModal open summary={{ ...SUMMARY, credits: -2 }} text={TEXT} media={media} onClose={() => {}} />);
    expect(screen.getByText("2 crediti da Villa a Casa")).toBeInTheDocument();
    expect(screen.queryByText(/-2/)).not.toBeInTheDocument();
  });

  it("mostra la foto del giocatore quando disponibile", () => {
    const mediaWithPhoto = {
      player: () => ({
        key: "attaccante|squadra",
        listoneName: "Attaccante",
        realTeam: "Squadra",
        status: "resolved" as const,
        photoUrl: "/foto/attaccante.jpg"
      }),
      crest: () => ""
    };
    render(<TradeSummaryModal open summary={SUMMARY} text={TEXT} media={mediaWithPhoto} onClose={() => {}} />);
    // l'avatar è decorativo (aria-hidden): la foto è visibile nel DOM, non nell'accessibility tree
    const photo = document.querySelector(".lf-squad-avatar img") as HTMLImageElement;
    expect(photo).not.toBeNull();
    expect(photo.src).toContain("/foto/attaccante.jpg");
  });

  it("blocca lo scroll del body mentre è aperta e lo ripristina alla chiusura", () => {
    const { rerender } = render(<TradeSummaryModal open summary={SUMMARY} text={TEXT} media={media} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<TradeSummaryModal open={false} summary={SUMMARY} text={TEXT} media={media} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("");
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

  it("sposta il focus su Chiudi, nomina il dialogo e ripristina il chiamante con Escape", () => {
    const view = render(
      <>
        <button type="button">Apri riepilogo</button>
        <TradeSummaryModal open={false} summary={SUMMARY} text={TEXT} media={media} onClose={() => {}} />
      </>
    );
    const opener = screen.getByRole("button", { name: "Apri riepilogo" });
    opener.focus();
    const close = () => view.rerender(
      <>
        <button type="button">Apri riepilogo</button>
        <TradeSummaryModal open={false} summary={SUMMARY} text={TEXT} media={media} onClose={close} />
      </>
    );

    view.rerender(
      <>
        <button type="button">Apri riepilogo</button>
        <TradeSummaryModal open summary={SUMMARY} text={TEXT} media={media} onClose={close} />
      </>
    );

    const closeButton = screen.getByRole("button", { name: "Chiudi" });
    const heading = screen.getByRole("heading", { name: "Riepilogo scambio" });
    expect(closeButton).toHaveFocus();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-labelledby", heading.id);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(opener).toHaveFocus();
  });

  it("ripristina il focus quando il dialogo viene smontato", () => {
    const view = render(
      <>
        <button type="button">Apri riepilogo</button>
        <TradeSummaryModal open={false} summary={SUMMARY} text={TEXT} media={media} onClose={() => {}} />
      </>
    );
    const opener = screen.getByRole("button", { name: "Apri riepilogo" });
    opener.focus();
    view.rerender(
      <>
        <button type="button">Apri riepilogo</button>
        <TradeSummaryModal open summary={SUMMARY} text={TEXT} media={media} onClose={() => {}} />
      </>
    );
    expect(screen.getByRole("button", { name: "Chiudi" })).toHaveFocus();

    view.rerender(<button type="button">Apri riepilogo</button>);

    expect(opener).toHaveFocus();
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
