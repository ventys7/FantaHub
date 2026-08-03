import { useEffect, useRef, useState } from "react";
import { XIcon } from "../icons";

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

type Props = {
  open: boolean;
  title: string;
  text: string;
  onClose: () => void;
};

export function TradeOutputModal({ open, title, text, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    const ok = await copyTradeText(text);
    if (ok) {
      setCopied(true);
      window.showToast?.(title === "Scambio" ? "Scambio copiato!" : "Testo copiato!", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="lf-trade-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="lf-trade-modal__box">
        <div className="lf-trade-modal__heading">
          <h2>{title}</h2>
          <button type="button" className="lf-trade-modal__close" onClick={onClose} aria-label="Chiudi">
            <XIcon size={18} />
          </button>
        </div>
        <textarea ref={textareaRef} className="lf-trade-modal__output" readOnly value={text} rows={14} aria-label="Testo dello scambio" />
        <div className="lf-trade-modal__actions">
          <button type="button" className="lf-trade-copy" onClick={handleCopy} disabled={copied}>
            {copied ? "Copiato ✓" : "Copia scambio"}
          </button>
        </div>
      </div>
    </div>
  );
}
