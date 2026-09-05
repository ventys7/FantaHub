(function () {
  "use strict";

  const leagueId = document.documentElement.dataset.league;
  if (!leagueId) return;

  const loginView = document.getElementById("loginView");
  const adminView = document.getElementById("adminView");
  const loginForm = document.getElementById("loginForm");
  const password = document.getElementById("adminPassword");
  const leagueSettings = document.getElementById("leagueSettings");
  const logoCodes = document.getElementById("logoCodes");
  const feedback = document.getElementById("adminFeedback");
  const saveButton = document.getElementById("saveSettings");
  const logoutButton = document.getElementById("logoutButton");
  const mediaRefresh = document.getElementById("mediaRefresh");
  const mediaStatus = document.getElementById("mediaStatus");
  const unresolvedTeams = document.getElementById("unresolvedTeams");
  const unresolvedPlayers = document.getElementById("unresolvedPlayers");
  const DEGRADED_MEDIA_MESSAGE = "Sorgente foto (BSD) NON raggiungibile: sono mostrati i dati dell'ultima sincronizzazione riuscita";
  let state = null;
  let mediaManifest = null;

  function message(text, error = false) {
    feedback.textContent = text || "";
    feedback.classList.toggle("is-error", error);
  }

  async function adminApi(body) {
    const response = await fetch("/api/admin", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, leagueId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }

  async function mediaApi(body) {
    const response = await fetch("/api/player-media", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, leagueId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }

  function field(label, value, name) {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const input = document.createElement("input");
    input.type = "url";
    input.value = value || "";
    input.dataset.field = name;
    input.placeholder = "https://…";
    wrapper.appendChild(input);
    return wrapper;
  }

  function renderSettings() {
    leagueSettings.replaceChildren();
    const title = document.createElement("h2");
    title.textContent = leagueId === "fp" ? "Collegamenti Fanta Premier" : "Collegamenti Fanta Liga";
    const fields = document.createElement("div");
    fields.className = "admin-league-fields";
    fields.append(
      field("CSV Listone e Rose", state.settings.listoneCsvUrl, "listoneCsvUrl"),
      field("CSV Classifica", state.settings.standingsCsvUrl, "standingsCsvUrl"),
      field("Docs Richiami e Penalizzazioni", state.settings.disciplineDocUrl, "disciplineDocUrl"),
      field("Docs Regolamento", state.settings.regolamentoDocUrl, "regolamentoDocUrl"),
      field("Docs Calendario", state.settings.calendarioDocUrl, "calendarioDocUrl")
    );
    leagueSettings.append(title, fields);
  }

  function renderLogoCodes() {
    logoCodes.replaceChildren();
    (state.teams || []).forEach((teamName) => {
      const row = document.createElement("div");
      row.className = "code-row";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = teamName;
      copy.appendChild(title);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Genera / resetta";
      button.addEventListener("click", async () => {
        button.disabled = true;
        message("");
        try {
          const result = await adminApi({ action: "reset-logo-code", teamName });
          let resultNode = copy.querySelector(".code-result");
          if (!resultNode) {
            resultNode = document.createElement("span");
            resultNode.className = "code-result";
            copy.appendChild(resultNode);
          }
          resultNode.textContent = `Codice: ${result.code}`;
          message(`Nuovo codice creato per ${teamName}.`);
        } catch (error) { message(error.message, true); }
        finally { button.disabled = false; }
      });
      row.append(copy, button);
      logoCodes.appendChild(row);
    });
  }

  function mediaSummaryText(manifest) {
    if (manifest?.degraded) {
      const message = String(manifest?.degradedMessage || "").trim();
      return message || DEGRADED_MEDIA_MESSAGE;
    }
    const summary = manifest?.summary || {};
    const bsd = Number(summary.bsdResolved || 0);
    const unresolved = Number(summary.unresolved || 0);
    return `BSD dirette ${bsd} · ${unresolved} da controllare`;
  }

  function markPlayerResolved(entry, resolvedEntry) {
    if (mediaManifest?.players) mediaManifest.players[entry.key] = resolvedEntry;
    const card = unresolvedPlayers.querySelector(`[data-key="${CSS.escape(entry.key)}"]`);
    if (card) {
      card.classList.add("is-resolved");
      window.setTimeout(() => card.remove(), 180);
    }
    if (mediaManifest?.summary) {
      mediaManifest.summary.bsdResolved = Number(mediaManifest.summary.bsdResolved || 0) + 1;
      mediaManifest.summary.resolved = Number(mediaManifest.summary.resolved || 0) + 1;
      mediaManifest.summary.unresolved = Math.max(0, Number(mediaManifest.summary.unresolved || 0) - 1);
    }
    mediaStatus.textContent = mediaSummaryText(mediaManifest);
  }

  function candidateButton(entry, candidate) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "candidate-choice";

    const identity = document.createElement("span");
    identity.className = "candidate-list__identity";
    const image = document.createElement("img");
    image.src = `https://sports.bzzoiro.com/img/player/${candidate.id}/`;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    const thumbLetter = String(candidate.name || candidate.id || "?").trim().charAt(0).toUpperCase() || "?";
    image.addEventListener("error", () => {
      if (image.hidden) return;
      image.hidden = true;
      const thumb = document.createElement("span");
      thumb.className = "candidate-thumb-fallback";
      thumb.textContent = thumbLetter;
      identity.insertBefore(thumb, copy);
    });
    const copy = document.createElement("span");
    const name = document.createElement("b");
    name.textContent = candidate.name || `ID ${candidate.id}`;
    const details = document.createElement("small");
    details.textContent = `${candidate.teamName || "Squadra non indicata"} · ID ${candidate.id}`;
    copy.append(name, details);
    identity.append(image, copy);

    const use = document.createElement("strong");
    use.className = "candidate-choice__use";
    use.textContent = "Usa";
    choice.append(identity, use);

    choice.addEventListener("click", async () => {
      choice.disabled = true;
      message("");
      try {
        const result = await mediaApi({ action: "link", key: entry.key, candidate });
        markPlayerResolved(entry, result.entry);
        message(`${entry.listoneName} collegato a ${candidate.name}.`);
      } catch (error) {
        message(error.message, true);
        choice.disabled = false;
      }
    });
    return choice;
  }

  function candidateSection(titleText, entries, entry, options = {}) {
    const section = document.createElement("section");
    section.className = `candidate-section ${options.scroll ? "candidate-section--scroll" : ""}`;
    const title = document.createElement("h4");
    title.textContent = titleText;
    const list = document.createElement("div");
    list.className = "candidate-list";
    entries.forEach((candidate) => list.appendChild(candidateButton(entry, candidate)));
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "candidate-empty";
      empty.textContent = options.empty || "Nessun risultato.";
      list.appendChild(empty);
    }
    section.append(title, list);
    return section;
  }

  function teamCandidateButton(issue, candidate) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "candidate-choice candidate-choice--team";
    const copy = document.createElement("span");
    const name = document.createElement("b");
    name.textContent = candidate.name;
    const details = document.createElement("small");
    const total = Number(candidate.automatic || 0) + Number(candidate.ambiguous || 0) + Number(candidate.noNameMatch || 0);
    details.textContent = `ID ${candidate.id} · ${candidate.automatic}/${total} nomi · ${Math.round(Number(candidate.coverage || 0) * 100)}%`;
    copy.append(name, details);
    const use = document.createElement("strong");
    use.className = "candidate-choice__use";
    use.textContent = "Usa rosa";
    choice.append(copy, use);
    choice.addEventListener("click", async () => {
      choice.disabled = true;
      message("");
      try {
        await mediaApi({
          action: "link-team",
          teamName: issue.teamName,
          externalId: candidate.id,
          externalName: candidate.name
        });
        message(`${issue.teamName} collegato alla rosa BSD ${candidate.name}.`);
        await loadMediaStatus();
      } catch (error) {
        message(error.message, true);
        choice.disabled = false;
      }
    });
    return choice;
  }

  function unresolvedTeamCard(issue) {
    const card = document.createElement("article");
    card.className = "unresolved-card team-issue-card";
    card.dataset.teamKey = issue.key;

    const head = document.createElement("div");
    head.className = "unresolved-card__head";
    const name = document.createElement("strong");
    name.textContent = issue.teamName;
    const error = document.createElement("span");
    error.textContent = issue.error || "Squadra BSD da controllare";
    head.append(name, error);

    const search = document.createElement("div");
    search.className = "unresolved-search";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Confronta rose BSD";
    const candidates = document.createElement("div");
    candidates.className = "candidate-list";

    button.addEventListener("click", async () => {
      button.disabled = true;
      candidates.textContent = "Confronto rose…";
      try {
        const result = await mediaApi({ action: "search-team", teamName: issue.teamName });
        candidates.replaceChildren();
        (result.candidates || []).forEach((candidate) => candidates.appendChild(teamCandidateButton(issue, candidate)));
        if (!candidates.childElementCount) candidates.textContent = "Nessuna squadra BSD compatibile.";
      } catch (searchError) { candidates.textContent = searchError.message; }
      finally { button.disabled = false; }
    });
    search.append(button);
    card.append(head, search, candidates);
    return card;
  }

  function renderTeamIssues(manifest) {
    if (!unresolvedTeams) return;
    unresolvedTeams.replaceChildren();
    const issues = Array.isArray(manifest?.teamIssues) ? manifest.teamIssues : [];
    issues.forEach((issue) => unresolvedTeams.appendChild(unresolvedTeamCard(issue)));
  }

  async function renderCandidateResults(entry, input, host, includeDatabase = false) {
    host.textContent = "Ricerca…";
    const result = await mediaApi({
      action: "search",
      query: input.value.trim() || entry.listoneName,
      teamName: entry.realTeam,
      includeDatabase
    });
    host.replaceChildren();
    host.appendChild(candidateSection("Nomi simili nella rosa", result.similar || [], entry, {
      empty: "Nessun nome particolarmente simile nella rosa."
    }));
    host.appendChild(candidateSection("Rosa completa", result.roster || [], entry, { scroll: true }));

    if (includeDatabase) {
      host.appendChild(candidateSection("Tutto il database BSD della lega", result.database || [], entry, {
        scroll: true,
        empty: "Nessun altro nome compatibile nel database della lega."
      }));
    } else {
      const expand = document.createElement("button");
      expand.type = "button";
      expand.className = "secondary candidate-expand";
      expand.textContent = "Espandi a tutto il database BSD";
      expand.addEventListener("click", async () => {
        expand.disabled = true;
        try { await renderCandidateResults(entry, input, host, true); }
        catch (error) { host.textContent = error.message; }
      });
      host.appendChild(expand);
    }
  }

  function unresolvedCard(entry) {
    const card = document.createElement("article");
    card.className = "unresolved-card";
    card.dataset.key = entry.key;

    const head = document.createElement("div");
    head.className = "unresolved-card__head";
    const name = document.createElement("strong");
    name.textContent = entry.listoneName;
    const team = document.createElement("span");
    team.textContent = entry.realTeam || "";
    head.append(name, team);

    const reason = document.createElement("p");
    reason.className = "unresolved-card__reason";
    reason.textContent = entry.error || "Nessun collegamento automatico sicuro.";

    const search = document.createElement("div");
    search.className = "unresolved-search";
    const input = document.createElement("input");
    input.value = entry.listoneName;
    input.setAttribute("aria-label", `Cerca candidato per ${entry.listoneName}`);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Cerca candidati";
    const candidates = document.createElement("div");
    candidates.className = "candidate-results";

    button.addEventListener("click", async () => {
      button.disabled = true;
      try { await renderCandidateResults(entry, input, candidates, false); }
      catch (error) { candidates.textContent = error.message; }
      finally { button.disabled = false; }
    });

    const direct = document.createElement("div");
    direct.className = "unresolved-direct";
    const directInput = document.createElement("input");
    directInput.type = "text";
    directInput.inputMode = "numeric";
    directInput.placeholder = "ID giocatore BSD";
    const directButton = document.createElement("button");
    directButton.type = "button";
    directButton.className = "secondary";
    directButton.textContent = "Usa ID";
    directButton.addEventListener("click", async () => {
      directButton.disabled = true;
      message("");
      try {
        const result = await mediaApi({
          action: "link-id",
          key: entry.key,
          externalId: directInput.value.trim(),
          externalName: entry.listoneName,
          teamName: entry.realTeam
        });
        markPlayerResolved(entry, result.entry);
        message(`${entry.listoneName} collegato all'ID BSD ${directInput.value.trim()}.`);
      } catch (error) {
        message(error.message, true);
        directButton.disabled = false;
      }
    });

    search.append(input, button);
    direct.append(directInput, directButton);
    card.append(head, reason, search, candidates, direct);
    return card;
  }

  function quotaLine(payload) {
    const quota = payload?.quota;
    if (!quota) return "";
    const reset = String(quota.resetAt || "").slice(11, 16);
    const base = `Quota BSD oggi ${quota.callsToday ?? "?"}/${quota.limit ?? "?"}${reset ? ` · reset ${reset} UTC` : ""}`;
    return quota.exhausted ? `${base} · ESAURITA` : base;
  }

  function renderUnresolved(manifest, { preserveExisting = false } = {}) {
    mediaManifest = manifest;
    const quota = quotaLine(manifest);
    mediaStatus.textContent = mediaSummaryText(manifest) + (quota ? ` · ${quota}` : "");
    renderTeamIssues(manifest);
    const entries = Object.values(manifest?.players || {}).filter((entry) => entry.status !== "resolved" || !entry.photoUrl);
    const incomingKeys = new Set(entries.map((entry) => entry.key));

    if (!preserveExisting) unresolvedPlayers.replaceChildren();
    else {
      unresolvedPlayers.querySelectorAll("[data-key]").forEach((node) => {
        if (!incomingKeys.has(node.dataset.key)) node.remove();
      });
    }

    const existing = new Set([...unresolvedPlayers.querySelectorAll("[data-key]")].map((node) => node.dataset.key));
    entries.forEach((entry) => {
      if (!existing.has(entry.key)) unresolvedPlayers.appendChild(unresolvedCard(entry));
    });
  }

  async function loadMediaStatus({ preserveExisting = false } = {}) {
    try {
      const response = await fetch(`/api/player-media?league=${encodeURIComponent(leagueId)}&_lf=${Date.now()}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Stato non disponibile");
      renderUnresolved(await response.json(), { preserveExisting });
    } catch {
      mediaStatus.textContent = "Lo stato immagini non è disponibile.";
    }
  }

  function setMediaButtonsDisabled(disabled) {
    mediaRefresh.disabled = disabled;
  }

  function quotaStopMessage(quota) {
    const reset = String(quota?.resetAt || "").slice(11, 16);
    return `Quota BSD esaurita per oggi (${quota?.callsToday ?? "?"}/${quota?.limit ?? "?"}). Si resetta alle ${reset || "?"} UTC: i dati restano quelli dell'ultima sincronizzazione riuscita, per tutti i dispositivi.`;
  }

  async function syncMediaLoop() {
    setMediaButtonsDisabled(true);
    message("Ricalcolo i collegamenti BSD e aggiorno la cache Neon…");
    try {
      // Il backend azzera il checkpoint a "refresh" e prosegue a "continue-sync"
      // finche' gli step (serverless-safe) non raggiungono il terminale.
      // Se un altro dispositivo ha un giro fresco in corso, ci si aggancia.
      let result = await mediaApi({ action: "refresh" });
      if (result?.quotaExhausted) throw new Error(quotaStopMessage(result.quota));
      let guard = 0;
      while (result?.pending && guard < 60) {
        guard += 1;
        const progress = result.progress || {};
        if (result.phase === "teams") message(`Carico le squadre BSD… (${progress.clubsDone || 0}/${progress.clubs || 0})`);
        else if (result.phase === "search") message(`Ricerca per nome… (${progress.searchDone || 0}/${progress.total || "?"})`);
        else message(`Foto fallback… (${result.phase || "?"})`);
        result = await mediaApi({ action: "continue-sync" });
        if (result?.quotaExhausted) throw new Error(quotaStopMessage(result.quota));
      }
      if (result?.pending) throw new Error("L'aggiornamento non è terminato in tempo massimo.");
      if (!result?.manifest) throw new Error("Terminali senza manifest restituito.");
      renderUnresolved(result.manifest);
      message(result?.manifest?.degraded
        ? "Aggiornamento completato con i dati dell'ultima sincronizzazione riuscita (sorgente foto BSD non raggiungibile)."
        : "Collegamenti BSD aggiornati. Le facce restano dirette da BSD e gli override sono salvati su Neon.");
    } catch (error) { message(error.message, true); }
    finally { setMediaButtonsDisabled(false); }
  }

  function render(nextState) {
    state = nextState;
    const authenticated = Boolean(state?.authenticated);
    loginView.hidden = authenticated;
    adminView.hidden = !authenticated;
    if (!authenticated) return;
    renderSettings();
    renderLogoCodes();
    loadMediaStatus();
  }

  async function loadState() {
    try {
      const response = await fetch(`/api/admin?league=${encodeURIComponent(leagueId)}&_lf=${Date.now()}`, { cache: "no-store", credentials: "same-origin" });
      render(await response.json());
    } catch (error) { message(error.message, true); }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    message("");
    try {
      render(await adminApi({ action: "login", password: password.value }));
      password.value = "";
    } catch (error) { message(error.message, true); }
  });

  saveButton.addEventListener("click", async () => {
    const settings = structuredClone(state.settings);
    document.querySelectorAll("[data-field]").forEach((input) => { settings[input.dataset.field] = input.value.trim(); });
    saveButton.disabled = true;
    message("");
    try {
      render(await adminApi({ action: "save-settings", settings }));
      message("Collegamenti salvati su Neon.");
    } catch (error) { message(error.message, true); }
    finally { saveButton.disabled = false; }
  });

  logoutButton.addEventListener("click", async () => render(await adminApi({ action: "logout" })));
  mediaRefresh.addEventListener("click", syncMediaLoop);
  loadState();
})();
