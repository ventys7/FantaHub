import { describe, expect, it } from "vitest";
import { formatSquadLabel } from "./squadLabel";

describe("formatSquadLabel", () => {
  it("returns only the participant when the fantasy name is missing", () => {
    expect(formatSquadLabel("Partecipante Uno")).toBe("Partecipante Uno");
    expect(formatSquadLabel("Partecipante Uno", "")).toBe("Partecipante Uno");
    expect(formatSquadLabel("Partecipante Uno", "   ")).toBe("Partecipante Uno");
  });

  it("formats participant (fantasy name) when set", () => {
    expect(formatSquadLabel("Partecipante Uno", "Squadra Test")).toBe("Partecipante Uno (Squadra Test)");
  });

  it("trims the fantasy name", () => {
    expect(formatSquadLabel("Partecipante Uno", "  Squadra Test  ")).toBe("Partecipante Uno (Squadra Test)");
  });
});
