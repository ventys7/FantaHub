// @vitest-environment jsdom

import { beforeEach, expect, test, vi } from "vitest";

import { clearRuntimeSettingsCache, loadRuntimeLeagueSettings } from "./runtimeSettings";

beforeEach(() => {
  clearRuntimeSettingsCache();
  window.LINEUP_FANTA = {
    league: { id: "fp", name: "FP", label: "FP", csvUrl: "fallback.csv" }
  };
});

test("runtime settings retries after a transient API failure", async () => {
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error("temporary outage"))
    .mockResolvedValue({
      ok: true,
      json: async () => ({ leagueId: "fp", listoneCsvUrl: "live.csv", teams: {} })
    });
  vi.stubGlobal("fetch", fetchMock);

  await expect(loadRuntimeLeagueSettings("fp")).resolves.toMatchObject({ listoneCsvUrl: "fallback.csv" });
  await expect(loadRuntimeLeagueSettings("fp")).resolves.toMatchObject({ listoneCsvUrl: "live.csv" });
  await expect(loadRuntimeLeagueSettings("fp")).resolves.toMatchObject({ listoneCsvUrl: "live.csv" });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
