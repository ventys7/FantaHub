/**
 * Feedback di pressione per i controlli del listone.
 *
 * Su iOS Safari lo stato CSS `:active` è inaffidabile: scatta in ritardo e resta
 * "appeso" finché non tocchi altrove. Inoltre lo `:hover` su touch è sticky
 * (si attacca al primo tap e resta finché non tocchi altrove). Quindi su touch
 * il feedback è guidato via Pointer Events (con fallback touch/mouse): l'attributo
 * `data-lf-pressed` viene aggiunto al pointerdown e rimosso al rilascio.
 *
 * ATTRIBUTO E NON CLASSE: i controlli del listone sono componenti React che al
 * click (setState) vengono re-renderizzati: React riscrive `className` e cancella
 * qualsiasi classe aggiunta via JS prima che il browser la disegni — il feedback
 * diventava invisibile proprio su iPhone. Un data-attribute impostato fuori da
 * React non viene toccato dal re-render.
 *
 * RILASCIO RITARDATO: iOS Safari sospende il rendering mentre il dito è sul
 * display — l'attributo aggiunto al pointerdown di un tap rapido verrebbe rimosso
 * al pointerup PRIMA che il browser disegni un frame, rendendo il feedback
 * invisibile. Il rilascio viene quindi ritardato di MIN_FEEDBACK_MS: il feedback
 * resta visibile almeno un frame anche per i tap più veloci.
 */

const PRESSED_ATTR = "data-lf-pressed";
const MIN_FEEDBACK_MS = 120;
const PRESSABLE = [
  ".lf-role-pill",
  ".lf-mobile-toggle",
  ".lf-mobile-sort-btn",
  ".lf-action-button",
  ".lf-reset-button"
].join(", ");

function findPressable(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(PRESSABLE);
}

export function installPressFeedback(): void {
  if (typeof window === "undefined") return;

  // Guardia anti doppia installazione (utile nei test, che ri-installano per
  // cambiare ramo Pointer Events / fallback).
  if ((window as unknown as { __pressFeedbackInstalled?: boolean }).__pressFeedbackInstalled) return;
  (window as unknown as { __pressFeedbackInstalled: boolean }).__pressFeedbackInstalled = true;

  let releaseTimer: ReturnType<typeof setTimeout> | undefined;

  const release = (): void => {
    document.querySelectorAll(`[${PRESSED_ATTR}]`).forEach((el) => el.removeAttribute(PRESSED_ATTR));
  };

  const clearTimer = (): void => {
    if (releaseTimer !== undefined) {
      clearTimeout(releaseTimer);
      releaseTimer = undefined;
    }
  };

  const press = (event: Event): void => {
    clearTimer();
    release();
    const el = findPressable(event.target);
    if (el) el.setAttribute(PRESSED_ATTR, "true");
  };

  // Rilascio "sicuro": il feedback resta visibile almeno MIN_FEEDBACK_MS.
  const scheduleRelease = (): void => {
    clearTimer();
    releaseTimer = window.setTimeout(release, MIN_FEEDBACK_MS);
  };

  // Rilascio immediato: gesto interrotto (cancel) o rubato (scroll).
  const cancel = (): void => {
    clearTimer();
    release();
  };

  // Pointer Events (iOS 13+, tutti i browser moderni).
  const hasPointerEvents = typeof window.PointerEvent !== "undefined";
  if (hasPointerEvents) {
    window.addEventListener("pointerdown", press, true);
    window.addEventListener("pointerup", scheduleRelease, true);
    window.addEventListener("pointercancel", cancel, true);
  } else {
    // Fallback: webview/iOS < 13 senza Pointer Events.
    window.addEventListener("touchstart", press, { capture: true, passive: true });
    window.addEventListener("touchend", scheduleRelease, { capture: true, passive: true });
    window.addEventListener("touchcancel", cancel, { capture: true, passive: true });
    window.addEventListener("mousedown", press, true);
    window.addEventListener("mouseup", scheduleRelease, true);
  }

  // Lo scroll (gesto che "ruba" il pointer su iOS) deve rilasciare subito.
  window.addEventListener("scroll", cancel, true);
}
