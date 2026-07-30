import { useMemo, useState } from "react";
import { ROLE_ORDER } from "../constants";
import { SearchIcon, UserXIcon, XIcon } from "../icons";
import type { DashboardAsset, SortDirection, SortKey } from "../types";
import { usePlayerMedia } from "../media";
import { GoalkeeperBlock } from "../components/GoalkeeperBlock";
import { PlayerDesktopRow } from "../components/PlayerDesktopRow";
import { PlayerFilters } from "../components/PlayerFilters";
import { PlayerListHeader } from "../components/PlayerListHeader";
import { PlayerMobileCard } from "../components/PlayerMobileCard";

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Ø/g, "O").replace(/ø/g, "o").toLowerCase();
}

function isGoalkeeperBlock(asset: DashboardAsset) {
  return asset.type === "goalkeeper_block" || (asset.role === "P" && /\s+-\s+/.test(asset.displayName));
}

export function Players({ assets }: { assets: DashboardAsset[] }) {
  const leagueId = window.LINEUP_FANTA?.league?.id ?? "";
  const media = usePlayerMedia(assets, leagueId);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("Tutti");
  const [teamFilter, setTeamFilter] = useState("Tutti");
  const [ownerFilter, setOwnerFilter] = useState("Tutti");
  const [showFreeAgentsOnly, setShowFreeAgentsOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  const teams = useMemo(() => [...new Set(assets.map((asset) => asset.realTeam).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it")), [assets]);
  const owners = useMemo(() => [...new Set(assets.map((asset) => asset.ownerTag).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it")), [assets]);

  const filteredPlayers = useMemo(() => {
    const query = normalizeText(searchQuery.trim());
    return assets.filter((asset) => {
      if (query) {
        const haystack = normalizeText(`${asset.displayName} ${asset.realTeam} ${asset.ownerTag}`);
        if (!haystack.includes(query)) return false;
      }
      if (showFreeAgentsOnly && !asset.isFreeAgent) return false;
      if (roleFilter !== "Tutti" && asset.role !== roleFilter) return false;
      if (teamFilter !== "Tutti" && asset.realTeam !== teamFilter) return false;
      if (ownerFilter !== "Tutti" && asset.ownerTag !== ownerFilter) return false;
      return true;
    });
  }, [assets, ownerFilter, roleFilter, searchQuery, showFreeAgentsOnly, teamFilter]);

  const processedList = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      if (sortKey === "position") {
        const roleDiff = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
        const directedRoleDiff = sortDirection === "asc" ? roleDiff : -roleDiff;
        if (directedRoleDiff !== 0) return directedRoleDiff;
        const teamDiff = a.realTeam.localeCompare(b.realTeam, "it");
        if (teamDiff !== 0) return teamDiff;
        const quotationDiff = b.quotation - a.quotation;
        if (quotationDiff !== 0) return quotationDiff;
        return a.displayName.localeCompare(b.displayName, "it");
      }
      const difference = (a[sortKey] || 0) - (b[sortKey] || 0);
      return sortDirection === "asc" ? difference : -difference;
    });
  }, [filteredPlayers, sortDirection, sortKey]);

  const hasActiveFilters = Boolean(searchQuery || roleFilter !== "Tutti" || teamFilter !== "Tutti" || ownerFilter !== "Tutti" || showFreeAgentsOnly);

  const resetFilters = () => {
    setSearchQuery("");
    setRoleFilter("Tutti");
    setTeamFilter("Tutti");
    setOwnerFilter("Tutti");
    setShowFreeAgentsOnly(false);
    setSortKey("position");
    setSortDirection("asc");
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDirection === "desc") setSortDirection("asc");
      else { setSortKey("position"); setSortDirection("asc"); }
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  };

  const toggleBlock = (assetCode: string) => {
    setExpandedBlocks((current) => {
      const next = new Set(current);
      if (next.has(assetCode)) next.delete(assetCode);
      else next.add(assetCode);
      return next;
    });
  };

  return (
    <div className="tw-px-2 tw-py-3 sm:tw-px-5 sm:tw-py-7 lg:tw-px-7">
      <section className="lf-dashboard-card tw-mx-auto tw-max-w-7xl">
        <div className="tw-flex tw-justify-center tw-p-4 sm:tw-p-6 lg:tw-p-8">
          <div className="tw-flex tw-w-full tw-flex-wrap tw-items-stretch tw-gap-2 lg:tw-w-auto lg:tw-justify-center">
            <label className="lf-search tw-min-w-0 tw-flex-1 lg:tw-w-80 lg:tw-flex-none">
              <SearchIcon size={20} />
              <input type="search" placeholder="Cerca giocatore..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </label>

            <button type="button" onClick={() => setShowFreeAgentsOnly((value) => !value)} className={`lf-action-button ${showFreeAgentsOnly ? "lf-action-button--active" : ""}`} title="Mostra solo giocatori svincolati">
              <UserXIcon size={20} /><span className="tw-hidden sm:tw-inline">Svincolati</span>
            </button>

            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="lf-reset-button tw-hidden md:tw-flex" title="Azzera filtri"><XIcon size={20} /></button>
            )}
          </div>
        </div>

        <div className="tw-px-3 sm:tw-px-6 lg:tw-px-8">
          <PlayerFilters
            teams={teams}
            owners={owners}
            currentRole={roleFilter}
            currentTeam={teamFilter}
            currentOwner={ownerFilter}
            hasActiveFilters={hasActiveFilters}
            onRoleChange={setRoleFilter}
            onTeamChange={setTeamFilter}
            onOwnerChange={setOwnerFilter}
            onResetFilters={resetFilters}
          />

          <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between tw-text-xs tw-font-semibold tw-text-slate-500">
            <span>{processedList.length} risultati</span>
            {processedList.length !== assets.length && <span>su {assets.length}</span>}
          </div>

          <div className="lf-list-table">
            <PlayerListHeader sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
            <div className="tw-hidden tw-divide-y tw-divide-slate-100 md:tw-block">
              {processedList.map((asset) => isGoalkeeperBlock(asset)
                ? <GoalkeeperBlock key={asset.assetCode} asset={asset} expanded={expandedBlocks.has(asset.assetCode)} onToggle={() => toggleBlock(asset.assetCode)} crestUrl={media.crest(asset.realTeam)} media={media} />
                : <PlayerDesktopRow key={asset.assetCode} player={asset} media={media.player(asset.displayName, asset.realTeam)} crestUrl={media.crest(asset.realTeam)} />)}
            </div>
            <div className="tw-divide-y tw-divide-slate-100 md:tw-hidden">
              {processedList.map((asset) => isGoalkeeperBlock(asset)
                ? <GoalkeeperBlock key={asset.assetCode} asset={asset} expanded={expandedBlocks.has(asset.assetCode)} onToggle={() => toggleBlock(asset.assetCode)} crestUrl={media.crest(asset.realTeam)} media={media} />
                : <PlayerMobileCard key={asset.assetCode} player={asset} media={media.player(asset.displayName, asset.realTeam)} crestUrl={media.crest(asset.realTeam)} />)}
            </div>
            {processedList.length === 0 && (
              <div className="tw-px-6 tw-py-14 tw-text-center"><SearchIcon size={34} className="tw-mx-auto tw-mb-3 tw-text-slate-300"/><h2 className="tw-m-0 tw-text-lg tw-font-bold tw-text-slate-800">Nessun giocatore trovato</h2><p className="tw-mb-0 tw-mt-1 tw-text-sm tw-text-slate-500">Prova a modificare i filtri di ricerca.</p></div>
            )}
          </div>
        </div>
        <div className="tw-h-4 sm:tw-h-6" />
      </section>
    </div>
  );
}
