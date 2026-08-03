import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TradeOutputModal, copyTradeText } from "./TradeOutputModal";

const TEXT = "🔄 SCAMBIO · Casa ↔ Villa";

describe("TradeOutputModal", () => {
  beforeAll(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("non renderizza nulla quando chiusa", () => {
    const { container } = render(<TradeOutputModal open={false} title="Scambio" text={TEXT} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra il testo dello scambio nella textarea", () => {
    render(<TradeOutputModal open title="Scambio" text={TEXT} onClose={() => {}} />);
    const textarea = screen.getByRole("textbox", { name: "Testo dello scambio" });
    expect(textarea).toHaveValue(TEXT);
    expect(textarea).toHaveAttribute("readonly");
  });

  it("copia il testo negli appunti e mostra conferma", async () => {
    render(<TradeOutputModal open title="Scambio" text={TEXT} onClose={() => {}} />);
    const button = screen.getByRole("button", { name: "Copia scambio" });
    fireEvent.click(button);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEXT);
    expect(await screen.findByRole("button", { name: "Copiato ✓" })).toBeInTheDocument();
  });

  it("chiude al click su Chiudi", () => {
    const onClose = vi.fn();
    render(<TradeOutputModal open title="Scambio" text={TEXT} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("chiude al click sul backdrop", () => {
    const onClose = vi.fn();
    render(<TradeOutputModal open title="Scambio" text={TEXT} onClose={onClose} />);
    fireEvent.click(document.querySelector(".lf-trade-modal")!);
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
