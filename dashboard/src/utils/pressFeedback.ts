/**
 * Feedback di pressione via Pointer Events per i controlli del listone.
 *
 * Su iOS Safari lo stato CSS `:active` è inaffidabile: scatta in ritardo (attesa
 * double-tap-zoom) e resta "appeso" finché non tocchi altrove, dando l'effetto
 * bottone tenuto premuto con feedback sbagliato. Con Pointer Events la classe
 * `lf-pressed` viene aggiunta al pointerdown e rimossa al rilascio (pointerup /
 * pointercancel / scroll), garantendo feedback immediato e pulito ovunque.
 */

const PRESSED_CLASS = "lf-pressed";
const PRESSABLE = ".lf-role-pill, .lf-mobile-toggle, .lf-mobile-sort-btn";

function findPressable(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(PRESSABLE);
}

export function installPressFeedback(): void {
  if (typeof window === "undefined") return;

  const release = (): void => {
    document.querySelectorAll(`.${PRESSED_CLASS}`).forEach((el) => el.classList.remove(PRESSED_CLASS));
  };

  window.addEventListener(
    "pointerdown",
    (event) => {
      release();
      const el = findPressable(event.target);
      if (el) el.classList.add(PRESSED_CLASS);
    },
    true
  );
  window.addEventListener("pointerup", release, true);
  window.addEventListener("pointercancel", release, true);
  window.addEventListener("scroll", release, true);
}
