/* OUTPUT - one neutral format, rendered immediately and ready to copy */

function buildLineupModel() {
  const model = window.FormationModel?.build();
  if (!model) return null;

  model.switchPair = window.LineupSwitch?.getPairForModel?.(model) || null;

  return model;
}

function getGoalkeeperBenchLabels(model) {
  return Array.isArray(model?.goalkeeperBenchLabels) ? model.goalkeeperBenchLabels : [];
}

function getSwitchSuffix(model, playerIndex) {
  if (!model.switchPair) return "";

  const isSelectedForSwitch =
    playerIndex === model.switchPair.starterIndex ||
    playerIndex === model.switchPair.benchIndex;

  if (!isSelectedForSwitch) return "";
  return model.switchPair.type === "plus" ? " (s+)" : " (s)";
}

function roleMarker(role) {
  return role === "P" ? "🟨 P" : role === "D" ? "🟦 D" : role === "C" ? "🟩 C" : "🟥 A";
}

function outputPlayerLine(role, name, suffix = "") {
  return `${roleMarker(role)}  ${name}${suffix}`;
}

function buildOutputText() {
  try {
    const model = buildLineupModel();
    if (!model) return "";

    const lines = [
      `⚽ FORMAZIONE · ${model.manager}`,
      `Modulo ${model.module}`,
      "━━━━━━━━━━━━━━━━━━━━",
      "XI TITOLARE"
    ];

    model.starters.forEach((entry) => {
      lines.push(outputPlayerLine(
        entry.player.r,
        entry.player.n,
        getSwitchSuffix(model, entry.index)
      ));
    });

    lines.push("", "PANCHINA");
    getGoalkeeperBenchLabels(model).forEach((label) => {
      lines.push(outputPlayerLine("P", label));
    });

    model.bench
      .filter((entry) => entry.player.r !== "P")
      .forEach((entry) => {
        lines.push(outputPlayerLine(
          entry.player.r,
          entry.player.n,
          getSwitchSuffix(model, entry.index)
        ));
      });

    lines.push("━━━━━━━━━━━━━━━━━━━━");
    return lines.join("\n");
  } catch (error) {
    console.error("buildOutputText error:", error);
    return "Errore nella generazione del testo";
  }
}

function renderOutput() {
  const textarea = document.getElementById("outputText");
  if (textarea) textarea.value = buildOutputText();
}

function toggleModal(show) {
  const modal = document.getElementById("outputModal");
  if (!modal) return;

  modal.classList.toggle("show", show);
  modal.setAttribute("aria-hidden", String(!show));
  setModalOpen(show);
}

function closeModal() {
  toggleModal(false);
}

function openModal() {
  if (!currentManager) {
    showToast("Seleziona una squadra prima", "error");
    return;
  }

  renderOutput();
  toggleModal(true);
}

async function copyText(text) {
  if (!text) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (!fallbackCopy(text)) {
      return;
    }

    window.LineupPersistence?.markCopied(text, "unified");
    showToast("Formazione copiata!", "success");
  } catch (error) {
    const copied = fallbackCopy(text);
    if (copied) window.LineupPersistence?.markCopied(text, "unified");
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  Object.assign(textarea.style, {
    position: "fixed",
    opacity: "0",
    pointerEvents: "none"
  });

  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
    showToast(copied ? "Formazione copiata!" : "Copia fallita", copied ? "success" : "error");
  } catch (error) {
    showToast("Errore durante la copia", "error");
  }

  document.body.removeChild(textarea);
  return copied;
}

function copyOutput() {
  const textarea = document.getElementById("outputText");
  const text = textarea?.value || buildOutputText();
  copyText(text);
}

function replaceAndBindOutputButton(id, handler) {
  const original = document.getElementById(id);
  if (!original) return null;

  const button = original.cloneNode(true);
  original.replaceWith(button);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    handler(event, button);
  });
  return button;
}

document.getElementById("openModalBtn")?.addEventListener("click", openModal);
document.getElementById("fabCopy")?.addEventListener("click", openModal);
document.getElementById("closeModalBtn")?.addEventListener("click", closeModal);
replaceAndBindOutputButton("copyOutputBtn", () => copyOutput());
