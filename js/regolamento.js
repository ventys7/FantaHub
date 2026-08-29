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
    const value = String(rawUrl || "");
    if (!value) return "";
    let url;
    try { url = new URL(value, window.location.href); }
    catch { return ""; }
    if (url.hostname !== "docs.google.com") return url.toString();
    // I doc Google passano dal proxy locale: serve il pub con immagini
    // riscritte e CSS che le comprime (le immagini originali straripano su mobile).
    return `/api/regolamento?league=${encodeURIComponent(window.LINEUP_FANTA?.leagueId || "")}`;
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
