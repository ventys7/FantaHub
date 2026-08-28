import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "../theme/ThemeProvider";
import { AppShell } from "./AppShell";
import { LeagueHeader, LeagueHeaderLeague } from "./LeagueHeader";

const fpLeague: LeagueHeaderLeague = {
  id: "fp",
  name: "PianginaCUP",
  label: "Fanta Premier",
  identity: { logo: "assets/identity/fp-logo.png" },
};

const pdLeague: LeagueHeaderLeague = {
  id: "pd",
  name: "LaLigaCUP",
  label: "Fanta Liga",
  identity: { logo: "assets/identity/pd-logo.png" },
};

describe("LeagueHeader", () => {
  it("renders logo and league name", () => {
    render(<LeagueHeader league={fpLeague} />);
    const logo = screen.getByAltText("Logo PianginaCUP") as HTMLImageElement;
    expect(logo).toHaveAttribute("src", "assets/identity/fp-logo.png");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("PianginaCUP");
  });

  it("applies the PD primary colour to the menu toggle when wrapped in ThemeProvider", () => {
    const onMenuToggle = () => {};
    const { container } = render(
      <ThemeProvider leagueId="pd">
        <LeagueHeader league={pdLeague} onMenuToggle={onMenuToggle} />
      </ThemeProvider>
    );
    const button = container.querySelector(".lf-app-header__menu") as HTMLButtonElement;
    expect(button).toHaveStyle({ borderColor: "#b91c1c" });
  });

  it("omits the menu toggle when no handler is provided", () => {
    const { container } = render(<LeagueHeader league={fpLeague} />);
    expect(container.querySelector(".lf-app-header__menu")).toBeNull();
  });
});

describe("AppShell", () => {
  it("renders the header and the children", () => {
    render(
      <AppShell league={fpLeague}>
        <p>contenuto sezione</p>
      </AppShell>
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("PianginaCUP");
    expect(screen.getByText("contenuto sezione")).toBeInTheDocument();
    expect(document.querySelector(".lf-app-shell__main")).not.toBeNull();
  });
});
