import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircleIcon, CoinsIcon, UsersIcon } from "../icons";
import { TeamCard } from "../components/teams/TeamCard";
import type { TeamSquad } from "../components/teams/types";
import type { PlayerMediaEntry } from "../media";
import { buildTradeText, creditsValid, roleBalanceSummary } from "./tradeModel";
import { TradeSummaryModal } from "./TradeSummaryModal";

export type PlayerMedia = {
  player: (name: string, team: string) => PlayerMediaEntry | null;
  crest: (team: string) => string;
};

export type TradesViewProps = {
  managers: string[];
  squadsByManager: Record<string, TeamSquad>;
  media: PlayerMedia;
  leagueId: string;
};

type CreditMode = "off" | "offer" | "request";

export function TradesView({ managers, squadsByManager, media, leagueId }: TradesViewProps) {
  // Nessuna selezione automatica: l'utente sceglie chi offre e chi riceve.
  const [managerA, setManagerA] = useState<string>("");
  const [managerB, setManagerB] = useState<string>("");
  const [selectedA, setSelectedA] = useState<Set<string>>(new Set());
  const [selectedB, setSelectedB] = useState<Set<string>>(new Set());
  const [creditMode, setCreditMode] = useState<CreditMode>("off");
  const [creditAmount, setCreditAmount] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const squadA = squadsByManager[managerA];
  const squadB = squadsByManager[managerB];

  const toggle = (setter: Dispatch<SetStateAction<Set<string>>>) => (assetCode: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(assetCode)) next.delete(assetCode);
      else next.add(assetCode);
      return next;
    });
  };

  const aGives = useMemo(
    () => (squadA?.players ?? []).filter((asset) => selectedA.has(asset.assetCode)),
    [squadA, selectedA]
  );
  const bGives = useMemo(
    () => (squadB?.players ?? []).filter((asset) => selectedB.has(asset.assetCode)),
    [squadB, selectedB]
  );

  const hasSelection = aGives.length > 0 && bGives.length > 0;
  const balance = roleBalanceSummary(aGives, bGives);
  const offered =
    creditMode === "offer" ? creditAmount : creditMode === "request" ? -creditAmount : 0;
  const creditsA = squadA?.credits ?? null;
  const creditsB = squadB?.credits ?? null;
  const creditsOk = creditsValid(offered, creditsA, creditsB);
  const canCopy = hasSelection && balance.length === 0 && creditsOk;
  const totalSelected = selectedA.size + selectedB.size;

  const changeManagerA = (name: string) => {
    setManagerA(name);
    setSelectedA(new Set());
    setCreditMode("off");
    // evita che entrambi i lati mostrino lo stesso proprietario
    if (name === managerB) {
      setManagerB("");
      setSelectedB(new Set());
    }
  };
  const changeManagerB = (name: string) => {
    setManagerB(name);
    setSelectedB(new Set());
    setCreditMode("off");
  };

  const outputText = buildTradeText({
    managerA,
    managerB,
    aGives,
    bGives,
    credits: offered
  });

  const bothSelected = Boolean(squadA && squadB);

  return (
    <div className="tw-px-2 tw-py-3 sm:tw-px-5 sm:tw-py-7 lg:tw-px-7">
      <section className="lf-trades lf-dashboard-card tw-mx-auto tw-max-w-7xl">
      {managers.length < 2 ? (
        <div className="lf-teams-empty">
          <p>Servono almeno due rose per comporre uno scambio.</p>
        </div>
      ) : (
        <>
          <div className="lf-trade-selectors">
            <label className="lf-trade-selector">
              <span>Chi offre</span>
              <select value={managerA} onChange={(event) => changeManagerA(event.target.value)}>
                <option value="" disabled>Scegli la rosa…</option>
                {managers.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="lf-trade-selector">
              <span>Chi riceve</span>
              <select value={managerB} onChange={(event) => changeManagerB(event.target.value)}>
                <option value="" disabled>Scegli la rosa…</option>
                {managers.filter((name) => name !== managerA).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>

          {!bothSelected ? (
            <div className="lf-trade-empty">
              <UsersIcon size={34} />
              <h2>Componi il tuo scambio</h2>
              <p>Seleziona chi offre e chi riceve per mettere a confronto le rose.</p>
            </div>
          ) : (
            <>
              <div className="lf-trade-panels">
                <TeamCard
                  team={squadA}
                  leagueId={leagueId}
                  media={media}
                  selectable
                  selectedCodes={selectedA}
                  onToggleSelect={toggle(setSelectedA)}
                  hideLogoEdit
                  hideStatusFlag
                />
                <TeamCard
                  team={squadB}
                  leagueId={leagueId}
                  media={media}
                  selectable
                  selectedCodes={selectedB}
                  onToggleSelect={toggle(setSelectedB)}
                  hideLogoEdit
                  hideStatusFlag
                />
              </div>

              <div className="lf-trade-credits">
                <div className="lf-trade-credits__heading">
                  <CoinsIcon size={16} />
                  <span>Crediti</span>
                </div>
                <div className="lf-trade-credits__controls">
                  <div className="lf-trade-credit-toggle" role="group" aria-label="Direzione crediti">
                    <button type="button" className={creditMode === "offer" ? "is-active" : ""} onClick={() => setCreditMode("offer")} aria-pressed={creditMode === "offer"}>
                      Offri
                    </button>
                    <button type="button" className={creditMode === "request" ? "is-active" : ""} onClick={() => setCreditMode("request")} aria-pressed={creditMode === "request"}>
                      Richiedi
                    </button>
                  </div>
                  {creditMode !== "off" && (
                    <span className="lf-trade-credit-input">
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={creditAmount === 0 ? "" : creditAmount}
                        placeholder="0"
                        onChange={(event) => setCreditAmount(Math.max(0, Number(event.target.value) || 0))}
                        aria-label="Importo crediti"
                      />
                      <button
                        type="button"
                        className="lf-trade-credit-clear"
                        onClick={() => { setCreditMode("off"); setCreditAmount(0); }}
                        aria-label="Rimuovi crediti"
                        title="Togli i crediti dallo scambio"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  <span className="lf-trade-credits__hint">
                    {creditMode === "offer"
                      ? `${creditAmount} crediti a ${managerB}`
                      : creditMode === "request"
                        ? `${creditAmount} crediti da ${managerA}`
                        : "Senza crediti"}
                  </span>
                </div>
              </div>

              <div className={`lf-trade-status ${canCopy ? "is-ok" : ""}`} role="status">
                {!hasSelection ? (
                  <span className="lf-trade-status__msg"><AlertCircleIcon size={15} /> Seleziona almeno un giocatore per ciascuna rosa.</span>
                ) : balance.length > 0 ? (
                  <span className="lf-trade-status__msg lf-trade-status__msg--error"><AlertCircleIcon size={15} /> Ruoli non bilanciati: {balance.join(", ")}</span>
                ) : !creditsOk ? (
                  <span className="lf-trade-status__msg lf-trade-status__msg--error"><AlertCircleIcon size={15} /> Crediti insufficienti.</span>
                ) : (
                  <span className="lf-trade-status__msg"><span className="lf-trade-status__ok" aria-hidden="true">✓</span> Scambio pronto!</span>
                )}
              </div>

              <div className="lf-trade-actions">
                <button type="button" className="lf-action-button lf-trade-submit" onClick={() => setSummaryOpen(true)} disabled={!canCopy}>
                  Riepilogo
                </button>
              </div>
            </>
          )}

          {bothSelected && (
            <button
              type="button"
              className={`lf-trade-fab ${canCopy ? "" : "is-disabled"}`}
              onClick={() => setSummaryOpen(true)}
              disabled={!canCopy}
            >
              Riepilogo ({totalSelected})
            </button>
          )}

          <TradeSummaryModal
            open={summaryOpen}
            summary={{ managerA, managerB, aGives, bGives, credits: offered }}
            text={outputText}
            media={media}
            onClose={() => setSummaryOpen(false)}
          />
        </>
      )}
      </section>
    </div>
  );
}
