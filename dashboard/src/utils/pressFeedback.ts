/**
 * Feedback di pressione per i controlli del listone.
 *
 * Su iOS Safari lo stato CSS `:active` è inaffidabile: scatta in ritardo e resta
 * "appeso" finché non tocchi altrove. Inoltre lo `:hover` su touch è sticky
 * (si attacca al primo tap e resta finché non tocchi altrove). Quindi su touch
 * il feedback è guidato via Pointer Events (con fallback touch/mouse): l'attributo
 * `data-lf-pressed` viene aggiunto al pointerdown.
 *
 * COMPORTAMENTO (richiesto dall'utente): al tap il bottone DIVENTA del colore
 * pattern e RESTA così ("voglio che rimanga il colore pattern, stop" — niente
 * lampeggio che torna grigio). Su touch lo stato è quindi un LATCH:
 * - il bottone resta data-lf-pressed finché non ne premi un altro (il nuovo
 *   press rilascia il precedente) o il gesto viene rubato (scroll/cancel);
 * - il pointerup NON rimuove lo stato (rimuoverlo al rilascio rendeva il
 *   feedback un lampo impercettibile: su iOS il rendering è sospeso durante
 *   il tocco, quindi l'unica parte visibile era il post-rilascio).
 * Su desktop (hover: hover) il rilascio rimuove subito lo stato: ci pensa lo
 * :hover a dare continuità visiva.
 *
 * ATTRIBUTO E NON CLASSE: i controlli del listone sono componenti React che al
 * click (setState) vengono re-renderizzati: React riscrive `className` e cancella
 * qualsiasi classe aggiunta via JS prima che il browser la disegni — il feedback
 * diventava invisibile proprio su iPhone. Un data-attribute impostato fuori da
 * React non viene toccato dal re-render.
 *
 * CONTROLLI GIÀ DEL COLORE PATTERN (--active / --primary / --danger-active):
 * non ricevono data-lf-pressed: sono già "pattern", il tap non deve scurirli o
 * cambiarli — restano semplicemente del loro colore.
 */

const PRESSED_ATTR = "data-lf-pressed";
const PRESSABLE = [
  ".lf-role-pill",
  ".lf-mobile-toggle",
  ".lf-mobile-sort-btn",
  ".lf-action-button",
  ".lf-reset-button"
].join(", ");
/** Stati che mostrano GIÀ il colore pattern: nessun feedback necessario. */
const PATTERN_STATES = [
  ".lf-role-pill--active",
  ".lf-mobile-toggle--active",
  ".lf-mobile-sort-btn--primary",
  ".lf-action-button--active",
  ".lf-action-button--danger-active"
].join(", ");

function findPressable(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(PRESSABLE);
}

type ListenerEntry = {
  type: string;
  handler: EventListenerOrEventListenerObject;
  options: AddEventListenerOptions | boolean;
};

let installedListeners: ListenerEntry[] | null = null;

export function uninstallPressFeedback(): void {
  if (!installedListeners) return;
  for (const { type, handler, options } of installedListeners) {
    window.removeEventListener(type, handler, options);
  }
  installedListeners = null;
}

export function installPressFeedback(): void {
  if (typeof window === "undefined") return;
  if (installedListeners) return; // guardia anti doppia installazione

  // Su touch (niente hover) lo stato è un latch; su desktop il rilascio pulisce.
  const isTouch = typeof window.matchMedia === "function" && !window.matchMedia("(hover: hover)").matches;

  const release = (): void => {
    document.querySelectorAll(`[${PRESSED_ATTR}]`).forEach((el) => el.removeAttribute(PRESSED_ATTR));
  };

  const press = (event: Event): void => {
    release();
    const el = findPressable(event.target);
    if (el && !el.matches(PATTERN_STATES)) el.setAttribute(PRESSED_ATTR, "true");
  };

  // Su touch: no-op (latch — il bottone resta del colore pattern).
  // Su desktop: pulizia al rilascio (lo :hover copre la continuità visiva).
  const releaseOrLatch = (): void => {
    if (!isTouch) release();
  };

  // Gesto interrotto (cancel) o rubato (scroll): il tap non è andato a buon fine.
  const cancel = (): void => release();

  installedListeners = [];
  const add = (type: string, handler: EventListenerOrEventListenerObject, options: AddEventListenerOptions | boolean): void => {
    window.addEventListener(type, handler, options);
    installedListeners!.push({ type, handler, options });
  };

  // Pointer Events (iOS 13+, tutti i browser moderni).
  const hasPointerEvents = typeof window.PointerEvent !== "undefined";
  if (hasPointerEvents) {
    add("pointerdown", press, true);
    add("pointerup", releaseOrLatch, true);
    add("pointercancel", cancel, true);
  } else {
    // Fallback: webview/iOS < 13 senza Pointer Events.
    add("touchstart", press, { capture: true, passive: true });
    add("touchend", releaseOrLatch, { capture: true, passive: true });
    add("touchcancel", cancel, { capture: true, passive: true });
    add("mousedown", press, true);
    add("mouseup", releaseOrLatch, true);
  }

  // Lo scroll (gesto che "ruba" il pointer su iOS) deve rilasciare subito.
  add("scroll", cancel, true);
}
