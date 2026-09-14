import type { DashboardAsset } from "../../types";

export type RoleKey = "P" | "D" | "C" | "A";

export type TeamSquad = {
  managerName: string;
  credits: number | null;
  logoUrl: string;
  displayName: string;
  players: DashboardAsset[];
  extraSlots: { D: DashboardAsset | null; C: DashboardAsset | null; A: DashboardAsset | null };
  isComplete: boolean;
  roleCounts: Record<RoleKey, number>;
  totalPlayers: number;
};
