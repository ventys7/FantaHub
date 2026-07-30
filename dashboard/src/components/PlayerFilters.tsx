import { ChevronDownIcon, XIcon } from "../icons";
import { ROLE_LABELS, ROLE_OPTIONS } from "../constants";

type Props = {
  teams: string[];
  owners: string[];
  currentRole: string;
  currentTeam: string;
  currentOwner: string;
  hasActiveFilters: boolean;
  onRoleChange: (role: string) => void;
  onTeamChange: (team: string) => void;
  onOwnerChange: (owner: string) => void;
  onResetFilters: () => void;
};

export function PlayerFilters({
  teams,
  owners,
  currentRole,
  currentTeam,
  currentOwner,
  hasActiveFilters,
  onRoleChange,
  onTeamChange,
  onOwnerChange,
  onResetFilters
}: Props) {
  return (
    <div className="tw-mb-5 sm:tw-mb-6">
      <div className="tw-hidden tw-items-center tw-justify-between tw-gap-4 md:tw-flex">
        <div className="tw-flex tw-flex-wrap tw-gap-2">
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => onRoleChange(role)}
              className={`lf-role-pill ${currentRole === role ? "lf-role-pill--active" : ""}`}
            >
              {role === "Tutti" ? "Tutti" : ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        <div className="tw-flex tw-items-center tw-gap-2">
          <label className="lf-select-wrap">
            <span aria-hidden="true">🏟️</span>
            <select value={currentTeam} onChange={(event) => onTeamChange(event.target.value)} aria-label="Filtra per squadra reale">
              <option value="Tutti">Squadra</option>
              {teams.map((team) => <option key={team} value={team}>{team}</option>)}
            </select>
            <ChevronDownIcon size={14} />
          </label>

          <label className="lf-select-wrap">
            <span aria-hidden="true">👤</span>
            <select value={currentOwner} onChange={(event) => onOwnerChange(event.target.value)} aria-label="Filtra per proprietario">
              <option value="Tutti">Proprietario</option>
              {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
            </select>
            <ChevronDownIcon size={14} />
          </label>
        </div>
      </div>

      <div className="lf-mobile-filters md:tw-hidden">
        <div className="tw-flex tw-gap-1.5 tw-overflow-x-auto tw-pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => onRoleChange(role)}
              className={`lf-role-pill lf-role-pill--sm ${currentRole === role ? "lf-role-pill--active" : ""}`}
            >
              {role === "Tutti" ? "Tutti" : ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        <div className="tw-mt-2 tw-flex tw-gap-2">
          <label className="lf-select-wrap lf-select-wrap--mobile">
            <span aria-hidden="true">🏟️</span>
            <select value={currentTeam} onChange={(event) => onTeamChange(event.target.value)} aria-label="Filtra per squadra reale">
              <option value="Tutti">Squadra</option>
              {teams.map((team) => <option key={team} value={team}>{team}</option>)}
            </select>
            <ChevronDownIcon size={14} />
          </label>

          <label className="lf-select-wrap lf-select-wrap--mobile">
            <span aria-hidden="true">👤</span>
            <select value={currentOwner} onChange={(event) => onOwnerChange(event.target.value)} aria-label="Filtra per proprietario">
              <option value="Tutti">Proprietario</option>
              {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
            </select>
            <ChevronDownIcon size={14} />
          </label>
        </div>
      </div>

      {hasActiveFilters && (
        <button type="button" onClick={onResetFilters} className="lf-mobile-reset md:tw-hidden">
          <XIcon size={15} /> Azzera filtri
        </button>
      )}
    </div>
  );
}
