/* APP EVENTS - Event listeners */

document.body.addEventListener("touchmove", function (event) {
  if (isModalOpen) event.preventDefault();
}, { passive: false });

document.getElementById("moduleSelect").addEventListener("change", () => {
  const module = document.getElementById("moduleSelect").value;
  const team = currentManager ? db[currentManager]?.players : null;
  if (team) {
    slotAssignments = window.FormationModel.reconcileAssignments({
      team,
      selectedPlayers,
      slotAssignments,
      module
    }).assignments;
  }
  renderFormation();
  if (isMobile) renderMobileSlots();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  selectedPlayers = []; disabledBlocks.clear(); slotAssignments = {};
  clearSwitch();
  renderRoster(); renderFormation();
  if (isMobile) renderMobileSlots();
});

document.getElementById("resetBtnMobile")?.addEventListener("click", () => {
  selectedPlayers = []; disabledBlocks.clear(); slotAssignments = {};
  clearSwitch();
  renderRoster(); renderFormation(); renderMobileSlots();
});

function syncAppChromeHeight() {
  const chrome = document.querySelector(".app-chrome");
  if (!chrome) return;

  const update = () => {
    const height = Math.ceil(chrome.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--app-chrome-height", `${height}px`);
  };

  update();

  if ("ResizeObserver" in window) {
    new ResizeObserver(update).observe(chrome);
  } else {
    window.addEventListener("resize", update);
  }

  window.addEventListener("orientationchange", update);
}

syncAppChromeHeight();

const mobileViewportQuery = window.matchMedia("(max-width: 767px)");

function syncViewportMode(event) {
  const nextIsMobile = Boolean(event.matches);
  if (nextIsMobile === isMobile) return;

  isMobile = nextIsMobile;
  if (!currentManager) return;

  renderFormation();
  if (isMobile && typeof renderMobileSlots === "function") renderMobileSlots();
  if (typeof updateSwitchUI === "function") updateSwitchUI();
}

if (typeof mobileViewportQuery.addEventListener === "function") {
  mobileViewportQuery.addEventListener("change", syncViewportMode);
} else {
  mobileViewportQuery.addListener(syncViewportMode);
}

function setRosterOpen(open) {
  const drawer = document.getElementById("rosterDrawer");
  if (!drawer) return;

  drawer.classList.toggle("open", open);
  document.body.classList.toggle("roster-open", open);
  document.documentElement.classList.toggle("roster-open", open);
}

function toggleRoster() {
  const drawer = document.getElementById("rosterDrawer");
  setRosterOpen(!drawer?.classList.contains("open"));
}

document.getElementById("toggleRosterBtn")?.addEventListener("click", toggleRoster);
document.getElementById("closeRosterBtn")?.addEventListener("click", () => setRosterOpen(false));

const rosterDrawerInner = document.querySelector("#rosterDrawer .roster-drawer-inner");

/* Keep wheel scrolling inside the roster. At either boundary, prevent the
   browser from passing the scroll on to the document behind the overlay. */
rosterDrawerInner?.addEventListener("wheel", (event) => {
  const el = rosterDrawerInner;
  const atTop = el.scrollTop <= 0;
  const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
  const movingUp = event.deltaY < 0;
  const movingDown = event.deltaY > 0;

  if ((atTop && movingUp) || (atBottom && movingDown)) {
    event.preventDefault();
  }

  event.stopPropagation();
}, { passive: false });

rosterDrawerInner?.addEventListener("touchmove", (event) => {
  event.stopPropagation();
}, { passive: true });


window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeModal();
  closeSwitchStarterModal();
  closeSwitchBenchModal();
  setRosterOpen(false);
});

if (isMobile) {
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.textContent = "Reset";
}
