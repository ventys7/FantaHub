import { useState } from "react";
import { AlertCircleIcon, CoinsIcon, ShieldIcon } from "../../icons";
import { SquadRoleSection } from "./SquadRoleSection";
import { LogoEditorDialog, type TeamIdentityUpdate } from "./LogoEditorDialog";
import type { RoleKey, TeamSquad } from "./types";
import type { PlayerMediaEntry } from "../../media";

const ROLE_TARGETS: Record<RoleKey, number> = { P: 2, D: 8, C: 8, A: 6 };
const numberFormatter = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });

export function TeamCard({ team, leagueId, media, onLogoUpdated, selectable = false, selectedCodes, onToggleSelect, hideLogoEdit = false, hideStatusFlag = false }: {
  team: TeamSquad;
  leagueId: string;
  media: { player: (name: string, team: string) => PlayerMediaEntry | null; crest: (team: string) => string };
  onLogoUpdated?: (update: TeamIdentityUpdate) => void;
  /** Modalità selezionabile (Scambi): le righe diventano bottone con check. */
  selectable?: boolean;
  selectedCodes?: ReadonlySet<string>;
  onToggleSelect?: (assetCode: string) => void;
  /** Nasconde il bottone "cambia stemma" (Scambi: gli stemmi si gestiscono nelle Rose). */
  hideLogoEdit?: boolean;
  /** Nasconde il flag rosa completa/incompleta (Scambi: resta solo il credito). */
  hideStatusFlag?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<"ALL" | RoleKey>("ALL");
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);

  const toggleFilter = (role: RoleKey) => {
    setActiveFilter((current) => current === role ? "ALL" : role);
  };

  const showLogo = Boolean(team.logoUrl && !logoFailed);
  const creditsLabel = team.credits === null ? "—" : numberFormatter.format(team.credits);
  const displayName = team.displayName || "";
  const shownName = displayName || team.managerName;

  return (
    <article className="lf-team-card">
      <header className="lf-team-card__header">
        <div className="lf-team-card__identity">
          {hideLogoEdit ? (
            <span className={`lf-team-card__avatar ${showLogo ? "has-logo" : ""}`} aria-hidden="true">
              {showLogo ? (
                <img src={team.logoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setLogoFailed(true)} />
              ) : shownName.charAt(0).toUpperCase()}
            </span>
          ) : (
            <button type="button" className={`lf-team-card__avatar lf-team-card__avatar--editable ${showLogo ? "has-logo" : ""}`} onClick={() => setLogoOpen(true)} title="Cambia stemma e nome">
              {showLogo ? (
                <img src={team.logoUrl} alt={`Logo di ${shownName}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setLogoFailed(true)} />
              ) : shownName.charAt(0).toUpperCase()}
              <span className="lf-team-card__avatar-edit" aria-hidden="true">✎</span>
            </button>
          )}
          <div className="lf-team-card__copy">
            <span className="lf-team-card__eyebrow">Allenatore</span>
            <h2 title={displayName ? `${displayName} · ${team.managerName}` : team.managerName}>{shownName}</h2>
            {displayName && <span className="lf-team-card__manager">{team.managerName}</span>}
          </div>
        </div>

        <div className="lf-team-card__meta">
          <div className="lf-team-card__credits">
            <span>Crediti</span>
            <strong><CoinsIcon size={16} /> {creditsLabel}</strong>
          </div>
          {!hideStatusFlag && (
            <div className={`lf-team-status ${team.isComplete ? "lf-team-status--complete" : "lf-team-status--incomplete"}`}>
              {team.isComplete ? <ShieldIcon size={13} /> : <AlertCircleIcon size={13} />}
              {team.isComplete ? "ROSA COMPLETA" : "INCOMPLETA"}
            </div>
          )}
        </div>
      </header>

      <div className="lf-team-role-filters" aria-label={`Filtra la rosa di ${team.managerName} per ruolo`}>
        {(Object.keys(ROLE_TARGETS) as RoleKey[]).map((role) => {
          const complete = team.roleCounts[role] === ROLE_TARGETS[role];
          return (
            <button
              key={role}
              type="button"
              onClick={() => toggleFilter(role)}
              className={`${activeFilter === role ? "is-active" : ""} ${complete ? "is-complete" : ""}`}
            >
              {role}: {team.roleCounts[role]}/{ROLE_TARGETS[role]}
            </button>
          );
        })}
      </div>

      <div className="lf-team-roster-frame">
        <div className="lf-team-roster">
          {(activeFilter === "ALL" || activeFilter === "P") && <SquadRoleSection players={team.players} role="P" label="Portieri" media={media} selectable={selectable} selectedCodes={selectedCodes} onToggleSelect={onToggleSelect} />}
          {(activeFilter === "ALL" || activeFilter === "D") && <SquadRoleSection players={team.players} role="D" label="Difensori" media={media} selectable={selectable} selectedCodes={selectedCodes} onToggleSelect={onToggleSelect} />}
          {(activeFilter === "ALL" || activeFilter === "C") && <SquadRoleSection players={team.players} role="C" label="Centrocampisti" media={media} selectable={selectable} selectedCodes={selectedCodes} onToggleSelect={onToggleSelect} />}
          {(activeFilter === "ALL" || activeFilter === "A") && <SquadRoleSection players={team.players} role="A" label="Attaccanti" media={media} selectable={selectable} selectedCodes={selectedCodes} onToggleSelect={onToggleSelect} />}
        </div>
      </div>
      {!hideLogoEdit && (
        <LogoEditorDialog open={logoOpen} leagueId={leagueId} teamName={team.managerName} currentLogo={team.logoUrl} currentName={team.displayName} onClose={() => setLogoOpen(false)} onUpdated={(update) => { setLogoFailed(false); onLogoUpdated?.(update); }} />
      )}
    </article>
  );
}
