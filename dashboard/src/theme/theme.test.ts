import { describe, expect, it } from "vitest";
import { leagueThemeVars, THEME_CSS_VARS, isLeagueId, leagueTheme } from "./tokens";
import { readRoute } from "./router";

describe("leagueThemeVars", () => {
  it("maps fp to the violet palette", () => {
    expect(leagueThemeVars("fp")).toEqual({
      "--primary": "#7c3aed",
      "--primary-light": "#a855f7",
      "--primary-bg": "#f5f0ff",
      "--primary-border": "#ede9fe",
    });
  });

  it("maps pd to the red palette", () => {
    expect(leagueThemeVars("pd")["--primary"]).toBe("#b91c1c");
    expect(leagueThemeVars("pd")["--primary-light"]).toBe("#ef4444");
    expect(leagueThemeVars("pd")["--primary-bg"]).toBe("#fff1f2");
    expect(leagueThemeVars("pd")["--primary-border"]).toBe("#fecdd3");
  });

  it("falls back to fp for an unknown league", () => {
    expect(leagueThemeVars("xx")).toEqual(leagueThemeVars("fp"));
  });

  it("emits exactly the four theme custom properties", () => {
    expect(Object.keys(leagueThemeVars("fp")).sort()).toEqual([...THEME_CSS_VARS].sort());
  });
});

describe("isLeagueId", () => {
  it("accepts fp and pd only", () => {
    expect(isLeagueId("fp")).toBe(true);
    expect(isLeagueId("pd")).toBe(true);
    expect(isLeagueId("xx")).toBe(false);
  });
});

describe("leagueTheme", () => {
  it("returns the full theme object for a known league", () => {
    expect(leagueTheme("pd").background).toBe("#fffafa");
  });
});

describe("readRoute", () => {
  it("reads league and section from the shell bridge", () => {
    window.LINEUP_FANTA = {
      league: { id: "pd", name: "LaLigaCUP", label: "PD", csvUrl: "pd.csv" }
    };
    document.documentElement.dataset.leagueSection = "rose";
    expect(readRoute()).toEqual({ leagueId: "pd", section: "rose" });
  });

  it("defaults to fp with no section when the bridge is absent", () => {
    (window as unknown as { LINEUP_FANTA?: unknown }).LINEUP_FANTA = undefined;
    delete document.documentElement.dataset.leagueSection;
    expect(readRoute()).toEqual({ leagueId: "fp", section: null });
  });
});
