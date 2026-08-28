export function Controls({
  manager,
  managers,
  module,
  modules,
  onManagerChange,
  onModuleChange,
  onReset,
  onToggleRoster
}: {
  manager: string | null;
  managers: string[];
  module: string;
  modules: string[];
  onManagerChange: (m: string) => void;
  onModuleChange: (m: string) => void;
  onReset: () => void;
  onToggleRoster: () => void;
}) {
  const formatModule = (m: string) => [...m].join("-");
  return (
    <div className="controls">
      <select
        className="manager-select"
        value={manager ?? ""}
        onChange={(e) => onManagerChange(e.target.value)}
        aria-label="Squadra"
      >
        {managers.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <button type="button" className="toggle-roster-btn" onClick={onToggleRoster}>
        Rosa
      </button>
      <select
        className="module-select"
        value={module}
        onChange={(e) => onModuleChange(e.target.value)}
        aria-label="Modulo"
      >
        {modules.map((m) => (
          <option key={m} value={m}>
            {formatModule(m)}
          </option>
        ))}
      </select>
      <button type="button" className="reset-btn-small" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
