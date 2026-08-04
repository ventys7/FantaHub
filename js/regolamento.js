/* REGOLAMENTO - Tab con iframe del Google Docs pub configurato per lega.
   La tab resta nascosta finché un URL non è configurato (default statico o admin). */
(function () {
  "use strict";

  if (window.LINEUP_FANTA?.route !== "league") return;

  const frame = document.getElementById("regolamentoFrame");
  const placeholder = document.getElementById("regolamentoPlaceholder");
  const tab = document.querySelector('[data-league-tab="regolamento"]');
  if (!frame || !placeholder || !tab) return;

  function embedUrl(rawUrl) {
    let url;
    try { url = new URL(String(rawUrl || ""), window.location.href); }
    catch { return ""; }
    if (url.hostname !== "docs.google.com") return url.toString();
    // Gli URL di modifica non sono embeddabili: si apre la versione pubblicata.
    url.pathname = url.pathname.replace(/\/edit(?:\/.*)?$/i, "/pub");
    // Senza query, ?embedded=true toglie la barra "pubblicato da" di Google.
    if (!url.search) url.search = "?embedded=true";
    return url.toString();
  }

  function showUnavailable() {
    tab.hidden = true;
    frame.removeAttribute("src");
    placeholder.hidden = false;
  }

  function showRegolamento(url) {
    tab.hidden = false;
    placeholder.hidden = true;
    frame.src = url;
  }

  LineupRuntimeSettings.get(window.LINEUP_FANTA?.leagueId).then((settings) => {
    const url = embedUrl(settings?.regolamentoDocUrl || "");
    if (url) showRegolamento(url);
    else showUnavailable();
  }).catch(showUnavailable);
})();
