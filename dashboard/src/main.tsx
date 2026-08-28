import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LeagueApp } from "./LeagueApp";
import { createLogger } from "./debug/logger";
import { installPressFeedback } from "./utils/pressFeedback";
import "./styles/runtime.css";
import "./styles/listone.css";
import "./styles/teams.css";
import "./styles/standings.css";
import "./styles/trades.css";

const log = createLogger("bootstrap");

window.addEventListener("error", (e) => {
  log.error("Errore non gestito", e.error ?? e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  log.error("Promise rifiutata", (e as PromiseRejectionEvent).reason);
});

installPressFeedback();

const rootEl = document.getElementById("league-react-root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary name="LeagueApp">
        <LeagueApp />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  log.error("league-react-root mancante");
}
