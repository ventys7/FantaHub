import { useEffect, useMemo, useRef, useState } from "react";
import { fetchFreshText, useSectionRefresh } from "./liveRefresh";
import { createLogger } from "./debug/logger";
import { Standings } from "./pages/Standings";
import { parseStandingsCsv, type StandingsData } from "./standings";
import { loadRuntimeLeagueSettings } from "./runtimeSettings";
import { getCachedDiscipline, loadDiscipline, type DisciplineData } from "./discipline";
import { DisciplineBoard } from "./components/DisciplineBoard";
import { loadTeamProfiles, type TeamProfiles } from "./teamProfiles";
import { useLeagueAssets } from "./hooks";

const EMPTY_DATA: StandingsData = { league: [], fantasy: [] };
const EMPTY_DISCIPLINE: DisciplineData = { recalls: [], penalties: [], configured: false };
const log = createLogger("standings");

export default function StandingsApp() {
  const { league } = useLeagueAssets();
  const leagueId = league?.id ?? "";
  const fallbackUrl = league?.leagueData?.standingsFallbackUrl ?? "";

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<StandingsData>(EMPTY_DATA);
  const [error, setError] = useState("");
  const initialDiscipline = getCachedDiscipline(leagueId)?.data ?? null;
  const [discipline, setDiscipline] = useState<DisciplineData>(initialDiscipline ?? EMPTY_DISCIPLINE);
  const [disciplineLoading, setDisciplineLoading] = useState(!initialDiscipline);
  const [disciplineError, setDisciplineError] = useState("");
  const [teamProfiles, setTeamProfiles] = useState<TeamProfiles>({});
  const hasLoadedData = useRef(false);
  const hasLoadedDiscipline = useRef(Boolean(initialDiscipline));
  const lastCsvText = useRef("");
  const refreshToken = useSectionRefresh("classifica");

  useEffect(() => {
    const controller = new AbortController();

    async function loadStandings() {
      const initialLoad = !hasLoadedData.current;
      if (initialLoad) setStatus("loading");
      setError("");

      try {
        const runtime = await loadRuntimeLeagueSettings(leagueId);
        const standingsUrl = runtime.standingsCsvUrl;
        if (!standingsUrl) {
          setData(EMPTY_DATA);
          setStatus("ready");
        } else {
          let csvText: string;
          try { csvText = await fetchFreshText(standingsUrl, controller.signal); }
          catch (primaryError) {
            if (!fallbackUrl || controller.signal.aborted) throw primaryError;
            log.warn("primary source unavailable; using fallback", primaryError);
            csvText = await fetchFreshText(fallbackUrl, controller.signal);
          }
          if (csvText !== lastCsvText.current) {
            const parsed = parseStandingsCsv(csvText);
            if (parsed.league.length === 0 && hasLoadedData.current) throw new Error("Aggiornamento vuoto della Classifica");
            lastCsvText.current = csvText;
            setData(parsed);
          }
          hasLoadedData.current = true;
          setStatus("ready");
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          log.error("load failed", loadError);
          if (!hasLoadedData.current) {
            setError("La Classifica non è disponibile. Controlla la fonte configurata e riprova.");
            setStatus("error");
          }
        }
      }

    }

    loadStandings();
    return () => controller.abort();
  }, [leagueId, fallbackUrl, refreshToken]);

  useEffect(() => {
    let cancelled = false;
    loadTeamProfiles(leagueId, league?.leagueData?.teamProfilesUrl)
      .then((profiles) => { if (!cancelled) setTeamProfiles(profiles); })
      .catch((loadError) => { log.warn("team profiles load failed", loadError); });
    return () => { cancelled = true; };
  }, [leagueId, league?.leagueData?.teamProfilesUrl, refreshToken]);

  useEffect(() => {
    const onLogoUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ leagueId: string; teamName: string; logoUrl: string }>).detail;
      if (!detail || detail.leagueId !== leagueId || !detail.teamName) return;
      setTeamProfiles((current) => ({
        ...current,
        [detail.teamName]: {
          ...(current[detail.teamName] || { credits: null, logoUrl: "" }),
          logoUrl: detail.logoUrl
        }
      }));
    };
    window.addEventListener("lineup:team-logo-updated", onLogoUpdated as EventListener);
    return () => window.removeEventListener("lineup:team-logo-updated", onLogoUpdated as EventListener);
  }, [leagueId]);

  useEffect(() => {
    const controller = new AbortController();

    const refreshDiscipline = async () => {
      const initial = !hasLoadedDiscipline.current;
      if (initial) setDisciplineLoading(true);
      try {
        const next = await loadDiscipline(leagueId, controller.signal);
        if (!controller.signal.aborted) {
          setDiscipline(next);
          setDisciplineError("");
          hasLoadedDiscipline.current = true;
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          log.warn("discipline load failed", loadError);
          if (!hasLoadedDiscipline.current) setDisciplineError("Richiami e penalizzazioni non disponibili");
        }
      } finally {
        if (!controller.signal.aborted && initial) setDisciplineLoading(false);
      }
    };

    void refreshDiscipline();
    return () => controller.abort();
  }, [leagueId, refreshToken]);

  const leagueName = useMemo(() => league?.label ?? league?.name ?? "Lega", [league]);
  const teamLogos = useMemo(() => Object.entries(teamProfiles).reduce<Record<string, string>>((result, [name, profile]) => {
    const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
    if (profile.logoUrl) result[key] = profile.logoUrl;
    return result;
  }, {}), [teamProfiles]);

  if (status === "loading") return <div className="lf-standings-shell"><section className="lf-dashboard-card lf-standings-state"><div className="lf-spinner"/><p>Caricamento della Classifica…</p></section></div>;
  if (status === "error") return <div className="lf-standings-shell"><section className="lf-dashboard-card lf-standings-state lf-standings-state--error"><strong>Errore nel caricamento</strong><p>{error}</p></section></div>;

  return (
    <div>
      <Standings data={data} leagueName={leagueName} teamLogos={teamLogos} />
      <div className="lf-standings-shell lf-standings-shell--discipline">
        <DisciplineBoard data={discipline} loading={disciplineLoading} error={disciplineError} />
      </div>
    </div>
  );
}
