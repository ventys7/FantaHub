import { useEffect, useRef, useState } from "react";
import { prepareLogo, uploadTeamLogo, type PreparedLogo } from "../../logoUpload";

export type TeamIdentityUpdate = { logoUrl: string; displayName: string };

export function LogoEditorDialog({ open, leagueId, teamName, currentLogo, currentName, onClose, onUpdated }: {
  open: boolean; leagueId: string; teamName: string; currentLogo: string; currentName: string; onClose: () => void; onUpdated: (update: TeamIdentityUpdate) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState(currentName);
  const [prepared, setPrepared] = useState<PreparedLogo | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setPrepared(null);
      setCode("");
      setStatus("");
    }
  }, [open, currentName]);

  async function selectFile(file?: File) {
    if (!file) return;
    setStatus("");
    try { setPrepared(await prepareLogo(file)); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Immagine non valida"); }
  }

  async function save() {
    const nextName = name.trim();
    const nameChanged = nextName !== currentName.trim();
    if (!prepared && !nameChanged) { setStatus("Modifica il nome o scegli un nuovo stemma."); return; }
    if (nextName.length > 24) { setStatus("Nome fantasquadra troppo lungo: massimo 24 caratteri."); return; }
    if (!/^\d{6}$/.test(code)) { setStatus("Inserisci il PIN di 6 cifre."); return; }
    setBusy(true); setStatus("");
    try {
      const update = await uploadTeamLogo(leagueId, teamName, code, prepared, nextName);
      onUpdated(update); setPrepared(null); setCode(""); onClose();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Salvataggio non riuscito"); }
    finally { setBusy(false); }
  }

  return (
    <dialog ref={dialog} className="lf-logo-dialog" onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="lf-logo-dialog__head"><div><small>STEMMA E NOME</small><h3>{teamName}</h3></div><button type="button" onClick={onClose} aria-label="Chiudi">×</button></div>
      <div className="lf-logo-dialog__preview">
        {(prepared?.previewUrl || currentLogo) ? <img src={prepared?.previewUrl || currentLogo} alt="Anteprima stemma" /> : <span>{(name.trim() || teamName).charAt(0).toUpperCase()}</span>}
      </div>
      <label className="lf-logo-code">Nome fantasquadra<input value={name} maxLength={24} onChange={(event) => setName(event.target.value.slice(0, 24))} placeholder="Facoltativo — max 24 caratteri" /></label>
      <label className="lf-logo-file">Scegli immagine<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectFile(event.target.files?.[0])} /></label>
      <label className="lf-logo-code">PIN<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" /></label>
      {status && <p className="lf-logo-dialog__status">{status}</p>}
      <button className="lf-logo-dialog__save" type="button" disabled={busy} onClick={save}>{busy ? "Salvataggio…" : "Aggiorna stemma e nome"}</button>
      <p className="lf-logo-dialog__help">Il PIN modifica stemma e nome di questa fantasquadra.</p>
    </dialog>
  );
}
