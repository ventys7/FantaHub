import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./theme/ThemeProvider";
import { SectionManager } from "./sections/SectionManager";
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

window.addEventListener("error", (event) => {
  log.error("unhandled window error", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  log.error("unhandled promise rejection", event.reason);
});

// Feedback di pressione touch/pointer per i controlli del listone (vedi pressFeedback.ts).
installPressFeedback();

// Il Listone è sempre montato. Rose, Scambi e Classifica vengono montate al
// primo accesso alla sezione dalla SectionManager, guidata dal router React
// (useLeagueRoute) che osserva l'evento "lineup:league-section-change" dello
// shell: niente più listener raw in questo file.
mount("league-dashboard-root", "Listone", <App />);

const managerRoot = document.createElement("div");
managerRoot.id = "league-section-manager";
managerRoot.style.display = "none";
document.body.appendChild(managerRoot);
ReactDOM.createRoot(managerRoot).render(
  <React.StrictMode>
    <ThemeProvider>
      <SectionManager />
    </ThemeProvider>
  </React.StrictMode>
);
