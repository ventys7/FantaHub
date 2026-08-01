import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom non implementa matchMedia: stub che simula il desktop (lista visibile).
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });

// Globi legacy usati da usePlayerMedia / clubKey / leagueId.
Object.defineProperty(window, "LINEUP_FANTA", { writable: true, value: { league: { id: "fp" } } });
Object.defineProperty(window, "LineupClubKeys", {
  writable: true,
  value: { key: (value: string) => String(value || "").toLowerCase().trim() }
});
Object.defineProperty(window, "LineupPlayerMedia", {
  writable: true,
  value: {
    payload: () => ({ players: {}, summary: { resolved: 0, unresolved: 0 } }),
    playerKey: () => "",
    player: () => null,
    crest: () => "",
    load: () => {}
  }
});
