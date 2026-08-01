import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { ROLE_LABELS, ROLE_ORDER, ROLE_SECTION_LABELS } from "../constants";
import { ChevronDownIcon, ChevronUpIcon, SearchIcon, UserXIcon, XIcon } from "../icons";
import type { DashboardAsset, PlayerSort, SortKey } from "../types";
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

const SORT_LABELS: { key: SortKey; label: string }[] = [
  { key: "position", label: "Ruolo" },
  { key: "quotation", label: "Quot." },
  { key: "purchasePrice", label: "Prezzo" }
];

type RoleSection = { role: string; label: string; items: DashboardAsset[] };

/** Espone l'altezza dell'app-chrome sticky come --lf-chrome-bottom sul root,
 *  così gli header di ruolo sticky si ancorano sotto il chrome (altezza variabile su mobile). */
function useChromeOffset(rootRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const chrome = document.querySelector<HTMLElement>(".app-chrome");
    const apply = () => {
      const height = chrome ? chrome.getBoundingClientRect().height : 0;
      node.style.setProperty("--lf-chrome-bottom", `${height}px`);
    };
    apply();
    const observer = chrome ? new ResizeObserver(apply) : null;
    if (observer && chrome) observer.observe(chrome);
    window.addEventListener("resize", apply);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [rootRef]);
}

export function Players({ assets }: { assets: DashboardAsset[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useChromeOffset(rootRef);
  const leagueId = window.LINEUP_FANTA?.league?.id ?? "";
  const media = usePlayerMedia(assets, leagueId);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // Debounce: la ricerca viene applicata 120ms dopo l'ultima digitazione (meno re-render a ogni tasto).
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput), 120);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const [roleFilter, setRoleFilter] = useState("Tutti");
  const [teamFilter, setTeamFilter] = useState("Tutti");
  const [ownerFilter, setOwnerFilter] = useState("Tutti");
  const [showFreeAgentsOnly, setShowFreeAgentsOnly] = useState(false);
  // Criteri di ordinamento attivi: il primo è il principale (definisce le sezioni per ruolo).
  const [sorts, setSorts] = useState<PlayerSort[]>([{ key: "position", direction: "asc" }]);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  // Rendering singolo: solo la lista visibile (desktop O mobile) è nel DOM → metà nodi e immagini.
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

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
      for (const { key, direction } of sorts) {
        let diff = 0;
        if (key === "position") {
          diff = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
        } else {
          diff = Number(a[key] ?? 0) - Number(b[key] ?? 0);
        }
        if (diff !== 0) return direction === "asc" ? diff : -diff;
      }
      const teamDiff = a.realTeam.localeCompare(b.realTeam, "it");
      if (teamDiff !== 0) return teamDiff;
      const quotationDiff = b.quotation - a.quotation;
      if (quotationDiff !== 0) return quotationDiff;
      return a.displayName.localeCompare(b.displayName, "it");
    });
  }, [filteredPlayers, sorts]);

  const hasActiveFilters = Boolean(searchQuery || roleFilter !== "Tutti" || teamFilter !== "Tutti" || ownerFilter !== "Tutti" || showFreeAgentsOnly);

  // Raggruppa per ruolo solo quando il criterio principale è la posizione (l'ordinamento naturale del listone).
  const sections = useMemo<RoleSection[] | null>(() => {
    if (sorts[0]?.key !== "position") return null;
    const groups = new Map<string, DashboardAsset[]>();
    for (const asset of processedList) {
      const role = asset.role || "U";
      const items = groups.get(role);
      if (items) items.push(asset);
      else groups.set(role, [asset]);
    }
    const known = Object.keys(ROLE_ORDER).filter((role) => groups.has(role));
    const unknown = [...groups.keys()].filter((role) => !(role in ROLE_ORDER)).sort((a, b) => a.localeCompare(b, "it"));
    const ordered = sorts[0].direction === "asc" ? [...known, ...unknown] : [...unknown.reverse(), ...known.reverse()];
    return ordered.map((role) => ({
      role,
      label: ROLE_SECTION_LABELS[role] ?? ROLE_LABELS[role] ?? role,
      items: groups.get(role) ?? []
    }));
  }, [processedList, sorts]);

  const renderListBody = useCallback((renderItem: (asset: DashboardAsset) => ReactNode) => {
    if (!sections) {
      return <div className="tw-divide-y tw-divide-slate-100">{processedList.map(renderItem)}</div>;
    }
    return sections.map((section) => (
      <div key={section.role}>
        <div className="lf-role-section-header">
          <span>{section.label}</span>
          <span>({section.items.length})</span>
        </div>
        <div className="tw-divide-y tw-divide-slate-100">{section.items.map(renderItem)}</div>
      </div>
    ));
  }, [processedList, sections]);

  const resetFilters = () => {
    setSearchInput("");
    setRoleFilter("Tutti");
    setTeamFilter("Tutti");
    setOwnerFilter("Tutti");
    setShowFreeAgentsOnly(false);
    setSorts([{ key: "position", direction: "asc" }]);
  };

  // Multi-sort: click su criterio inattivo → lo aggiunge come secondario;
  // click sul primario → inverte; click su un secondario → lo promuove a primario.
  const handleSort = useCallback((key: SortKey) => {
    setSorts((current) => {
      const index = current.findIndex((sort) => sort.key === key);
      if (index === -1) return [...current, { key, direction: key === "position" ? "asc" : "desc" }];
      if (index === 0) return [{ key, direction: current[0].direction === "asc" ? "desc" : "asc" }, ...current.slice(1)];
      const promoted = current[index];
      return [promoted, ...current.filter((sort) => sort.key !== key)];
    });
  }, []);

  const toggleBlock = useCallback((assetCode: string) => {
    setExpandedBlocks((current) => {
      const next = new Set(current);
      if (next.has(assetCode)) next.delete(assetCode);
      else next.add(assetCode);
      return next;
    });
  }, []);

  return (
    <div ref={rootRef} className="tw-px-2 tw-py-3 sm:tw-px-5 sm:tw-py-7 lg:tw-px-7">
      <section className="lf-dashboard-card tw-mx-auto tw-max-w-7xl">
        <div className="tw-flex tw-justify-center tw-p-4 sm:tw-p-6 lg:tw-p-8">
          <div className="tw-flex tw-w-full tw-flex-wrap tw-items-stretch tw-gap-2 lg:tw-w-auto lg:tw-justify-center">
            <label className="lf-search tw-min-w-0 tw-flex-1 lg:tw-w-80 lg:tw-flex-none">
              <SearchIcon size={20} />
              <input type="search" placeholder="Cerca giocatore..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            </label>

            <div className="tw-flex tw-items-center tw-self-center tw-whitespace-nowrap tw-px-1 tw-text-xs tw-font-semibold tw-text-slate-500">
              <span>tra {processedList.length}{processedList.length !== assets.length ? ` su ${assets.length}` : ""} risultati</span>
            </div>

            <button type="button" onClick={() => setShowFreeAgentsOnly((value) => !value)} className={`lf-action-button tw-hidden md:tw-flex ${showFreeAgentsOnly ? "lf-action-button--active" : ""}`} title="Mostra solo giocatori svincolati">
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
            showFreeAgentsOnly={showFreeAgentsOnly}
            hasActiveFilters={hasActiveFilters}
            onRoleChange={setRoleFilter}
            onTeamChange={setTeamFilter}
            onOwnerChange={setOwnerFilter}
            onToggleFreeAgents={() => setShowFreeAgentsOnly((value) => !value)}
            onResetFilters={resetFilters}
          />

          {!isDesktop && processedList.length > 0 && (
            <div className="lf-mobile-sort-row" role="group" aria-label="Ordinamento listone">
              {SORT_LABELS.map(({ key, label }) => {
                const entry = sorts.find((sort) => sort.key === key);
                const isPrimary = sorts[0]?.key === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSort(key)}
                    aria-pressed={Boolean(entry)}
                    className={`lf-mobile-sort-btn${entry ? " lf-mobile-sort-btn--active" : ""}${isPrimary ? " lf-mobile-sort-btn--primary" : ""}`}
                  >
                    {label}
                    {entry ? (entry.direction === "asc" ? <ChevronUpIcon size={13} /> : <ChevronDownIcon size={13} />) : null}
                  </button>
                );
              })}
            </div>
          )}

          <div className="lf-list-table">
            <PlayerListHeader sorts={sorts} onSort={handleSort} />
            {isDesktop
              ? renderListBody((asset) => isGoalkeeperBlock(asset)
                  ? <GoalkeeperBlock key={asset.assetCode} asset={asset} expanded={expandedBlocks.has(asset.assetCode)} onToggle={() => toggleBlock(asset.assetCode)} crestUrl={media.crest(asset.realTeam)} media={media} />
                  : <PlayerDesktopRow key={asset.assetCode} player={asset} media={media.player(asset.displayName, asset.realTeam)} crestUrl={media.crest(asset.realTeam)} />)
              : renderListBody((asset) => isGoalkeeperBlock(asset)
                  ? <GoalkeeperBlock key={asset.assetCode} asset={asset} expanded={expandedBlocks.has(asset.assetCode)} onToggle={() => toggleBlock(asset.assetCode)} crestUrl={media.crest(asset.realTeam)} media={media} />
                  : <PlayerMobileCard key={asset.assetCode} player={asset} media={media.player(asset.displayName, asset.realTeam)} crestUrl={media.crest(asset.realTeam)} />)}
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
