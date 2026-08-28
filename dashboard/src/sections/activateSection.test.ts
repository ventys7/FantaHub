import { describe, it, expect, beforeEach } from "vitest";
import { activateSection } from "./activateSection";

function setupDom(): void {
  document.body.innerHTML = `
    <button data-league-tab="formation">Formazione</button>
    <button data-league-tab="listone">Listone</button>
    <button data-league-tab="rose">Rose</button>
    <main data-league-view="formation"></main>
    <main data-league-view="listone" hidden></main>
    <div id="formationControls"></div>
    <div id="fabCopy"></div>
  `;
}

describe("activateSection", () => {
  beforeEach(() => {
    setupDom();
    document.documentElement.dataset.leagueSection = "formation";
  });

  it("activates the requested section and hides the others", () => {
    activateSection("listone");

    const listoneTab = document.querySelector<HTMLButtonElement>('[data-league-tab="listone"]')!;
    const formationTab = document.querySelector<HTMLButtonElement>('[data-league-tab="formation"]')!;

    expect(listoneTab.classList.contains("is-active")).toBe(true);
    expect(listoneTab.getAttribute("aria-selected")).toBe("true");
    expect(formationTab.classList.contains("is-active")).toBe(false);

    expect(document.querySelector<HTMLElement>('[data-league-view="listone"]')!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('[data-league-view="formation"]')!.hidden).toBe(true);
    expect(document.getElementById("formationControls")!.hidden).toBe(true);
    expect(document.documentElement.dataset.leagueSection).toBe("listone");
  });

  it("dispatches lineup:league-section-change with the section", () => {
    let detail: unknown = null;
    window.addEventListener("lineup:league-section-change", (e) => {
      detail = (e as CustomEvent).detail;
    });
    activateSection("rose");
    expect(detail).toEqual({ section: "rose" });
  });

  it("falls back to formation for unknown sections", () => {
    activateSection("nope");
    expect(document.documentElement.dataset.leagueSection).toBe("formation");
    expect(document.getElementById("formationControls")!.hidden).toBe(false);
  });
});
