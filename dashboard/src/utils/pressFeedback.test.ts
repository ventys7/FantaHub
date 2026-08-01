import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installPressFeedback, uninstallPressFeedback } from "./pressFeedback";

function makePressable(id: string, className: string): HTMLElement {
  const el = document.createElement("button");
  el.id = id;
  el.className = className;
  el.textContent = "test";
  document.body.appendChild(el);
  return el;
}

function stubMatchMedia(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

/** Re-installa con matchMedia specifico, rimuovendo prima i listener precedenti. */
function reinstall(matches: boolean): void {
  uninstallPressFeedback();
  stubMatchMedia(matches);
  installPressFeedback();
}

describe("pressFeedback", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    stubMatchMedia(true); // desktop come default di setup.ts
    installPressFeedback();
  });

  afterEach(() => {
    uninstallPressFeedback();
    document.body.innerHTML = "";
  });

  it("aggiunge data-lf-pressed al touchstart sul controllabile più vicino", () => {
    reinstall(false); // touch
    const pill = makePressable("pill", "lf-role-pill");
    const target = document.createElement("span");
    target.textContent = "figlio";
    pill.appendChild(target); // il tap avviene su un figlio: closest() deve risalire

    target.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(pill.hasAttribute("data-lf-pressed")).toBe(true);
  });

  it("su touch il colore RESTA dopo il rilascio (latch) finché non premi altro", () => {
    reinstall(false);
    const btn = makePressable("btn", "lf-mobile-toggle");
    const other = makePressable("other", "lf-mobile-sort-btn");

    btn.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(btn.hasAttribute("data-lf-pressed")).toBe(true);

    // il rilascio NON toglie il colore: il bottone resta del colore pattern
    btn.dispatchEvent(new Event("touchend", { bubbles: true }));
    expect(btn.hasAttribute("data-lf-pressed")).toBe(true);

    // premere un altro bottone sposta il colore sul nuovo
    other.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(btn.hasAttribute("data-lf-pressed")).toBe(false);
    expect(other.hasAttribute("data-lf-pressed")).toBe(true);
  });

  it("su desktop il rilascio rimuove subito lo stato", () => {
    reinstall(true); // desktop: lo :hover copre la continuità visiva
    const btn = makePressable("btn", "lf-action-button");
    btn.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(btn.hasAttribute("data-lf-pressed")).toBe(true);

    btn.dispatchEvent(new Event("touchend", { bubbles: true }));
    expect(btn.hasAttribute("data-lf-pressed")).toBe(false);
  });

  it("non aggiunge lo stato su elementi non controllabili", () => {
    const plain = document.createElement("div");
    plain.id = "plain";
    document.body.appendChild(plain);
    plain.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(plain.hasAttribute("data-lf-pressed")).toBe(false);
  });

  it("rilascia su touchcancel (gesto interrotto)", () => {
    reinstall(false);
    const btn = makePressable("btn", "lf-role-pill");
    btn.dispatchEvent(new Event("touchstart", { bubbles: true }));
    btn.dispatchEvent(new Event("touchcancel", { bubbles: true }));
    expect(btn.hasAttribute("data-lf-pressed")).toBe(false);
  });

  it("rilascia allo scroll (il gesto ruba il pointer)", () => {
    reinstall(false);
    const btn = makePressable("btn", "lf-mobile-sort-btn");
    btn.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(btn.hasAttribute("data-lf-pressed")).toBe(true);
    window.dispatchEvent(new Event("scroll"));
    expect(btn.hasAttribute("data-lf-pressed")).toBe(false);
  });

  it("i controlli già del colore pattern (--active) non ricevono il feedback", () => {
    reinstall(false);
    const active = makePressable("active", "lf-mobile-toggle lf-mobile-toggle--active");
    active.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(active.hasAttribute("data-lf-pressed")).toBe(false);

    // ma un controllabile non attivo accanto sì
    const plain = makePressable("plain", "lf-mobile-toggle");
    plain.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(plain.hasAttribute("data-lf-pressed")).toBe(true);
  });

  it("con Pointer Events disponibili usa il ramo pointerdown/pointerup", () => {
    // stub minimale: jsdom non ha PointerEvent di default
    class PointerEventStub extends Event {
      constructor(type: string) {
        super(type, { bubbles: true });
      }
    }
    // @ts-expect-error - stub di test
    window.PointerEvent = PointerEventStub;
    reinstall(true); // desktop

    const btn = makePressable("btn", "lf-mobile-toggle");
    btn.dispatchEvent(new PointerEventStub("pointerdown"));
    expect(btn.hasAttribute("data-lf-pressed")).toBe(true);

    window.dispatchEvent(new PointerEventStub("pointerup"));
    expect(btn.hasAttribute("data-lf-pressed")).toBe(false);

    delete (window as unknown as Record<string, unknown>).PointerEvent;
  });
});
