import type { DashboardAsset } from "../types";

export type RoleKey = "P" | "D" | "C" | "A";

export const TRADE_ROLE_ORDER: readonly RoleKey[] = ["P", "D", "C", "A"] as const;

export const TRADE_SEPARATOR = "━━━━━━━━━━━━━━━━━━━━";

export type RoleCounts = Record<RoleKey, number>;

const ZERO_COUNTS: RoleCounts = { P: 0, D: 0, C: 0, A: 0 };

const BLOCK_NAME_PATTERN = /\s+-\s+/;

/**
 * Un asset è un blocco portieri quando è marcato esplicitamente come
 * "goalkeeper_block" oppure quando il suo nome composto ("Due - Tre")
 * identifica un blocco unico venduto all'asta (stessa logica del Listone).
 */
export function isGoalkeeperBlock(asset: DashboardAsset): boolean {
  return (
    asset.type === "goalkeeper_block" ||
    (asset.role === "P" && BLOCK_NAME_PATTERN.test(asset.displayName))
  );
}

/** Conta gli asset selezionati per ruolo; un blocco portieri conta come un P. */
export function countRoles(assets: readonly DashboardAsset[]): RoleCounts {
  const counts = { ...ZERO_COUNTS };
  for (const asset of assets) {
    const key = asset.role as RoleKey;
    if (key in counts) counts[key] += 1;
  }
  return counts;
}

/**
 * Bilanciamento ruolo-per-ruolo: ogni ruolo (D, C, A) e i blocchi portieri
 * (P) devono coincidere tra le due rose, come nel core della vecchia app.
 */
export function isRoleBalanced(
  proposerAssets: readonly DashboardAsset[],
  receiverAssets: readonly DashboardAsset[]
): boolean {
  return roleBalanceSummary(proposerAssets, receiverAssets).length === 0;
}

/**
 * Messaggi di sbilanciamento nel formato "C (1 ↔ 0)", uno per ruolo
 * disallineato, nell'ordine P, D, C, A.
 */
export function roleBalanceSummary(
  proposerAssets: readonly DashboardAsset[],
  receiverAssets: readonly DashboardAsset[]
): string[] {
  const a = countRoles(proposerAssets);
  const b = countRoles(receiverAssets);
  return TRADE_ROLE_ORDER.filter((role) => a[role] !== b[role]).map(
    (role) => `${role} (${a[role]} ↔ ${b[role]})`
  );
}

/**
 * Validazione crediti nel senso del vecchio core: `offered` positivo =
 * il proponente offre crediti al ricevente; negativo = li richiede dal
 * ricevente. In entrambi i casi chi deve pagare deve averne abbastanza.
 */
export function creditsValid(
  offered: number,
  proposerCredits: number | null,
  receiverCredits: number | null
): boolean {
  if (offered === 0) return true;
  if (offered > 0) return proposerCredits !== null && offered <= proposerCredits;
  return receiverCredits !== null && -offered <= receiverCredits;
}

function roleMarker(role: RoleKey): string {
  return role === "P" ? "🟨 P" : role === "D" ? "🟦 D" : role === "C" ? "🟩 C" : "🟥 A";
}

function rowLabel(asset: DashboardAsset): string {
  if (isGoalkeeperBlock(asset)) {
    return `Blocco ${asset.realTeam || asset.displayName}`;
  }
  return asset.displayName;
}

function sortRows(assets: readonly DashboardAsset[]): DashboardAsset[] {
  const rank = (asset: DashboardAsset) => TRADE_ROLE_ORDER.indexOf(asset.role as RoleKey);
  return [...assets].sort((x, y) => rank(x) - rank(y));
}

export interface TradeTextOptions {
  managerA: string;
  managerB: string;
  aGives: readonly DashboardAsset[];
  bGives: readonly DashboardAsset[];
  /** +n = A offre crediti a B; -n = A richiede crediti da B; 0 = nessun credito. */
  credits: number;
}

/**
 * Messaggio copiabile in formato Formazione (js/output.js): header con
 * emoji, separatore a 20 "━", sezioni, righe "{marker}  {nome}", e la
 * sezione CREDITI solo quando prevista. Nessun invito a rispondere.
 */
export function buildTradeText(options: TradeTextOptions): string {
  const { managerA, managerB, aGives, bGives, credits } = options;
  const lines: string[] = [];

  lines.push(`🔄 SCAMBIO · ${managerA} ↔ ${managerB}`);
  lines.push(TRADE_SEPARATOR);
  lines.push(`${managerA.toUpperCase()} OFFRE`);
  for (const asset of sortRows(aGives)) {
    lines.push(`${roleMarker(asset.role as RoleKey)}  ${rowLabel(asset)}`);
  }
  lines.push(`RICEVE DA ${managerB.toUpperCase()}`);
  for (const asset of sortRows(bGives)) {
    lines.push(`${roleMarker(asset.role as RoleKey)}  ${rowLabel(asset)}`);
  }

  if (credits !== 0) {
    lines.push(TRADE_SEPARATOR);
    lines.push("CREDITI");
    lines.push(credits > 0 ? `+${credits} per ${managerB}` : `${credits} da ${managerA}`);
  }

  return lines.join("\n");
}
