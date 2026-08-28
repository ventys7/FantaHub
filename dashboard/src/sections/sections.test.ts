import { describe, expect, it } from "vitest";
import { getSectionRoot, SECTION_ROOTS } from "./sections";

describe("getSectionRoot", () => {
  it("maps each known section to its shell root", () => {
    expect(getSectionRoot("rose")).toEqual({ rootId: "league-rose-root", name: "Rose" });
    expect(getSectionRoot("scambi")).toEqual({ rootId: "league-trades-root", name: "Scambi" });
    expect(getSectionRoot("classifica")).toEqual({
      rootId: "league-standings-root",
      name: "Classifica",
    });
  });

  it("returns null for an unknown or empty section", () => {
    expect(getSectionRoot(null)).toBeNull();
    expect(getSectionRoot(undefined)).toBeNull();
    expect(getSectionRoot("unknown")).toBeNull();
  });

  it("exposes the full section registry", () => {
    expect(Object.keys(SECTION_ROOTS).sort()).toEqual(["classifica", "rose", "scambi"]);
  });
});
