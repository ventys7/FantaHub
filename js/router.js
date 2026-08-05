(function () {
  const params = new URLSearchParams(window.location.search);
  const localPreviewLeague = params.get("league");

  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const pathLeague =
    ["/fp", "/fp/index.html"].includes(path) ? "fp" :
    ["/pd", "/pd/index.html"].includes(path) ? "pd" :
    null;

  const leagueId =
    ["fp", "pd"].includes(localPreviewLeague)
      ? localPreviewLeague
      : pathLeague;

  const league = leagueId ? window.LINEUP_LEAGUES[leagueId] : null;

  window.LINEUP_FANTA = Object.freeze({
    route: league ? "league" : "home",
    leagueId,
    league
  });

  const isLocalStaticServer = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  function leagueHref(id) {
    return isLocalStaticServer ? `/?league=${id}` : `/${id}`;
  }

  function applyLeagueIdentity() {
    const logo = document.getElementById("leagueLogo");

    if (logo) {
      logo.src = league.identity.logo;
      logo.alt = `Logo ${league.name}`;
      logo.hidden = false;
    }

    window.applyLineupIdentity?.(league.identity);
  }

  function applyLeagueTheme() {
    if (!league) return;

    document.title = league.name;
    document.documentElement.dataset.league = league.id;
    document.body.dataset.route = "league";

    const theme = league.theme;
    document.documentElement.style.setProperty("--primary", theme.primary);
    document.documentElement.style.setProperty("--primary-light", theme.primaryLight);
    document.documentElement.style.setProperty("--primary-bg", theme.primaryBg);
    document.documentElement.style.setProperty("--primary-border", theme.primaryBorder);
    document.documentElement.style.setProperty("--bg", theme.background);

    applyLeagueIdentity();

    const title = document.querySelector("header h1");
    if (title) title.textContent = league.name;
  }

  function createLeagueCard(id) {
    const item = window.LINEUP_LEAGUES[id];

    return `
      <a class="league-choice league-choice--${id}" href="${leagueHref(id)}">
        <span class="league-choice__flag">${item.flag}</span>
        <span class="league-choice__content">
          <strong>${item.label}</strong>
          <small>${item.name}</small>
        </span>
        <span class="league-choice__arrow" aria-hidden="true">→</span>
      </a>
    `;
  }

  function renderLeaguePicker() {
    document.title = "FantaHub";
    delete document.documentElement.dataset.league;
    window.applyLineupIdentity?.(null);
    document.body.dataset.route = "home";

    const landing = document.createElement("main");
    landing.className = "league-landing";
    landing.innerHTML = `
      <section class="league-landing__hero">
        <p class="league-landing__eyebrow">FANTAHUB</p>
        <h1>La tua formazione,<br><span>la tua lega.</span></h1>
        <p class="league-landing__intro">
          Scegli la competizione per accedere alla tua rosa e preparare la formazione.
        </p>
      </section>

      <section class="league-choices" aria-label="Scegli la lega">
        ${createLeagueCard("fp")}
        ${createLeagueCard("pd")}
      </section>
    `;

    // La home non deve ereditare neppure un frammento della vecchia Lineup FP.
    document.body.replaceChildren(landing);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (league) {
      applyLeagueTheme();
    } else {
      renderLeaguePicker();
    }
  });
})();
