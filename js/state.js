/* SHARED STATE - Used across multiple modules */
let currentManager = "";
let selectedPlayers = [];
let slotAssignments = {};
let draggedPlayerIndex = null;
let draggedPlayerRole = null;
let isModalOpen = false;
let isMobile = window.matchMedia("(max-width: 767px)").matches;

/* Modal state management */
function setModalOpen(open){
  isModalOpen = open;
  if(open){
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}

/* Blocked GK blocks */
let disabledBlocks = new Set();

// React-owned formation writes the shared lexical state so vanilla
// output/copy/persistence/switch modules keep working against the same source.
window.LineupState = Object.freeze({
  setCurrentManager(name) {
    currentManager = name || "";
  },
  setSelectedPlayers(list) {
    selectedPlayers = Array.isArray(list) ? list.slice() : [];
  },
  setSlotAssignments(map) {
    slotAssignments = map && typeof map === "object" ? { ...map } : {};
  },
  setModule(value) {
    const el = document.getElementById("moduleSelect");
    if (el && typeof value === "string") el.value = value;
  },
  syncDisabledBlocks() {
    window.GkBlocks?.syncDisabledBlocks?.();
  },
  getCurrentManager() {
    return currentManager || "";
  },
  getSelectedPlayers() {
    return selectedPlayers.slice();
  },
  getSlotAssignments() {
    return { ...slotAssignments };
  },
  getModule() {
    return document.getElementById("moduleSelect")?.value || "433";
  }
});
