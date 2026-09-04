/** Etichetta "partecipante (fantasquadra)" per gli Scambi.
 *  Ritorna il solo partecipante quando il nome fantasquadra è assente. */
export function formatSquadLabel(managerName: string, displayName?: string): string {
  const name = String(displayName || "").trim();
  return name ? `${managerName} (${name})` : managerName;
}
