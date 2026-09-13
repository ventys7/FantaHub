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

// 4 giocatori finti. Le squadre in Attaccanti (Al Nassr < Inter Miami) servono
// per distinguere il criterio "squadra" (default) dal criterio "quotazione".
const assets: DashboardAsset[] = [
  makeAsset({ assetCode: "p1", displayName: "Gianluigi Buffon", docsName: "Gianluigi Buffon", realTeam: "Juventus", role: "P", quotation: 10, purchasePrice: 5 }),
  makeAsset({ assetCode: "p2", displayName: "Nicolò Barella", docsName: "Nicolò Barella", realTeam: "Inter", role: "C", quotation: 120, purchasePrice: 90 }),
  makeAsset({ assetCode: "p3", displayName: "Cristiano Ronaldo", docsName: "Cristiano Ronaldo", realTeam: "Al Nassr", role: "A", quotation: 250, purchasePrice: 180, isFreeAgent: true }),
  makeAsset({ assetCode: "p4", displayName: "Leo Messi", docsName: "Leo Messi", realTeam: "Inter Miami", role: "A", quotation: 300, purchasePrice: 200 })
];

function searchInput(): HTMLInputElement {
  return screen.getByRole("searchbox", { name: "Cerca giocatore" }) as HTMLInputElement;
}

function rowNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".lf-list-row")).map((row) => row.textContent ?? "");
}

function sectionHeaders(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".lf-role-section-header")).map((header) => header.textContent ?? "");
}

describe("Players (listone)", () => {
  it("renderizza il listone per ruolo con il totale dentro la search bar", () => {
    const { container } = render(<Players assets={assets} />);
    expect(searchInput().placeholder).toBe("Cerca giocatore tra 4 risultati...");
    expect(sectionHeaders(container)).toEqual(["Portieri(1)", "Centrocampisti(1)", "Attaccanti(2)"]);
    expect(screen.getByText("Gianluigi Buffon")).toBeInTheDocument();
    expect(screen.getByText("Leo Messi")).toBeInTheDocument();
  });

  it("non offre più l'ordinamento per ruolo", () => {
    render(<Players assets={assets} />);
    expect(screen.queryByRole("button", { name: /ruolo/i })).not.toBeInTheDocument();
  });

  it("Quot. ordina la lista piatta per quotazione", () => {
    const { container } = render(<Players assets={assets} />);
    fireEvent.click(screen.getByRole("button", { name: /quot/i }));
    expect(sectionHeaders(container)).toEqual([]);
    const names = rowNames(container);
    expect(names[0]).toContain("Messi");   // 300
    expect(names[1]).toContain("Ronaldo"); // 250
    expect(names[2]).toContain("Barella"); // 120
    expect(names[3]).toContain("Buffon");  // 10
  });

  it("il click sul criterio principale resetta del tutto l'ordinamento (default per ruolo)", () => {
    const { container } = render(<Players assets={assets} />);
    fireEvent.click(screen.getByRole("button", { name: /quot/i }));
    fireEvent.click(screen.getByRole("button", { name: /prezzo/i })); // diventa secondario
    fireEvent.click(screen.getByRole("button", { name: /quot/i }));   // primario → reset completo
    expect(sectionHeaders(container)).toEqual(["Portieri(1)", "Centrocampisti(1)", "Attaccanti(2)"]);
    // Dentro Attaccanti torna l'ordine default (squadra A→Z): Al Nassr prima di Inter Miami.
    const names = rowNames(container);
    expect(names.findIndex((name) => name.includes("Ronaldo"))).toBeLessThan(names.findIndex((name) => name.includes("Messi")));
  });

  it("il click su un criterio secondario lo toglie senza toccare il primario", () => {
    const { container } = render(<Players assets={assets} />);
    fireEvent.click(screen.getByRole("button", { name: /quot/i }));
    fireEvent.click(screen.getByRole("button", { name: /prezzo/i }));
    fireEvent.click(screen.getByRole("button", { name: /prezzo/i })); // rimuove il secondario
    expect(sectionHeaders(container)).toEqual([]); // resta Quot. primario → lista piatta
    const names = rowNames(container);
    expect(names[0]).toContain("Messi");
    expect(names[3]).toContain("Buffon");
  });

  it("la ricerca filtra e aggiorna il totale dentro la search bar (con debounce)", async () => {
    const { container } = render(<Players assets={assets} />);
    fireEvent.change(searchInput(), { target: { value: "buffon" } });
    await waitFor(() => expect(searchInput().placeholder).toBe("Cerca giocatore tra 1 su 4 risultati..."));
    expect(container.querySelectorAll(".lf-list-row")).toHaveLength(1);
    expect(screen.getByText("Gianluigi Buffon")).toBeInTheDocument();
    expect(screen.queryByText("Leo Messi")).not.toBeInTheDocument();
  });

  it("normalizza lettere estese, apostrofi, trattini e spazi nella ricerca", async () => {
    const normalizedAsset = makeAsset({
      assetCode: "special",
      displayName: "Álvaro Ødegaard Ægir Œzil Łukasz Guðmundur Þór ßahin Işık Đoković",
      docsName: "Speciale",
      realTeam: "D’Angelo—United"
    });
    render(<Players assets={[normalizedAsset, makeAsset({ assetCode: "other", displayName: "Altro giocatore" })]} />);

    fireEvent.change(searchInput(), {
      target: { value: "  alvaro odegaard aegir oezil lukasz gudmundur thor ssahin isik dokovic   dangelo - united  " }
    });

    await waitFor(() => expect(searchInput().placeholder).toBe("Cerca giocatore tra 1 su 2 risultati..."));
    expect(screen.getByText(normalizedAsset.displayName)).toBeInTheDocument();
  });

  it("i toggle Svincolati espongono lo stesso stato e reset accessibile", () => {
    const { container } = render(<Players assets={assets} />);
    const toggles = screen.getAllByRole("button", { name: "Svincolati" });
    toggles.forEach((toggle) => expect(toggle).toHaveAttribute("aria-pressed", "false"));

    fireEvent.click(toggles[0]);

    screen.getAllByRole("button", { name: "Svincolati" }).forEach((toggle) => expect(toggle).toHaveAttribute("aria-pressed", "true"));
    expect(searchInput().placeholder).toBe("Cerca giocatore tra 1 su 4 risultati...");
    expect(container.querySelectorAll(".lf-list-row")).toHaveLength(1);
    expect(screen.getByText("Cristiano Ronaldo")).toBeInTheDocument();

    const resetButtons = screen.getAllByRole("button", { name: "Azzera filtri" });
    expect(resetButtons).toHaveLength(2);
    fireEvent.click(resetButtons[0]);
    screen.getAllByRole("button", { name: "Svincolati" }).forEach((toggle) => expect(toggle).toHaveAttribute("aria-pressed", "false"));
  });
});
