import type { FormationModel } from "./formationTypes";

interface SwitchPairLike {
  starterIndex: number;
  benchIndex: number;
  type: "base" | "plus";
}

function roleMarker(role: string): string {
  return role === "P" ? "🟨 P" : role === "D" ? "🟦 D" : role === "C" ? "🟩 C" : "🟥 A";
}

function line(role: string, name: string, suffix = ""): string {
  return `${roleMarker(role)}  ${name}${suffix}`;
}

export function buildOutputText(model: FormationModel, manager: string): string {
  try {
    const pair = (window as unknown as {
      LineupSwitch?: { getPairForModel?: (m: unknown) => SwitchPairLike | null };
    }).LineupSwitch?.getPairForModel?.({ team: model.team, starters: model.starters, bench: model.bench }) || null;

    const suffixFor = (playerIndex: number | null): string => {
      if (playerIndex == null || !pair) return "";
      if (playerIndex === pair.starterIndex || playerIndex === pair.benchIndex) {
        return pair.type === "plus" ? " (s+)" : " (s)";
      }
      return "";
    };

    const lines = [
      `⚽ FORMAZIONE · ${manager}`,
      `Modulo ${model.module}`,
      "━━━━━━━━━━━━━━━━━━━━",
      "XI TITOLARE"
    ];

    model.starters.forEach((entry) => {
      if (!entry?.player) return;
      lines.push(line(entry.player.r, entry.player.n, suffixFor(entry.index)));
    });

    lines.push("", "PANCHINA");
    (Array.isArray(model.goalkeeperBenchLabels) ? model.goalkeeperBenchLabels : []).forEach((label) => {
      lines.push(line("P", label));
    });
    model.bench
      .filter((entry) => entry?.player && entry.player.r !== "P")
      .forEach((entry) => {
        if (!entry?.player) return;
        lines.push(line(entry.player.r, entry.player.n, suffixFor(entry.index)));
      });

    lines.push("━━━━━━━━━━━━━━━━━━━━");
    return lines.join("\n");
  } catch (error) {
    console.error("buildOutputText error:", error);
    return "Errore nella generazione del testo";
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    Object.assign(ta.style, { position: "fixed", opacity: "0", pointerEvents: "none" });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function OutputModal({
  model,
  manager,
  onClose
}: {
  model: FormationModel;
  manager: string;
  onClose: () => void;
}) {
  const text = buildOutputText(model, manager);

  const onCopy = async () => {
    const ok = await copyText(text);
    // eslint-disable-next-line no-alert
    if (ok) window.alert("Formazione copiata!");
    else window.alert("Copia fallita");
  };

  const onStory = () => {
    const opener = (window as unknown as { __openStory?: () => void }).__openStory;
    if (typeof opener === "function") opener();
  };

  return (
    <div
      className="modal output-modal show"
      id="outputModal"
      role="dialog"
      aria-modal="true"
      aria-hidden="false"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="box output-modal-box">
        <h3 className="output-modal-title">La tua formazione</h3>
        <textarea className="formation-output" id="outputText" readOnly value={text} />
        <div className="output-modal-actions">
          <button type="button" className="primary-btn" id="copyOutputBtn" onClick={onCopy}>
            Copia formazione
          </button>
          <button type="button" className="secondary-btn" id="openStoryBtn" onClick={onStory}>
            Crea grafica 9:16
          </button>
        </div>
        <button type="button" className="modal-close" id="closeModalBtn" onClick={onClose} aria-label="Chiudi">
          ×
        </button>
      </div>
    </div>
  );
}
