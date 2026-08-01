import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DashboardAsset } from "../types";
import { Players } from "./Players";

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

// 4 giocatori finti: le squadre in Attaccanti (Al Nassr < Inter Miami) servono
// per distinguere il criterio "squadra" (default) dal criterio "quotazione".
const assets: DashboardAsset[] = [
  makeAsset({ assetCode: "p1", displayName: "Gianluigi Buffon", docsName: "Gianluigi Buffon", realTeam: "Juventus", role: "P", quotation: 10, purchasePrice: 5 }),
  makeAsset({ assetCode: "p2", displayName: "Nicolò Barella", docsName: "Nicolò Barella", realTeam: "Inter", role: "C", quotation: 120, purchasePrice: 90 }),
  makeAsset({ assetCode: "p3", displayName: "Cristiano Ronaldo", docsName: "Cristiano Ronaldo", realTeam: "Al Nassr", role: "A", quotation: 250, purchasePrice: 180, isFreeAgent: true }),
  makeAsset({ assetCode: "p4", displayName: "Leo Messi", docsName: "Leo Messi", realTeam: "Inter Miami", role: "A", quotation: 300, purchasePrice: 200 })
];

function rowNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".lf-list-row")).map((row) => row.textContent ?? "");
}

function sectionHeaders(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".lf-role-section-header")).map((header) => header.textContent ?? "");
}

describe("Players (listone)", () => {
  it("renderizza il listone con sezioni per ruolo e il totale nella toolbar", () => {
    const { container } = render(<Players assets={assets} />);
    expect(screen.getByText(/tra 4 risultati/)).toBeInTheDocument();
    expect(sectionHeaders(container)).toEqual(["Portieri(1)", "Centrocampisti(1)", "Attaccanti(2)"]);
    expect(screen.getByText("Gianluigi Buffon")).toBeInTheDocument();
    expect(screen.getByText("Leo Messi")).toBeInTheDocument();
  });

  it("il click su Ruolo inverte l'ordine delle sezioni (attaccanti per primi)", () => {
    const { container } = render(<Players assets={assets} />);
    fireEvent.click(screen.getByRole("button", { name: /ruolo/i }));
    expect(sectionHeaders(container)).toEqual(["Attaccanti(2)", "Centrocampisti(1)", "Portieri(1)"]);
  });

  it("multi-sort: Quot. aggiunta come criterio secondario ordina dentro il ruolo", () => {
    const { container } = render(<Players assets={assets} />);
    // Default per ruolo: in Attaccanti vince la squadra (Al Nassr < Inter Miami) → Ronaldo prima di Messi.
    let names = rowNames(container);
    expect(names.findIndex((name) => name.includes("Ronaldo"))).toBeLessThan(names.findIndex((name) => name.includes("Messi")));
    // Aggiungendo Quot. il criterio dentro il ruolo diventa la quotazione → Messi (300) prima di Ronaldo (250).
    fireEvent.click(screen.getByRole("button", { name: /quot/i }));
    names = rowNames(container);
    expect(names.findIndex((name) => name.includes("Messi"))).toBeLessThan(names.findIndex((name) => name.includes("Ronaldo")));
    // Le sezioni restano perché Ruolo è ancora il criterio primario.
    expect(sectionHeaders(container)).toEqual(["Portieri(1)", "Centrocampisti(1)", "Attaccanti(2)"]);
  });

  it("promuovere Quot. a primario mostra la lista piatta ordinata per quotazione", () => {
    const { container } = render(<Players assets={assets} />);
    fireEvent.click(screen.getByRole("button", { name: /quot/i }));
    fireEvent.click(screen.getByRole("button", { name: /quot/i }));
    expect(sectionHeaders(container)).toEqual([]);
    const names = rowNames(container);
    expect(names[0]).toContain("Messi"); // 300
    expect(names[1]).toContain("Ronaldo"); // 250
  });

  it("la ricerca filtra e aggiorna il totale (con debounce)", async () => {
    const { container } = render(<Players assets={assets} />);
    fireEvent.change(screen.getByPlaceholderText("Cerca giocatore..."), { target: { value: "buffon" } });
    await waitFor(() => expect(screen.getByText(/tra 1 su 4 risultati/)).toBeInTheDocument());
    expect(container.querySelectorAll(".lf-list-row")).toHaveLength(1);
    expect(screen.getByText("Gianluigi Buffon")).toBeInTheDocument();
    expect(screen.queryByText("Leo Messi")).not.toBeInTheDocument();
  });

  it("il toggle Svincolati (desktop) filtra i soli svincolati", () => {
    const { container } = render(<Players assets={assets} />);
    fireEvent.click(screen.getByTitle("Mostra solo giocatori svincolati"));
    expect(screen.getByText(/tra 1 su 4 risultati/)).toBeInTheDocument();
    expect(container.querySelectorAll(".lf-list-row")).toHaveLength(1);
    expect(screen.getByText("Cristiano Ronaldo")).toBeInTheDocument();
  });
});
