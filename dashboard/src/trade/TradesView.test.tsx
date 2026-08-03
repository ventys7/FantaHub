import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

function renderView(overrides: Partial<TradesViewProps> = {}) {
  return render(
    <TradesView
      managers={["Casa", "Villa"]}
      assetsByManager={{ Casa: assetsCasa, Villa: assetsVilla }}
      creditsByManager={{ Casa: 10, Villa: 10 }}
      media={media}
      {...overrides}
    />
  );
}

describe("TradesView", () => {
  it("mostra i due pannelli con le rose dei proprietari selezionati", () => {
    renderView();
    expect(screen.getByRole("heading", { name: "Casa" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Villa" })).toBeInTheDocument();
    expect(screen.getByText("Difensore Casa")).toBeInTheDocument();
    expect(screen.getByText("Difensore Villa")).toBeInTheDocument();
  });

  it("mostra stato di selezione finché entrambi i lati non hanno giocatori", () => {
    renderView();
    expect(screen.getByText(/Seleziona almeno un giocatore/)).toBeInTheDocument();
    const copyButton = screen.getByRole("button", { name: "Visualizza / Copia" });
    expect(copyButton).toBeDisabled();
  });

  it("segnala ruoli non bilanciati e blocca la copia", () => {
    renderView();
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    fireEvent.click(screen.getByText("Attacco Casa"));
    // Casa: D + A → Villa: D → manca A a Villa
    expect(screen.getByText(/Ruoli non bilanciati: A \(1 ↔ 0\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visualizza / Copia" })).toBeDisabled();
  });

  it("abilita la copia quando lo scambio è bilanciato", () => {
    renderView();
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    expect(screen.getByText(/Scambio pronto/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visualizza / Copia" })).toBeEnabled();
  });

  it("valida i crediti offerti contro i crediti disponibili", () => {
    renderView({ creditsByManager: { Casa: 3, Villa: 10 } });
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    fireEvent.click(screen.getByRole("button", { name: "Offri" }));
    const amount = screen.getByRole("spinbutton", { name: "Importo crediti" });
    fireEvent.change(amount, { target: { value: "5" } });
    expect(screen.getByText(/Crediti insufficienti/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visualizza / Copia" })).toBeDisabled();
  });

  it("accetta i crediti offerti entro la disponibilità", () => {
    renderView({ creditsByManager: { Casa: 10, Villa: 10 } });
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    fireEvent.click(screen.getByRole("button", { name: "Offri" }));
    const amount = screen.getByRole("spinbutton", { name: "Importo crediti" });
    fireEvent.change(amount, { target: { value: "5" } });
    expect(screen.getByText(/Scambio pronto/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visualizza / Copia" })).toBeEnabled();
  });

  it("apre la modal con il messaggio formattato al click su Visualizza / Copia", () => {
    renderView();
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.click(screen.getByText("Difensore Villa"));
    fireEvent.click(screen.getByRole("button", { name: "Visualizza / Copia" }));

    const dialog = screen.getByRole("dialog", { name: "Scambio" });
    const output = within(dialog).getByRole("textbox", { name: "Testo dello scambio" }) as HTMLTextAreaElement;
    expect(output.value).toContain("🔄 SCAMBIO · Casa ↔ Villa");
    expect(output.value).toContain("🟦 D  Difensore Casa");
    expect(output.value).toContain("🟦 D  Difensore Villa");
  });

  it("non ripete il proprietario nei selettori quando cambia il lato", () => {
    renderView();
    const selectB = screen.getByLabelText("Chi riceve");
    fireEvent.change(selectB, { target: { value: "Villa" } });
    expect(within(selectB).getAllByRole("option").map((o) => o.textContent)).toEqual(["Villa"]);
    // selezione resettata al cambio proprietario
    fireEvent.click(screen.getByText("Difensore Casa"));
    fireEvent.change(selectB, { target: { value: "Casa" } });
    expect(screen.getByText(/Seleziona almeno un giocatore/)).toBeInTheDocument();
  });

  it("reimposta il ricevente se il proponente sceglie lo stesso proprietario", () => {
    renderView();
    const selectA = screen.getByLabelText("Chi offre");
    fireEvent.change(selectA, { target: { value: "Villa" } });
    const selectB = screen.getByLabelText("Chi riceve") as HTMLSelectElement;
    // "Villa" era in B e ora è in A → B deve spostarsi sull'altro proprietario
    expect(selectB.value).not.toBe("Villa");
    expect(within(selectB).getAllByRole("option").map((o) => o.textContent)).toEqual(["Casa"]);
  });
});
