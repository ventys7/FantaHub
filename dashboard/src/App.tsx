import { Players } from "./pages/Players";
import { useLeagueAssets } from "./hooks";

export default function App() {
  const { state, assets, league } = useLeagueAssets();

  if (state.status === "error") {
    return <div className="tw-p-4"><section className="lf-dashboard-card tw-mx-auto tw-max-w-4xl tw-p-7 tw-text-center"><h2 className="tw-m-0 tw-text-lg tw-font-bold tw-text-red-600">Errore nel caricamento del Listone</h2><p className="tw-mb-0 tw-mt-2 tw-text-sm tw-text-slate-500">Controlla il CSV della lega e ricarica la pagina.</p></section></div>;
  }

  if (state.status !== "ready") {
    return <div className="tw-p-4"><section className="lf-dashboard-card tw-mx-auto tw-max-w-4xl tw-p-7 tw-text-center"><div className="lf-spinner tw-mx-auto tw-mb-3"/><p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-500">Caricamento del Listone…</p></section></div>;
  }

  return <Players assets={assets} />;
}
