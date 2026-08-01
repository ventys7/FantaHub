export type RoleCode = "P" | "D" | "C" | "A" | string;

export type DashboardAsset = {
  assetCode: string;
  displayName: string;
  docsName: string;
  role: RoleCode;
  realTeam: string;
  quotation: number;
  purchasePrice: number;
  ownerTag: string;
  managerCredits: number | null;
  type: string;
  active: boolean;
  isFreeAgent: boolean;
};

export type SortKey = "position" | "quotation" | "purchasePrice";
export type SortDirection = "asc" | "desc";

/** Criterio di ordinamento attivo. Il primo elemento dell'array di `sorts` è quello principale. */
export type PlayerSort = { key: SortKey; direction: SortDirection };
