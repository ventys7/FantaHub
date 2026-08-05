/* SLOTS RENDER - Desktop field and bench from the shared FormationModel */

function createFormationSlotVisual(role, entry, { compact = false } = {}) {
  const content = document.createElement("div");
  content.className = "formation-slot__content";

  const shirt = document.createElement("div");
  shirt.className = "formation-shirt";
  shirt.dataset.role = role;

  const roleBadge = document.createElement("span");
  roleBadge.className = "formation-shirt__role";
  roleBadge.textContent = role;

  const portrait = document.createElement("span");
  portrait.className = "formation-shirt__photo";

  const name = document.createElement("span");
  name.className = "formation-shirt__name";

  const team = document.createElement("span");
  team.className = "formation-shirt__team";

  if (entry?.player) {
    shirt.classList.add("formation-shirt--selected");
    const player = entry.player;
    const source = player.isTeamLabel
      ? window.LineupPlayerMedia?.crest(player.n)
      : window.LineupPlayerMedia?.photo(player.n, player.t);
    if (source) {
      const image = document.createElement("img");
      image.src = source;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      if (player.isTeamLabel) image.className = "is-crest";
      portrait.appendChild(image);
      shirt.classList.add("formation-shirt--has-photo");
    } else {
      portrait.hidden = true;
    }
    name.textContent = player.n || "Giocatore";
    team.textContent = compact ? "" : (player.t || "");
  } else {
    shirt.classList.add("formation-shirt--empty");
    portrait.hidden = true;
    name.textContent = "Scegli";
    team.textContent = compact ? "" : "Tocca lo slot";
  }

  shirt.append(roleBadge, portrait, name, team);
  content.appendChild(shirt);
  return content;
}

function bindDesktopDrag(slot, entry) {
  if (!entry?.player || entry.player.isTeamLabel || !Number.isInteger(entry.index)) return;

  slot.draggable = true;
  slot.ondragstart = () => {
    draggedPlayerIndex = entry.index;
    draggedPlayerRole = entry.player.r;
    slot.classList.add("dragging");
  };
  slot.ondragend = () => {
    draggedPlayerIndex = null;
    draggedPlayerRole = null;
    slot.classList.remove("dragging");
  };
}

function createDesktopSlot(definition, entry, side) {
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = `slot formation-slot formation-slot--${side}`;
  slot.id = `${side}-${definition.id}`;
  slot.dataset.role = definition.role;
  slot.dataset.slotKey = definition.key;
  slot.setAttribute("aria-label", `${definition.label}: ${entry?.player?.n || "vuoto"}`);

  if (!entry?.player) slot.classList.add("empty");
  if (entry?.player?.isTeamLabel) slot.classList.add("formation-slot--team-label");

  slot.appendChild(createFormationSlotVisual(definition.role, entry));
  slot.onclick = () => openSlotPicker(side, definition.id);
  slot.ondragover = (event) => {
    event.preventDefault();
    slot.classList.add("drag-over");
  };
  slot.ondragleave = () => slot.classList.remove("drag-over");
  slot.ondrop = (event) => handleDrop(event, side, definition.id);

  bindDesktopDrag(slot, entry);
  return slot;
}

function groupDefinitionsByRole(definitions) {
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

function renderRoleRows(container, definitions, slots, side, model) {
  groupDefinitionsByRole(definitions).forEach((group) => {
    const row = document.createElement("div");
    row.className = `formation-row formation-row--${group.role}`;
    row.dataset.count = String(group.definitions.length);
    row.style.setProperty("--row-count", String(group.definitions.length));

    group.definitions.forEach((definition) => {
      const entry = side === "bench"
        ? window.FormationModel.getBenchDisplayEntry(model, definition)
        : slots[definition.id] || null;
      row.appendChild(createDesktopSlot(definition, entry, side));
    });

    container.appendChild(row);
  });
}

/* Bench is deliberately not a pyramid: P P above three role columns D / C / A.
   Within each column, the vertical order is the bench priority for that role. */
function renderBenchMatrix(container, definitions, model) {
  const keepers = definitions.filter((definition) => definition.role === "P");
  const movementRoles = ["D", "C", "A"];

  const keeperRow = document.createElement("div");
  keeperRow.className = "bench-keepers";
  keeperRow.style.setProperty("--row-count", String(keepers.length));
  keepers.forEach((definition) => {
    const entry = window.FormationModel.getBenchDisplayEntry(model, definition);
    keeperRow.appendChild(createDesktopSlot(definition, entry, "bench"));
  });
  container.appendChild(keeperRow);

  const matrix = document.createElement("div");
  matrix.className = "bench-matrix";

  movementRoles.forEach((role) => {
    const column = document.createElement("div");
    column.className = `bench-column bench-column--${role}`;

    definitions
      .filter((definition) => definition.role === role)
      .forEach((definition) => {
        const entry = window.FormationModel.getBenchDisplayEntry(model, definition);
        column.appendChild(createDesktopSlot(definition, entry, "bench"));
      });

    matrix.appendChild(column);
  });

  container.appendChild(matrix);
}

function updateDesktopCounters(model) {
  const starterCount = document.getElementById("starterCount");
  const benchCount = document.getElementById("benchCount");
  if (starterCount) starterCount.textContent = `(${model.counts.starters}/11)`;
  if (benchCount) benchCount.textContent = `(${model.counts.bench}/11)`;
}

function renderFormation() {
  const startersContainer = document.getElementById("startersSlots");
  const benchContainer = document.getElementById("benchSlots");
  if (!startersContainer || !benchContainer) return;

  const model = window.FormationModel?.build();
  if (!model) {
    startersContainer.style.display = "none";
    benchContainer.style.display = "none";
    return;
  }

  startersContainer.style.display = "flex";
  benchContainer.style.display = "block";
  startersContainer.replaceChildren();
  benchContainer.replaceChildren();

  renderRoleRows(startersContainer, model.definitions.starter, model.slots.starter, "starter", model);
  renderBenchMatrix(benchContainer, model.definitions.bench, model);
  updateDesktopCounters(model);

  window.LineupSwitch?.reconcile();
  window.LineupPersistence?.queueDraftSave?.();
}
