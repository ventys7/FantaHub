/**
 * Feedback di pressione per i controlli del listone.
 *
 * Su iOS Safari lo stato CSS `:active` è inaffidabile: scatta in ritardo e resta
 * "appeso" finché non tocchi altrove. Inoltre lo `:hover` su touch è sticky
 * (si attacca al primo tap e resta finché non tocchi altrove). Quindi su touch
 * il feedback è guidato via Pointer Events (con fallback touch/mouse): la classe
 * `lf-pressed` viene aggiunta al pointerdown e rimossa al rilascio (pointerup /
 * pointercancel / scroll), dando feedback immediato e pulito.
 */

const PRESSED_CLASS = "lf-pressed";
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

  const release = (): void => {
    document.querySelectorAll(`.${PRESSED_CLASS}`).forEach((el) => el.classList.remove(PRESSED_CLASS));
  };

  const press = (event: Event): void => {
    release();
    const el = findPressable(event.target);
    if (el) el.classList.add(PRESSED_CLASS);
  };

  // Pointer Events (iOS 13+, tutti i browser moderni).
  const hasPointerEvents = typeof window.PointerEvent !== "undefined";
  if (hasPointerEvents) {
    window.addEventListener("pointerdown", press, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
  } else {
    // Fallback: webview/iOS < 13 senza Pointer Events.
    window.addEventListener("touchstart", press, { capture: true, passive: true });
    window.addEventListener("touchend", release, { capture: true, passive: true });
    window.addEventListener("touchcancel", release, { capture: true, passive: true });
    window.addEventListener("mousedown", press, true);
    window.addEventListener("mouseup", release, true);
  }

  // Lo scroll (gesto che "ruba" il pointer su iOS) deve rilasciare subito.
  window.addEventListener(
    "scroll",
    () => {
      document.querySelectorAll(`.${PRESSED_CLASS}`).forEach((el) => el.classList.remove(PRESSED_CLASS));
    },
    true
  );
}
