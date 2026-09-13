// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import StandingsApp from "./StandingsApp";

const mocks = vi.hoisted(() => ({
  fetchFreshText: vi.fn(),
  loadRuntimeLeagueSettings: vi.fn(),
  refreshToken: 0
}));

vi.mock("./liveRefresh", () => ({
  fetchFreshText: mocks.fetchFreshText,
  useSectionRefresh: () => mocks.refreshToken
}));
vi.mock("./runtimeSettings", () => ({ loadRuntimeLeagueSettings: mocks.loadRuntimeLeagueSettings }));
vi.mock("./hooks", () => ({
  useLeagueAssets: () => ({
    league: { id: "fp", label: "Fanta Premier", leagueData: { standingsFallbackUrl: "", teamProfilesUrl: "" } }
  })
}));
vi.mock("./discipline", () => ({
  getCachedDiscipline: () => ({ data: { recalls: [], penalties: [], configured: false } }),
  loadDiscipline: vi.fn()
}));
vi.mock("./teamProfiles", () => ({ loadTeamProfiles: vi.fn().mockResolvedValue({}) }));
vi.mock("./components/DisciplineBoard", () => ({ DisciplineBoard: () => null }));
vi.mock("./debug/logger", () => ({ createLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }));

const HEADER = "Pos,Nome,Punti,Vittorie,Pareggi,Sconfitte,Gol Fatti,Gol Subiti,Differenza Reti,Fanta Punti";
const standingsCsv = (team: string) => `${HEADER}\n1,${team},10,3,1,0,9,4,5,305`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refreshToken = 0;
  mocks.loadRuntimeLeagueSettings.mockResolvedValue({ standingsCsvUrl: "https://example.test/standings.csv" });
});

it("renders a fatal error when the initial configured standings snapshot is empty", async () => {
  mocks.fetchFreshText.mockResolvedValue(HEADER);

  render(<StandingsApp />);

  expect(await screen.findByText("Errore nel caricamento")).toBeInTheDocument();
  expect(screen.queryByText("Classifica non ancora disponibile")).not.toBeInTheDocument();
});

it("keeps valid rows and reports a later empty refresh", async () => {
  mocks.fetchFreshText.mockResolvedValueOnce(standingsCsv("Squadra Alfa")).mockResolvedValueOnce(HEADER);
  const view = render(<StandingsApp />);
  expect(await screen.findByText("Squadra Alfa")).toBeInTheDocument();

  mocks.refreshToken += 1;
  view.rerender(<StandingsApp />);

  expect(await screen.findByRole("status")).toHaveTextContent(/non è stata aggiornata/i);
  expect(screen.getByText("Squadra Alfa")).toBeInTheDocument();
});

it("clears a network refresh error after the next successful snapshot", async () => {
  mocks.fetchFreshText
    .mockResolvedValueOnce(standingsCsv("Squadra Alfa"))
    .mockRejectedValueOnce(new Error("network unavailable"))
    .mockResolvedValueOnce(standingsCsv("Squadra Beta"));
  const view = render(<StandingsApp />);
  expect(await screen.findByText("Squadra Alfa")).toBeInTheDocument();

  mocks.refreshToken += 1;
  view.rerender(<StandingsApp />);
  expect(await screen.findByRole("status")).toHaveTextContent(/non è stata aggiornata/i);
  expect(screen.getByText("Squadra Alfa")).toBeInTheDocument();

  mocks.refreshToken += 1;
  view.rerender(<StandingsApp />);
  expect(await screen.findByText("Squadra Beta")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
});

it("keeps an unconfigured standings source as a valid empty state", async () => {
  mocks.loadRuntimeLeagueSettings.mockResolvedValue({ standingsCsvUrl: "" });

  render(<StandingsApp />);

  expect(await screen.findByText("Classifica non ancora disponibile")).toBeInTheDocument();
  expect(mocks.fetchFreshText).not.toHaveBeenCalled();
  expect(screen.queryByText("Errore nel caricamento")).not.toBeInTheDocument();
});
