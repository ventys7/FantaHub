import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TeamSquad } from "../components/teams/types";
import type { DashboardAsset } from "../types";
import { TradesView, type TradesViewProps } from "./TradesView";

function makeAsset(overrides: Partial<DashboardAsset>): DashboardAsset {
  return {
    assetCode: "p1",
    displayName: "Giocatore",
    docsName: "Giocatore",
    role: "A",
    realTeam: "Squadra",
    quotation: 100,
    purchasePrice: 50,
    ownerTag: "Casa",
    managerCredits: null,
    type: "player",
    active: true,
    isFreeAgent: false,
    ...overrides
  };
}

const media = { player: () => null, crest: () => "" };

const assetsCasa = [
  makeAsset({ assetCode: "c-d1", role: "D", displayName: "Difensore Casa", realTeam: "Inter" }),
  makeAsset({ assetCode: "c-c1", role: "C", displayName: "Centro Casa", realTeam: "Milan" }),
  makeAsset({ assetCode: "c-a1", role: "A", displayName: "Attacco Casa", realTeam: "Roma" })
];

const assetsVilla = [
  makeAsset({ assetCode: "v-d1", role: "D", displayName: "Difensore Villa", realTeam: "Juventus" }),
  makeAsset({ assetCode: "v-a1", role: "A", displayName: "Attacco Villa", realTeam: "Napoli" })
];

function makeSquad(managerName: string, players: DashboardAsset[], credits: number): TeamSquad {
  const roleCounts: TeamSquad["roleCounts"] = { P: 0, D: 0, C: 0, A: 0 };
  players.forEach((player) => { roleCounts[player.role as keyof typeof roleCounts] += 1; });
  return { managerName, credits, logoUrl: "", players, isComplete: false, roleCounts, totalPlayers: players.length };
}

const squadsByManager = {
  Casa: makeSquad("Casa", assetsCasa, 10),
  Villa: makeSquad("Villa", assetsVilla, 10)
};

function renderView(overrides: Partial<TradesViewProps> = {}) {
  return render(
    <TradesView
      managers={["Casa", "Villa"]}
      squadsByManager={squadsByManager}
      media={media}
      leagueId="fp"
      {...overrides}
    />
  );
}

function selectSides() {
  fireEvent.change(screen.getByLabelText("Chi offre"), { target: { value: "Casa" } });
  fireEvent.change(screen.getByLabelText("Chi riceve"), { target: { value: "Villa" } });
}

describe("TradesView", () => {
  it("non seleziona alcuna rosa all'avvio e mostra l'empty state", () => {
    renderView();
    expect(screen.getByRole("heading", { name: "Componi il tuo scambio" })).toBeInTheDocument();
    // nessuna card rosa visibile
    expect(screen.queryByRole("heading", { name: "Casa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Villa" })).not.toBeInTheDocument();
    // selettori con placeholder
    expect(screen.getByLabelText("Chi offre")).toHaveValue("");
    expect(screen.getByLabelText("Chi riceve")).toHaveValue("");
  });

  it("mostra le due card Rose quando vengono scelti i proprietari", () => {
    renderView();
    selectSides();
    expect(screen.getByRole("heading", { name: "Casa" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Villa" })).toBeInTheDocument();
    expect(screen.getByText("Difensore Casa")).toBeInTheDocument();
    expect(screen.getByText("Difensore Villa")).toBeInTheDocument();
  });

  it("non mostra il titolo Scambi né i flag rosa completa/incompleta", () => {
    renderView();
    selectSides();
    // niente h1 "Scambi": il contenuto sta già dentro la tab
    expect(screen.queryByRole("heading", { name: "Scambi" })).not.toBeInTheDocument();
    // nelle card restano solo i crediti, non lo stato rosa
    expect(screen.queryByText(/ROSA COMPLETA|INCOMPLETA/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Crediti").length).toBeGreaterThanOrEqual(2);
  });

  it("mostra stato di selezione finché entrambi i lati non hanno giocatori", () => {
    renderView();
    selectSides();
    expect(screen.getByText(/Seleziona almeno un giocatore/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riepilogo" })).toBeDisabled();
  });

  it("segnala ruoli non bilanciati e blocca il riepilogo", () => {
    renderView();
    selectSides();
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    fireEvent.click(screen.getByText("Attacco Casa"));
    // Casa: D + A → Villa: D → manca A a Villa
    expect(screen.getByText(/Ruoli non bilanciati: A \(1 ↔ 0\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riepilogo" })).toBeDisabled();
  });

  it("abilita il riepilogo quando lo scambio è bilanciato", () => {
    renderView();
    selectSides();
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    expect(screen.getByText(/Scambio pronto/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riepilogo" })).toBeEnabled();
  });

  it("valida i crediti offerti contro i crediti disponibili", () => {
    renderView({ squadsByManager: { Casa: makeSquad("Casa", assetsCasa, 3), Villa: makeSquad("Villa", assetsVilla, 10) } });
    selectSides();
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    fireEvent.click(screen.getByRole("button", { name: "Offri" }));
    const amount = screen.getByRole("spinbutton", { name: "Importo crediti" });
    fireEvent.change(amount, { target: { value: "5" } });
    expect(screen.getByText(/Crediti insufficienti/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riepilogo" })).toBeDisabled();
  });

  it("accetta i crediti offerti entro la disponibilità", () => {
    renderView({ squadsByManager: { Casa: makeSquad("Casa", assetsCasa, 3), Villa: makeSquad("Villa", assetsVilla, 10) } });
    selectSides();
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    fireEvent.click(screen.getByRole("button", { name: "Offri" }));
    const amount = screen.getByRole("spinbutton", { name: "Importo crediti" });
    fireEvent.change(amount, { target: { value: "3" } });
    expect(screen.getByText(/Scambio pronto/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riepilogo" })).toBeEnabled();
  });

  it("parte con input crediti vuoto e la X lo rimuove dallo scambio", () => {
    renderView({ squadsByManager: { Casa: makeSquad("Casa", assetsCasa, 3), Villa: makeSquad("Villa", assetsVilla, 10) } });
    selectSides();
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    fireEvent.click(screen.getByRole("button", { name: "Offri" }));
    // nessuno "0" precompilato
    const amount = screen.getByRole("spinbutton", { name: "Importo crediti" });
    expect(amount).toHaveValue(null);
    fireEvent.change(amount, { target: { value: "3" } });
    // la X toglie i crediti: input e chip spariscono, lo scambio torna senza crediti
    fireEvent.click(screen.getByRole("button", { name: "Rimuovi crediti" }));
    expect(screen.queryByRole("spinbutton", { name: "Importo crediti" })).not.toBeInTheDocument();
    expect(screen.getByText(/Scambio pronto/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riepilogo" })).toBeEnabled();
  });

  it("apre la card Riepilogo con lo scambio visivo (nessuna textarea)", () => {
    renderView();
    selectSides();
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    fireEvent.click(screen.getByRole("button", { name: "Riepilogo" }));

    const dialog = screen.getByRole("dialog", { name: "Riepilogo scambio" });
    expect(within(dialog).getByText("Difensore Casa")).toBeInTheDocument();
    expect(within(dialog).getByText("Difensore Villa")).toBeInTheDocument();
    expect(within(dialog).getByText(/offre/)).toBeInTheDocument();
    expect(within(dialog).getByText(/riceve/)).toBeInTheDocument();
    // niente output di testo grezzo
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Copia messaggio" })).toBeInTheDocument();
  });

  it("copia il messaggio formattato dalla card Riepilogo", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderView();
    selectSides();
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    fireEvent.click(screen.getByRole("button", { name: "Riepilogo" }));

    fireEvent.click(screen.getByRole("button", { name: "Copia messaggio" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("🔄 SCAMBIO · Casa ↔ Villa"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("🟦 D  Difensore Casa"));
    expect(await screen.findByRole("button", { name: "Copiato ✓" })).toBeInTheDocument();
  });

  it("il FAB mobile mostra il totale selezionato e apre la card", () => {
    renderView();
    selectSides();
    const fab = screen.getByRole("button", { name: "Riepilogo (0)" });
    expect(fab).toBeDisabled();
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    const fabActive = screen.getByRole("button", { name: "Riepilogo (2)" });
    expect(fabActive).toBeEnabled();
    fireEvent.click(fabActive);
    expect(screen.getByRole("dialog", { name: "Riepilogo scambio" })).toBeInTheDocument();
  });

  it("reimposta il ricevente se il proponente sceglie lo stesso proprietario", () => {
    renderView();
    selectSides();
    const selectA = screen.getByLabelText("Chi offre");
    fireEvent.change(selectA, { target: { value: "Villa" } });
    const selectB = screen.getByLabelText("Chi riceve") as HTMLSelectElement;
    // "Villa" era in B e ora è in A → B torna al placeholder
    expect(selectB.value).toBe("");
    expect(screen.getByRole("heading", { name: "Componi il tuo scambio" })).toBeInTheDocument();
  });
});
