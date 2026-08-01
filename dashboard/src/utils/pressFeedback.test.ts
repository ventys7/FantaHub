import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installPressFeedback } from "./pressFeedback";

const MIN_FEEDBACK_MS = 120;

function makePressable(id: string, className: string): HTMLElement {
  const el = document.createElement("button");
  el.id = id;
  el.className = className;
  el.textContent = "test";
  document.body.appendChild(el);
  return el;
}

describe("pressFeedback", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    installPressFeedback();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("aggiunge lf-pressed al pointerdown sul controllabile più vicino", () => {
    const pill = makePressable("pill", "lf-role-pill");
    const target = document.createElement("span");
    target.textContent = "figlio";
    pill.appendChild(target); // il tap avviene su un figlio: closest() deve risalire

    // jsdom non ha PointerEvent: senza stub il ramo Pointer Events non parte;
    // verifichiamo il comportamento reale con il fallback touchstart.
    target.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(pill.classList.contains("lf-pressed")).toBe(true);
  });

  it("aggiunge la classe anche quando il target è il bottone stesso", () => {
    const btn = makePressable("btn", "lf-mobile-toggle");
    btn.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(btn.classList.contains("lf-pressed")).toBe(true);
  });

  it("non aggiunge la classe su elementi non controllabili", () => {
    const plain = document.createElement("div");
    plain.id = "plain";
    document.body.appendChild(plain);
    plain.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(plain.classList.contains("lf-pressed")).toBe(false);
  });

  it("al rilascio il feedback resta visibile MIN_FEEDBACK_MS poi sparisce", () => {
    vi.useFakeTimers();
    const btn = makePressable("btn", "lf-action-button");
    btn.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(btn.classList.contains("lf-pressed")).toBe(true);

    btn.dispatchEvent(new Event("touchend", { bubbles: true }));
    // il rilascio è ritardato: subito dopo il touchend il feedback deve essere
    // ancora visibile (su iOS il rendering è sospeso durante il tocco)
    expect(btn.classList.contains("lf-pressed")).toBe(true);

    vi.advanceTimersByTime(MIN_FEEDBACK_MS);
    expect(btn.classList.contains("lf-pressed")).toBe(false);
  });

  it("rilascia su pointercancel (gesto interrotto)", () => {
    const btn = makePressable("btn", "lf-role-pill");
    btn.dispatchEvent(new Event("touchstart", { bubbles: true }));
    btn.dispatchEvent(new Event("touchcancel", { bubbles: true }));
    expect(btn.classList.contains("lf-pressed")).toBe(false);
  });

  it("rilascia allo scroll (il gesto ruba il pointer)", () => {
    const btn = makePressable("btn", "lf-mobile-sort-btn");
    btn.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(btn.classList.contains("lf-pressed")).toBe(true);
    window.dispatchEvent(new Event("scroll"));
    expect(btn.classList.contains("lf-pressed")).toBe(false);
  });

  it("con Pointer Events disponibili usa il ramo pointerdown/pointerup", () => {
    vi.useFakeTimers();
    // stub minimale: jsdom non ha PointerEvent di default
    class PointerEventStub extends Event {
      constructor(type: string) {
        super(type, { bubbles: true });
      }
    }
    // @ts-expect-error - stub di test
    window.PointerEvent = PointerEventStub;
    delete (window as unknown as Record<string, unknown>).__pressFeedbackInstalled;

    const btn = makePressable("btn", "lf-mobile-toggle");
    // ri-installa per ripartire nel ramo Pointer Events
    installPressFeedback();

    btn.dispatchEvent(new PointerEventStub("pointerdown"));
    expect(btn.classList.contains("lf-pressed")).toBe(true);

    window.dispatchEvent(new PointerEventStub("pointerup"));
    // stesso ritardo del ramo touch: il feedback resta visibile
    expect(btn.classList.contains("lf-pressed")).toBe(true);

    vi.advanceTimersByTime(MIN_FEEDBACK_MS);
    expect(btn.classList.contains("lf-pressed")).toBe(false);

    delete (window as unknown as Record<string, unknown>).PointerEvent;
  });

  it("un nuovo press durante il rilascio ritardato riparte da zero", () => {
    vi.useFakeTimers();
    const btn = makePressable("btn", "lf-mobile-toggle");
    btn.dispatchEvent(new Event("touchstart", { bubbles: true }));
    btn.dispatchEvent(new Event("touchend", { bubbles: true }));

    // secondo tap prima che scada il timer del primo
    vi.advanceTimersByTime(60);
    btn.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(btn.classList.contains("lf-pressed")).toBe(true);

    vi.advanceTimersByTime(60);
    // il timer del primo rilascio non deve aver tolto la classe al nuovo press
    expect(btn.classList.contains("lf-pressed")).toBe(true);

    btn.dispatchEvent(new Event("touchend", { bubbles: true }));
    vi.advanceTimersByTime(MIN_FEEDBACK_MS);
    expect(btn.classList.contains("lf-pressed")).toBe(false);
  });
});
