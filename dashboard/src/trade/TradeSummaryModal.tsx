import { useEffect, useId, useRef, useState } from "react";
import { ShieldIcon, XIcon } from "../icons";
import type { PlayerMediaEntry } from "../media";
import type { DashboardAsset } from "../types";
import { formatCreditTransfer, isGoalkeeperBlock } from "./tradeModel";

/**
 * Copia il testo negli appunti con fallback textarea (stesso approccio di
 * js/output.js): prima navigator.clipboard, poi execCommand("copy").
 */
export async function copyTradeText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallthrough al fallback
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export type TradeSummary = {
  managerA: string;
  managerB: string;
  aGives: readonly DashboardAsset[];
  bGives: readonly DashboardAsset[];
  /** +n = A offre crediti a B; -n = A richiede; 0 = nessun credito. */
  credits: number;
};

type Props = {
  open: boolean;
  summary: TradeSummary;
  /** Messaggio copiabile già formattato (buildTradeText). */
  text: string;
  media: { player: (name: string, team: string) => PlayerMediaEntry | null; crest: (team: string) => string };
  onClose: () => void;
};

const ROLE_BADGE: Record<string, string> = { P: "lf-role-badge--p", D: "lf-role-badge--d", C: "lf-role-badge--c", A: "lf-role-badge--a" };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function SummaryRow({ asset, media }: { asset: DashboardAsset; media: Props["media"] }) {
  const isBlock = isGoalkeeperBlock(asset);
  const crest = media.crest(asset.realTeam);
  const photo = isBlock ? undefined : media.player(asset.displayName, asset.realTeam)?.photoUrl;
  return (
    <li className="lf-trade-summary__row">
      {isBlock ? (
        <span className={`lf-squad-block-crest ${crest ? "has-crest" : ""}`} aria-hidden="true">
          {crest ? <img src={crest} alt="" loading="lazy" decoding="async" /> : <ShieldIcon size={17} />}
        </span>
      ) : (
        <span className={`lf-squad-avatar lf-squad-avatar--${asset.role.toLowerCase()} ${photo ? "has-photo" : ""}`} aria-hidden="true">
          {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : initials(asset.displayName)}
        </span>
      )}
      <span className="lf-trade-summary__name">
        {isBlock ? `Blocco ${asset.realTeam || asset.displayName}` : asset.displayName}
        {!asset.active && " *"}
      </span>
      <span className={`lf-role-badge ${ROLE_BADGE[asset.role] ?? ""}`}>{asset.role}</span>
    </li>
  );
}

export function TradeSummaryModal({ open, summary, text, media, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCopied(false);
    // blocca lo scroll della pagina sotto la card (mobile incluso)
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    const ok = await copyTradeText(text);
    if (ok) {
      setCopied(true);
      window.showToast?.("Messaggio scambi copiato!", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="lf-trade-summary" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="lf-trade-summary__box">
        <header className="lf-trade-summary__heading">
          <h2 id={titleId}>Riepilogo scambio</h2>
          <button ref={closeButtonRef} type="button" className="lf-trade-summary__close" onClick={onClose} aria-label="Chiudi">
            <XIcon size={18} />
          </button>
        </header>

        <div className="lf-trade-summary__body">
          <section className="lf-trade-summary__side" aria-label={`Offre ${summary.managerA}`}>
            <h3><span className="lf-trade-summary__badge" aria-hidden="true">⇄</span> {summary.managerA} <em>offre</em></h3>
            <ul className="lf-trade-summary__list">
              {summary.aGives.map((asset) => <SummaryRow key={asset.assetCode} asset={asset} media={media} />)}
            </ul>
          </section>

          <section className="lf-trade-summary__side" aria-label={`In cambio da ${summary.managerB}`}>
            <h3><span className="lf-trade-summary__badge" aria-hidden="true">⇄</span> <em>in cambio da</em> {summary.managerB}</h3>
            <ul className="lf-trade-summary__list">
              {summary.bGives.map((asset) => <SummaryRow key={asset.assetCode} asset={asset} media={media} />)}
            </ul>
          </section>

          {summary.credits !== 0 && (
            <div className="lf-trade-summary__credits">
              {formatCreditTransfer(summary.credits, summary.managerA, summary.managerB)}
            </div>
          )}
        </div>

        <footer className="lf-trade-summary__actions">
          <button type="button" className="lf-action-button lf-trade-copy" onClick={handleCopy} disabled={copied}>
            {copied ? "Copiato ✓" : "Copia messaggio"}
          </button>
        </footer>
      </div>
    </div>
  );
}
