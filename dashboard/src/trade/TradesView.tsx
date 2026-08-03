import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircleIcon, CoinsIcon } from "../icons";
import type { DashboardAsset } from "../types";
import { TradeOutputModal } from "./TradeOutputModal";
import { TradeTeamPanel, type PlayerMedia } from "./TradeTeamPanel";
import { buildTradeText, creditsValid, roleBalanceSummary } from "./tradeModel";

export type TradesViewProps = {
  managers: string[];
  assetsByManager: Record<string, readonly DashboardAsset[]>;
  creditsByManager: Record<string, number | null>;
  media: PlayerMedia;
};

type CreditMode = "off" | "offer" | "request";

export function TradesView({ managers, assetsByManager, creditsByManager, media }: TradesViewProps) {
  const [managerA, setManagerA] = useState<string>(managers[0] ?? "");
  const [managerB, setManagerB] = useState<string>(managers[1] ?? "");
  const [selectedA, setSelectedA] = useState<Set<string>>(new Set());
  const [selectedB, setSelectedB] = useState<Set<string>>(new Set());
  const [creditMode, setCreditMode] = useState<CreditMode>("off");
  const [creditAmount, setCreditAmount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const assetsA = assetsByManager[managerA] ?? [];
  const assetsB = assetsByManager[managerB] ?? [];

  const toggle = (setter: Dispatch<SetStateAction<Set<string>>>) => (assetCode: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(assetCode)) next.delete(assetCode);
      else next.add(assetCode);
      return next;
    });
  };

  const aGives = useMemo(
    () => assetsA.filter((asset) => selectedA.has(asset.assetCode)),
    [assetsA, selectedA]
  );
  const bGives = useMemo(
    () => assetsB.filter((asset) => selectedB.has(asset.assetCode)),
    [assetsB, selectedB]
  );

  const hasSelection = aGives.length > 0 && bGives.length > 0;
  const balance = roleBalanceSummary(aGives, bGives);
  const offered =
    creditMode === "offer" ? creditAmount : creditMode === "request" ? -creditAmount : 0;
  const creditsA = creditsByManager[managerA] ?? null;
  const creditsB = creditsByManager[managerB] ?? null;
  const creditsOk = creditsValid(offered, creditsA, creditsB);
  const canCopy = hasSelection && balance.length === 0 && creditsOk;

  const changeManagerA = (name: string) => {
    setManagerA(name);
    setSelectedA(new Set());
    setCreditMode("off");
    // evita che entrambi i lati mostrino lo stesso proprietario
    if (name === managerB) {
      const next = managers.find((candidate) => candidate !== name);
      setManagerB(next ?? "");
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

  return (
    <div className="lf-trades">
      <header className="lf-trades-heading">
        <h1>Scambi</h1>
        <p>Componi lo scambio tra due rose e copia il messaggio per il gruppo.</p>
      </header>

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
                {managers.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <span className="lf-trade-selectors__arrow" aria-hidden="true">⇄</span>
            <label className="lf-trade-selector">
              <span>Chi riceve</span>
              <select value={managerB} onChange={(event) => changeManagerB(event.target.value)}>
                {managers.filter((name) => name !== managerA).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="lf-trade-panels">
            <TradeTeamPanel managerName={managerA} assets={assetsA} selected={selectedA} onToggle={toggle(setSelectedA)} media={media} />
            <TradeTeamPanel managerName={managerB} assets={assetsB} selected={selectedB} onToggle={toggle(setSelectedB)} media={media} />
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
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={creditAmount}
                  onChange={(event) => setCreditAmount(Math.max(0, Number(event.target.value) || 0))}
                  aria-label="Importo crediti"
                />
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
            <button type="button" className="lf-action-button lf-trade-submit" onClick={() => setModalOpen(true)} disabled={!canCopy}>
              Visualizza / Copia
            </button>
          </div>

          <TradeOutputModal
            open={modalOpen}
            title="Scambio"
            text={outputText}
            onClose={() => setModalOpen(false)}
          />
        </>
      )}
    </div>
  );
}
