interface GkGroup {
  key: string;
  blockName: string | null;
  players: { player: { n: string; t?: string; r?: string }; index: number }[];
}

function getGkGroups(): GkGroup[] {
  const api = (window as unknown as {
    GkBlocks?: {
      getGroups: () => GkGroup[];
      isBlockDisabled: (name: string | null) => boolean;
    };
  }).GkBlocks;
  if (!api || typeof api.getGroups !== "function") return [];
  return api.getGroups().filter((g) => !api.isBlockDisabled(g.blockName));
}

function gkPhotoUrl(name: string, team?: string): string | null {
  const media = (window as unknown as {
    LineupPlayerMedia?: { photo?: (n: string, t?: string) => string | null | undefined };
  }).LineupPlayerMedia;
  if (!media?.photo) return null;
  return media.photo(name, team) ?? null;
}

export function GkModal({
  onClose,
  onConfirm
}: {
  onClose: () => void;
  onConfirm: (index: number) => void;
}) {
  const groups = getGkGroups();

  return (
    <div
      className="modal gk-modal show"
      id="gkChoiceModal"
      role="dialog"
      aria-modal="true"
      aria-hidden="false"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="box">
        <h3 className="gk-modal-title" id="gkBlockName">
          Portiere
        </h3>
        <div className="gk-choices" id="gkChoices">
          {groups.map((group) => (
            <div key={group.key} className="gk-group">
              {group.blockName && <div className="gk-group__name">{group.blockName}</div>}
              {group.players.map(({ player, index }) => {
                const url = gkPhotoUrl(player.n, player.t);
                return (
                  <button
                    key={index}
                    type="button"
                    className="gk-choice-btn"
                    onClick={() => onConfirm(index)}
                  >
                    <span className="gk-choice-btn__photo">
                      {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : "P"}
                    </span>
                    <span className="gk-choice-btn__name">{player.n}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">
          ×
        </button>
      </div>
    </div>
  );
}
