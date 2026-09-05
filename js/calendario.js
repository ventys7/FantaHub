/* CALENDARIO - Tab con iframe del Google Docs pub configurato per lega.
   Stessa logica della tab Regolamento: la tab resta nascosta finché un URL
   non è configurato (default statico o admin). */
(function () {
  "use strict";

  if (window.LINEUP_FANTA?.route !== "league") return;

  const frame = document.getElementById("calendarioFrame");
  const placeholder = document.getElementById("calendarioPlaceholder");
  const tab = document.querySelector('[data-league-tab="calendario"]');
  if (!frame || !placeholder || !tab) return;

  function embedUrl(rawUrl) {
    const value = String(rawUrl || "");
    if (!value) return "";
    let url;
    try { url = new URL(value, window.location.href); }
    catch { return ""; }
    if (url.hostname !== "docs.google.com") return url.toString();
    // I doc Google passano dal proxy locale: serve il pub con immagini
    // riscritte e CSS che le comprime (le immagini originali straripano su mobile).
    return `/api/calendario?league=${encodeURIComponent(window.LINEUP_FANTA?.leagueId || "")}`;
  }

  function showUnavailable() {
    tab.hidden = true;
    frame.removeAttribute("src");
    placeholder.hidden = false;
  }

  function showCalendario(url) {
    tab.hidden = false;
    placeholder.hidden = true;
    frame.src = url;
  }

  LineupRuntimeSettings.get(window.LINEUP_FANTA?.leagueId).then((settings) => {
    const url = embedUrl(settings?.calendarioDocUrl || "");
    if (url) showCalendario(url);
    else showUnavailable();
  }).catch(showUnavailable);
})();
