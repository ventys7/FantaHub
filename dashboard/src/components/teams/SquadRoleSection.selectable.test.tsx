import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardAsset } from "../types";
import { SquadRoleSection } from "./SquadRoleSection";

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

const players = [
  makeAsset({ assetCode: "d1", role: "D", displayName: "Difensore Uno", realTeam: "Inter" }),
  makeAsset({ assetCode: "d2", role: "D", displayName: "Difensore Due", realTeam: "Milan" }),
  makeAsset({ assetCode: "b1", role: "P", type: "goalkeeper_block", displayName: "Marco - Luca", realTeam: "Roma" })
];

function Harness({ selectable }: { selectable: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <SquadRoleSection
      players={players}
      role="D"
      label="Difensori"
      media={media}
      selectable={selectable}
      selectedCodes={selected}
      onToggleSelect={(code) => setSelected((current) => {
        const next = new Set(current);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        return next;
      })}
    />
  );
}

describe("SquadRoleSection selectable", () => {
  it("in modalità non selezionabile le righe non sono bottoni", () => {
    render(<SquadRoleSection players={players} role="D" label="Difensori" media={media} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("le righe diventano bottoni con check e il click seleziona", () => {
    render(<Harness selectable />);
    const row = screen.getByRole("button", { name: /Difensore Uno/ });
    expect(row).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(within(row).getByText("✓")).toBeInTheDocument();
    // secondo click deseleziona
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "false");
  });

  it("il blocco portieri seleziona e apre subito la tendina dei singoli, senza chevron", () => {
    const onToggle = vi.fn();
    function StatefulHarness() {
      const [selected, setSelected] = useState<Set<string>>(new Set());
      return (
        <SquadRoleSection
          players={[players[2]]}
          role="P"
          label="Portieri"
          media={media}
          selectable
          selectedCodes={selected}
          onToggleSelect={(code) => {
            onToggle(code);
            setSelected((current) => {
              const next = new Set(current);
              if (next.has(code)) next.delete(code);
              else next.add(code);
              return next;
            });
          }}
        />
      );
    }
    render(<StatefulHarness />);

    // nessun chevron: esiste solo il bottone della riga
    expect(screen.queryByRole("button", { name: /Mostra i portieri del blocco/ })).not.toBeInTheDocument();

    // il click seleziona il blocco e apre la tendina dei portieri
    const row = screen.getByRole("button", { name: /Blocco Roma/ });
    fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledWith("b1");
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Marco")).toBeInTheDocument();
    expect(screen.getByText("Luca")).toBeInTheDocument();

    // deselezionando la tendina si richiude
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Marco")).not.toBeInTheDocument();
  });
});
