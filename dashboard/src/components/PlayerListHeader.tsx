import { ChevronDownIcon, ChevronUpIcon } from "../icons";
import type { PlayerSort, SortDirection, SortKey } from "../types";

type Props = {
  sorts: PlayerSort[];
  onSort: (key: SortKey) => void;
};

function SortArrow({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return null;
  return direction === "asc" ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />;
}

export function PlayerListHeader({ sorts, onSort }: Props) {
  const entryFor = (key: SortKey) => sorts.find((sort) => sort.key === key);
  const isPrimary = (key: SortKey) => sorts[0]?.key === key;

  const sortButtonClass = (key: SortKey) =>
    `lf-sort tw-col-span-2${isPrimary(key) ? " lf-sort--primary" : ""}`;

  return (
    <div className="tw-hidden tw-grid-cols-12 tw-gap-4 tw-border-b tw-border-slate-200 tw-bg-slate-50 tw-px-6 tw-py-4 tw-text-xs tw-font-bold tw-uppercase tw-tracking-wider tw-text-slate-500 md:tw-grid">
      <div className="tw-col-span-4">Giocatore</div>
      <button type="button" className={sortButtonClass("position")} onClick={() => onSort("position")}>
        Ruolo <SortArrow active={Boolean(entryFor("position"))} direction={entryFor("position")?.direction ?? "asc"} />
      </button>
      <button type="button" className={`${sortButtonClass("quotation")} tw-justify-center`} onClick={() => onSort("quotation")}>
        Quot. <SortArrow active={Boolean(entryFor("quotation"))} direction={entryFor("quotation")?.direction ?? "desc"} />
      </button>
      <button type="button" className={`${sortButtonClass("purchasePrice")} tw-justify-center`} onClick={() => onSort("purchasePrice")}>
        Prezzo <SortArrow active={Boolean(entryFor("purchasePrice"))} direction={entryFor("purchasePrice")?.direction ?? "desc"} />
      </button>
      <div className="tw-col-span-2">Proprietario</div>
    </div>
  );
}
