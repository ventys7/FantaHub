import { describe, expect, it } from "vitest";
import runtimeCss from "./runtime.css?inline";
import teamsCss from "./teams.css?inline";
import tradesCss from "./trades.css?inline";

const compact = (css: string): string => css.replace(/\s+/g, " ");

describe("responsive interface safeguards", () => {
  it("shows the trade FAB only through 767px", () => {
    const css = compact(tradesCss);

    expect(css).toMatch(/@media \(min-width: 768px\) \{ \.lf-trade-fab \{ display: none; \} \}/);
    expect(css).toMatch(/@media \(max-width: 767px\) \{.*?\.lf-trade-submit \{ display: none; \}/);
  });

  it("keeps every team status declaration at least 10px", () => {
    const sizes = [...teamsCss.matchAll(/\.lf-team-status\s*\{[^}]*font-size:\s*([\d.]+)px/g)]
      .map((match) => Number(match[1]));

    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every((size) => size >= 10)).toBe(true);
  });

  it("disables nonessential motion without removing layout transforms", () => {
    const css = compact(runtimeCss);
    const universal = css.match(/\.league-react-root \*, \.league-react-root \*::before, \.league-react-root \*::after \{([^}]*)\}/)?.[1] ?? "";

    expect(universal).toContain("animation: none !important;");
    expect(universal).toContain("transition: none !important;");
    expect(universal).not.toContain("transform:");
    expect(css).toMatch(/\.league-react-root \.lf-action-button, \.league-react-root \.lf-reset-button, \.league-react-root \.lf-team-card, \.league-react-root \.lf-trade-fab \{ transform: none !important; \}/);
  });
});
