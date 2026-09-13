// @vitest-environment jsdom

import type { PropsWithChildren } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const reactDom = vi.hoisted(() => {
  const render = vi.fn();
  return { render, createRoot: vi.fn(() => ({ render })) };
});

vi.mock("react-dom/client", () => ({ default: { createRoot: reactDom.createRoot } }));
vi.mock("./App", () => ({ default: () => null }));
vi.mock("./RoseApp", () => ({ default: () => null }));
vi.mock("./StandingsApp", () => ({ default: () => null }));
vi.mock("./trade/TradeApp", () => ({ default: () => null }));
vi.mock("./components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: PropsWithChildren<{ name: string }>) => children
}));
vi.mock("./debug/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), error: vi.fn() })
}));
vi.mock("./utils/pressFeedback", () => ({ installPressFeedback: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="league-dashboard-root"></div>';
  delete document.documentElement.dataset.leagueSection;
});

it("retries a lazy section after its root appears and mounts it only once", async () => {
  await import("./main");
  expect(reactDom.createRoot).toHaveBeenCalledTimes(1);

  window.dispatchEvent(new CustomEvent("lineup:league-section-change", {
    detail: { section: "rose" }
  }));
  expect(reactDom.createRoot).toHaveBeenCalledTimes(1);

  const root = document.createElement("div");
  root.id = "league-rose-root";
  document.body.appendChild(root);
  window.dispatchEvent(new CustomEvent("lineup:league-section-change", {
    detail: { section: "rose" }
  }));
  expect(reactDom.createRoot).toHaveBeenCalledTimes(2);
  expect(reactDom.createRoot).toHaveBeenLastCalledWith(root);

  window.dispatchEvent(new CustomEvent("lineup:league-section-change", {
    detail: { section: "rose" }
  }));
  expect(reactDom.createRoot).toHaveBeenCalledTimes(2);
});
