/* LEAGUE DASHBOARD - Tab interne condivise, dati sempre legati alla lega corrente. */
(function () {
  if (window.LINEUP_FANTA?.route !== "league") return;

  const tabs = Array.from(document.querySelectorAll("[data-league-tab]"));
  const views = Array.from(document.querySelectorAll("[data-league-view]"));
  const formationControls = document.getElementById("formationControls");
  const formationFab = document.getElementById("fabCopy");
  const menuToggle = document.getElementById("leagueMenuToggle");
  const sectionMenu = document.getElementById("leagueSectionMenu");
  const validSections = new Set(views.map((view) => view.dataset.leagueView));

  function setMenuOpen(open, options = {}) {
    if (!menuToggle || !sectionMenu) return;

    const nextOpen = Boolean(open);
    sectionMenu.classList.toggle("is-open", nextOpen);
    menuToggle.setAttribute("aria-expanded", String(nextOpen));
    menuToggle.setAttribute(
      "aria-label",
      nextOpen ? "Chiudi il menu delle sezioni" : "Apri il menu delle sezioni"
    );

    if (!nextOpen && options.restoreFocus) menuToggle.focus();
  }

  function activateSection(section, options = {}) {
    const nextSection = validSections.has(section) ? section : "formation";
    const isFormation = nextSection === "formation";

    tabs.forEach((tab) => {
      const active = tab.dataset.leagueTab === nextSection;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    views.forEach((view) => {
      view.hidden = view.dataset.leagueView !== nextSection;
    });

    if (formationControls) formationControls.hidden = !isFormation;
    if (formationFab) formationFab.hidden = !isFormation;
    if (!isFormation && typeof setRosterOpen === "function") setRosterOpen(false);

    setMenuOpen(false);
    document.documentElement.dataset.leagueSection = nextSection;

    window.dispatchEvent(new CustomEvent("lineup:league-section-change", {
      detail: { section: nextSection }
    }));

  }

  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    setMenuOpen(open);
    if (open) {
      const activeTab = tabs.find((tab) => tab.classList.contains("is-active"));
      window.requestAnimationFrame(() => activeTab?.focus());
    }
  });

  document.addEventListener("click", (event) => {
    if (!sectionMenu?.classList.contains("is-open")) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (sectionMenu.contains(target) || menuToggle?.contains(target)) return;
    setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !sectionMenu?.classList.contains("is-open")) return;
    event.preventDefault();
    setMenuOpen(false, { restoreFocus: true });
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 767px)").matches) setMenuOpen(false);
  });

  // Le tab senza contenuto configurato (es. Regolamento senza URL) restano nascoste
  // e vengono escluse dalla navigazione da tastiera.
  function visibleTabs() {
    return tabs.filter((item) => !item.hidden);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      activateSection(tab.dataset.leagueTab);
      if (window.matchMedia("(max-width: 767px)").matches) menuToggle?.focus();
    });

    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();

      const visible = visibleTabs();
      const current = visible.indexOf(tab);
      let nextIndex = current;
      if (event.key === "ArrowLeft") nextIndex = (current - 1 + visible.length) % visible.length;
      if (event.key === "ArrowRight") nextIndex = (current + 1) % visible.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = visible.length - 1;

      const nextTab = visible[nextIndex];
      nextTab.focus();
      activateSection(nextTab.dataset.leagueTab);
    });
  });

  activateSection("formation");
})();
