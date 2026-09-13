/* MOBILE SLOTS - Same formation model, touch-first interaction */

function createMobileSlot(definition, entry, isStarter) {
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = `slot formation-slot formation-slot--${isStarter ? "starter" : "bench"} formation-slot--mobile`;
  slot.id = `mobile-${isStarter ? "starter" : "bench"}-${definition.id}`;
  slot.dataset.role = definition.role;
  slot.dataset.slotKey = definition.key;
  slot.setAttribute("aria-label", `${definition.label}: ${entry?.player?.n || "vuoto"}`);

  if (!entry?.player) slot.classList.add("empty");
  if (entry?.player?.isTeamLabel) slot.classList.add("formation-slot--team-label");

  slot.appendChild(createFormationSlotVisual(definition.role, entry));
  slot.onclick = () => handleMobileSlotClick(definition, isStarter, entry?.player || null);
  return slot;
}

function groupMobileDefinitionsByRole(definitions) {
  const groups = [];
  definitions.forEach((definition) => {
    const previous = groups.at(-1);
    if (!previous || previous.role !== definition.role) {
      groups.push({ role: definition.role, definitions: [] });
    }
    groups.at(-1).definitions.push(definition);
  });
  return groups;
}

function renderMobileRoleRows(container, definitions, side, model) {
  groupMobileDefinitionsByRole(definitions).forEach((group) => {
    const row = document.createElement("div");
    row.className = `formation-row formation-row--${group.role}`;
    row.dataset.count = String(group.definitions.length);
    row.style.setProperty("--row-count", String(group.definitions.length));

    group.definitions.forEach((definition) => {
      const entry = side === "bench"
        ? window.FormationModel.getBenchDisplayEntry(model, definition)
        : model.slots.starter[definition.id] || null;
      row.appendChild(createMobileSlot(definition, entry, side === "starter"));
    });

    container.appendChild(row);
  });
}

/* Same priority layout as desktop: P P, then vertical D / C / A columns. */
function renderMobileBenchMatrix(container, definitions, model) {
  const keepers = definitions.filter((definition) => definition.role === "P");
  const keeperRow = document.createElement("div");
  keeperRow.className = "bench-keepers";
  keeperRow.style.setProperty("--row-count", String(keepers.length));

  keepers.forEach((definition) => {
    const entry = window.FormationModel.getBenchDisplayEntry(model, definition);
    keeperRow.appendChild(createMobileSlot(definition, entry, false));
  });
  container.appendChild(keeperRow);

  const matrix = document.createElement("div");
  matrix.className = "bench-matrix";

  ["D", "C", "A"].forEach((role) => {
    const column = document.createElement("div");
    column.className = `bench-column bench-column--${role}`;

    definitions
      .filter((definition) => definition.role === role)
      .forEach((definition) => {
        const entry = window.FormationModel.getBenchDisplayEntry(model, definition);
        column.appendChild(createMobileSlot(definition, entry, false));
      });

    matrix.appendChild(column);
  });

  container.appendChild(matrix);
}

function updateMobileCounters(model) {
  const starterCount = document.getElementById("mobileStarterCount");
  const benchCount = document.getElementById("mobileBenchCount");
  if (starterCount) starterCount.textContent = `(${model.counts.starters}/11)`;
  if (benchCount) benchCount.textContent = `(${model.counts.bench}/11)`;
}

function renderMobileSlots() {
  const startersContainer = document.getElementById("mobileStartersSlots");
  const benchContainer = document.getElementById("mobileBenchSlots");
  if (!startersContainer || !benchContainer) return;

  const model = window.FormationModel?.build();
  if (!model) return;

  startersContainer.replaceChildren();
  benchContainer.replaceChildren();
  startersContainer.style.display = "flex";
  benchContainer.style.display = "block";

  renderMobileRoleRows(startersContainer, model.definitions.starter, "starter", model);
  renderMobileBenchMatrix(benchContainer, model.definitions.bench, model);
  updateMobileCounters(model);

  window.LineupSwitch?.reconcile();
}

function handleMobileSlotClick(definition, isStarter, currentPlayer) {
  if (!currentManager) return;

  const role = definition.role;
  if (role === "P") {
    currentPickerSlot = {
      slotId: definition.id,
      role,
      isStarter,
      currentPlayer
    };
    showGkChoiceModalForMobile(definition.id, isStarter, currentPlayer);
    return;
  }

  if (currentPlayer?.isTeamLabel) {
    showSlotPicker(role, null);
    return;
  }

  currentPickerSlot = {
    slotId: definition.id,
    role,
    isStarter,
    currentPlayer
  };
  showSlotPicker(role, currentPlayer);
}
