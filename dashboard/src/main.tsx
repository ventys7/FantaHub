import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import RoseApp from "./RoseApp";
import StandingsApp from "./StandingsApp";
import TradeApp from "./trade/TradeApp";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./theme/ThemeProvider";
import { createLogger } from "./debug/logger";
import { installPressFeedback } from "./utils/pressFeedback";
import "./styles/runtime.css";
import "./styles/listone.css";
import "./styles/teams.css";
import "./styles/standings.css";
import "./styles/trades.css";

const log = createLogger("bootstrap");

function mount(rootId: string, name: string, app: React.ReactNode): void {
  const root = document.getElementById(rootId);
  if (!root) {
    log.debug("root not present", { rootId, name });
    return;
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary name={name}>
        <ThemeProvider>{app}</ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
  log.debug("mounted", { rootId, name });
}

// Rose, Scambi e Classifica vengono montate solo al primo accesso alla
// sezione: l'avvio monta solo il Listone, il cambio tab non deve più pagare
// il render iniziale delle altre app (e i successivi cambi sono immediati).
const mountedSections = new Set<string>();
function mountSectionOnce(section: string): void {
  if (mountedSections.has(section)) return;
  mountedSections.add(section);
  if (section === "rose") mount("league-rose-root", "Rose", <RoseApp />);
  else if (section === "scambi") mount("league-trades-root", "Scambi", <TradeApp />);
  else if (section === "classifica") mount("league-standings-root", "Classifica", <StandingsApp />);
}

window.addEventListener("lineup:league-section-change", (event) => {
  const detail = (event as CustomEvent<{ section?: string }>).detail;
  if (detail?.section) mountSectionOnce(detail.section);
});

window.addEventListener("error", (event) => {
  log.error("unhandled window error", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  log.error("unhandled promise rejection", event.reason);
});

// Feedback di pressione touch/pointer per i controlli del listone (vedi pressFeedback.ts).
installPressFeedback();

// Il Listone è sempre montato; Rose, Scambi e Classifica vengono montate al
// primo accesso alla sezione (evento) oppure subito se la pagina è già aperta su di esse.
mount("league-dashboard-root", "Listone", <App />);
const initialSection = document.documentElement.dataset.leagueSection;
if (initialSection === "rose" || initialSection === "scambi" || initialSection === "classifica") mountSectionOnce(initialSection);
