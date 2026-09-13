/* APP - Toast and init */

function showToast(message, type = "error") {
  if (isMobile && type === "success") return;

  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");

  toast.className = "toast " + (type === "success" ? "success" : "error");
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "toastOut 0.28s forwards";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/* INIT */
if (window.LINEUP_FANTA?.route === "league") {
  window.LineupPersistence?.setup();
  window.LineupFixtures?.setup?.();
  setupSwitchListeners();
  setupModalClickOutside();
  window.addEventListener("lineup:player-media-ready", (event) => {
    const leagueId = window.LINEUP_FANTA?.league?.id;
    if (event.detail?.leagueId && event.detail.leagueId !== leagueId) return;
    if (currentManager) renderRoster();
    renderFormation();
    if (isMobile && typeof renderMobileSlots === "function") renderMobileSlots();
  });
  void loadCSV().catch(() => {});
}
