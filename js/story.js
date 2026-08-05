/* LINEUP STORY — 9:16 canvas preview, share and copy image */

window.LineupStory = (function () {
  const WIDTH = 1080;
  const HEIGHT = 1920;
  const PITCH = { x: 70, y: 318, width: 940, height: 1020 };
  const ROLE_COLORS = Object.freeze({
    P: { fill: "#f6c84c", ink: "#604800" },
    D: { fill: "#5b8ff9", ink: "#ffffff" },
    C: { fill: "#45be72", ink: "#ffffff" },
    A: { fill: "#ee5a63", ink: "#ffffff" }
  });

  let currentBlob = null;
  let currentUrl = null;
  let currentFileName = "formazione-lineup.png";

  function leagueConfig() {
    return window.LINEUP_FANTA?.league || {
      name: "Lineup Fanta",
      label: "Lineup Fanta",
      flag: "⚽",
      theme: { primary: "#7c3aed", primaryLight: "#a855f7" }
    };
  }

  function storyModel() {
    const model = window.FormationModel?.build?.();
    if (!model) return null;

    model.switchPair = window.LineupSwitch?.getPairForModel?.({
      team: model.team,
      starters: model.starters,
      bench: model.bench
    }) || null;

    return model;
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function fillRounded(ctx, x, y, width, height, radius, fill, stroke = null, lineWidth = 1) {
    roundRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function font(ctx, weight, size, family = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif") {
    ctx.font = `${weight} ${size}px ${family}`;
  }

  function textWidth(ctx, text) {
    return ctx.measureText(String(text || "")).width;
  }

  function fitFont(ctx, text, maxWidth, start, min, weight = 800) {
    let size = start;
    while (size > min) {
      font(ctx, weight, size);
      if (textWidth(ctx, text) <= maxWidth) break;
      size -= 1;
    }
    return size;
  }

  function wrapWords(ctx, text, maxWidth, maxLines = 2) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];

    const lines = [];
    let line = "";

    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(ctx, next) <= maxWidth || !line) {
        line = next;
        return;
      }
      if (lines.length < maxLines - 1) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });

    if (line) lines.push(line);
    return lines.slice(0, maxLines);
  }

  function centeredText(ctx, text, x, y, options = {}) {
    const { size = 28, weight = 700, color = "#fff", maxWidth = null } = options;
    const usedSize = maxWidth ? fitFont(ctx, text, maxWidth, size, Math.max(12, size - 12), weight) : size;
    font(ctx, weight, usedSize);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    return usedSize;
  }


  function photoKey(player) {
    if (!player?.n || !player?.t || player.isTeamLabel) return "";
    return window.LineupPlayerMedia?.playerKey?.(player.n, player.t) || `${String(player.n).toLowerCase()}|${String(player.t).toLowerCase()}`;
  }

  function loadPhoto(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const image = new Image();
      const timer = window.setTimeout(() => resolve(null), 5000);
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => { window.clearTimeout(timer); resolve(image); };
      image.onerror = () => { window.clearTimeout(timer); resolve(null); };
      image.src = url;
    });
  }

  async function preloadPhotos(model) {
    const leagueId = window.LINEUP_FANTA?.league?.id || "";
    const players = [];
    model.definitions.starter.forEach((definition) => {
      const player = model.slots.starter[definition.id]?.player;
      if (photoKey(player)) players.push(player);
    });
    model.definitions.bench.forEach((definition) => {
      const player = window.FormationModel.getBenchDisplayEntry(model, definition)?.player;
      if (photoKey(player)) players.push(player);
    });

    const unique = new Map(players.map((player) => [photoKey(player), player]));
    const photos = new Map();
    await Promise.all([...unique.entries()].map(async ([key, player]) => {
      const url = window.LineupPlayerMedia?.storyPhoto?.(player.n, player.t, leagueId)
        || window.LineupPlayerMedia?.photo?.(player.n, player.t, leagueId)
        || "";
      const image = await loadPhoto(url);
      if (image) photos.set(key, image);
    }));

    // Crest delle squadre per i blocchi portiere in panchina (entries team label)
    const crestTeams = new Set();
    model.definitions.bench.forEach((definition) => {
      if (definition.role !== "P") return;
      const player = window.FormationModel.getBenchDisplayEntry(model, definition)?.player;
      if (player?.isTeamLabel && player.n) crestTeams.add(player.n);
    });
    await Promise.all([...crestTeams].map(async (teamName) => {
      const url = window.LineupPlayerMedia?.crest?.(teamName) || "";
      const image = await loadPhoto(url);
      if (image) photos.set(`crest:${teamName}`, image);
    }));

    return photos;
  }

  function crestPhoto(photos, teamName) {
    return teamName ? photos.get(`crest:${teamName}`) || null : null;
  }

  function playerPhoto(photos, player) {
    const key = photoKey(player);
    return key ? photos.get(key) || null : null;
  }

  function drawCoverImage(ctx, image, x, y, size, radius = size / 2) {
    if (!image) return;
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return;
    const sourceSize = Math.min(sourceWidth, sourceHeight);
    const sourceX = (sourceWidth - sourceSize) / 2;
    const sourceY = Math.max(0, (sourceHeight - sourceSize) * 0.22);
    ctx.save();
    roundRect(ctx, x, y, size, size, radius);
    ctx.clip();
    ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, x, y, size, size);
    ctx.restore();
  }

  function drawCrest(ctx, image, x, y, size, radius = 10) {
    if (!image) return;
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return;
    ctx.save();
    roundRect(ctx, x, y, size, size, radius);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, size, size);
    const scale = Math.min(size / sourceWidth, size / sourceHeight) * 0.86;
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    ctx.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
    ctx.restore();
  }

  function drawPitch(ctx) {
    const gradient = ctx.createLinearGradient(PITCH.x, PITCH.y, PITCH.x, PITCH.y + PITCH.height);
    gradient.addColorStop(0, "#397a65");
    gradient.addColorStop(.52, "#28604f");
    gradient.addColorStop(1, "#174437");

    fillRounded(ctx, PITCH.x, PITCH.y, PITCH.width, PITCH.height, 38, gradient, "rgba(255,255,255,.26)", 3);

    ctx.save();
    roundRect(ctx, PITCH.x, PITCH.y, PITCH.width, PITCH.height, 38);
    ctx.clip();

    ctx.fillStyle = "rgba(255,255,255,.035)";
    for (let row = 0; row < 12; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        if ((row + col) % 2 === 0) ctx.fillRect(PITCH.x + col * 94, PITCH.y + row * 85, 94, 85);
      }
    }

    ctx.strokeStyle = "rgba(241,255,249,.44)";
    ctx.lineWidth = 3;
    ctx.strokeRect(PITCH.x + 28, PITCH.y + 28, PITCH.width - 56, PITCH.height - 56);

    ctx.beginPath();
    ctx.moveTo(PITCH.x + 28, PITCH.y + PITCH.height / 2);
    ctx.lineTo(PITCH.x + PITCH.width - 28, PITCH.y + PITCH.height / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(PITCH.x + PITCH.width / 2, PITCH.y + PITCH.height / 2, 92, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeRect(PITCH.x + 235, PITCH.y + 28, 470, 132);
    ctx.strokeRect(PITCH.x + 235, PITCH.y + PITCH.height - 160, 470, 132);
    ctx.restore();
  }

  function drawShirt(ctx, { x, y, width, height, player, role, photo = null }) {
    const selected = Boolean(player && !player.isTeamLabel);
    const roleStyle = ROLE_COLORS[role] || ROLE_COLORS.C;

    ctx.save();
    const kitGradient = ctx.createLinearGradient(x, y, x + width, y + height);
    kitGradient.addColorStop(0, "rgba(151, 92, 246, .96)");
    kitGradient.addColorStop(1, "rgba(92, 45, 167, .96)");

    fillRounded(
      ctx,
      x,
      y,
      width,
      height,
      22,
      selected ? kitGradient : "rgba(9,57,43,.37)",
      selected ? "rgba(255,255,255,.72)" : "rgba(242,255,248,.52)",
      2
    );

    ctx.fillStyle = selected ? kitGradient : "rgba(9,57,43,.37)";
    fillRounded(ctx, x - 12, y + 20, 24, 45, 11, ctx.fillStyle);
    fillRounded(ctx, x + width - 12, y + 20, 24, 45, 11, ctx.fillStyle);

    const centerX = x + width / 2;
    fillRounded(ctx, centerX - 16, y + 10, 32, 22, 11, roleStyle.fill);
    centeredText(ctx, role, centerX, y + 21, { size: 14, weight: 900, color: roleStyle.ink });

    const portraitSize = 50;
    const portraitX = centerX - portraitSize / 2;
    const portraitY = y + 40;
    fillRounded(
      ctx,
      portraitX - 2,
      portraitY - 2,
      portraitSize + 4,
      portraitSize + 4,
      (portraitSize + 4) / 2,
      "rgba(255,255,255,.94)",
      "rgba(255,255,255,.86)",
      2
    );
    if (photo) {
      drawCoverImage(ctx, photo, portraitX, portraitY, portraitSize);
    } else {
      fillRounded(ctx, portraitX, portraitY, portraitSize, portraitSize, portraitSize / 2, "rgba(215,228,222,.58)");
      centeredText(ctx, "—", centerX, portraitY + portraitSize / 2, {
        size: 18,
        weight: 850,
        color: selected ? "rgba(23,61,50,.62)" : "rgba(255,255,255,.64)"
      });
    }

    const name = selected ? player.n || "Giocatore" : "Scegli";
    const team = selected ? player.t || "" : "";
    const nameSize = fitFont(ctx, name, width - 18, 19, 11, 850);
    font(ctx, 850, nameSize);
    const nameLines = wrapWords(ctx, name, width - 16, 2);
    const lineHeight = nameSize * 1.04;
    const nameCenterY = y + 111;
    const nameStart = nameCenterY - ((nameLines.length - 1) * lineHeight) / 2;

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    nameLines.forEach((line, index) => ctx.fillText(line, centerX, nameStart + index * lineHeight));

    if (team) {
      const lastNameY = nameStart + (nameLines.length - 1) * lineHeight;
      const teamY = Math.min(y + height - 11, lastNameY + lineHeight / 2 + 8);
      const teamSize = fitFont(ctx, team, width - 16, 13, 9, 650);
      font(ctx, 650, teamSize);
      ctx.fillStyle = "rgba(255,255,255,.78)";
      ctx.fillText(team, centerX, teamY);
    }
    ctx.restore();
  }

  function drawStarterRows(ctx, model, photos) {
    const byRole = { P: [], D: [], C: [], A: [] };
    model.definitions.starter.forEach((definition) => {
      byRole[definition.role].push({
        role: definition.role,
        player: model.slots.starter[definition.id]?.player || null
      });
    });

    const rows = [
      { role: "A", y: PITCH.y + 132 },
      { role: "C", y: PITCH.y + 357 },
      { role: "D", y: PITCH.y + 590 },
      { role: "P", y: PITCH.y + 810 }
    ];

    rows.forEach(({ role, y }) => {
      const entries = byRole[role];
      if (!entries.length) return;

      const gap = 22;
      const maxWidth = 164;
      const available = PITCH.width - 122;
      const width = Math.min(maxWidth, Math.floor((available - gap * (entries.length - 1)) / entries.length));
      const height = 158;
      const rowWidth = entries.length * width + (entries.length - 1) * gap;
      let x = PITCH.x + (PITCH.width - rowWidth) / 2;

      entries.forEach((entry) => {
        drawShirt(ctx, { x, y, width, height, player: entry.player, role, photo: playerPhoto(photos, entry.player) });
        x += width + gap;
      });
    });
  }

  function drawBenchCard(ctx, { x, y, width, height, role, player, photo = null, crest = null }) {
    const active = Boolean(player?.n);
    const roleStyle = ROLE_COLORS[role] || ROLE_COLORS.C;
    fillRounded(ctx, x, y, width, height, 13, active ? "rgba(255,255,255,.95)" : "rgba(209,225,218,.28)", "rgba(255,255,255,.22)", 1);

    fillRounded(ctx, x + 11, y + (height - 26) / 2, 30, 26, 13, roleStyle.fill);
    centeredText(ctx, role, x + 26, y + height / 2, { size: 13, weight: 900, color: roleStyle.ink });

    const portraitSize = height - 16;
    const portraitX = x + 47;
    const portraitY = y + 8;
    fillRounded(ctx, portraitX, portraitY, portraitSize, portraitSize, portraitSize / 2, "#edf3f0");
    if (player?.isTeamLabel && crest) {
      drawCrest(ctx, crest, portraitX + 2, portraitY + 2, portraitSize - 4);
    } else if (photo && !player?.isTeamLabel) {
      drawCoverImage(ctx, photo, portraitX + 2, portraitY + 2, portraitSize - 4);
    } else {
      centeredText(ctx, "—", portraitX + portraitSize / 2, y + height / 2, {
        size: 14,
        weight: 800,
        color: "rgba(23,61,50,.48)"
      });
    }

    const textX = portraitX + portraitSize + 10;
    const name = player?.n || "—";
    const max = width - (textX - x) - 12;
    const size = fitFont(ctx, name, max, 17, 10, 800);
    font(ctx, 800, size);
    ctx.fillStyle = active ? "#173d32" : "rgba(23,61,50,.55)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name, textX, y + height / 2 - (player?.t && !player.isTeamLabel ? 6 : 0));

    if (player?.t && !player.isTeamLabel) {
      const teamSize = fitFont(ctx, player.t, max, 12, 8, 650);
      font(ctx, 650, teamSize);
      ctx.fillStyle = "#71877e";
      ctx.fillText(player.t, textX, y + height / 2 + 8);
    }
  }

  function drawBench(ctx, model, photos) {
    const titleY = 1462;
    centeredText(ctx, "PANCHINA", WIDTH / 2, titleY, { size: 20, weight: 900, color: "rgba(237,255,246,.76)" });

    const keeperDefs = model.definitions.bench.filter((definition) => definition.role === "P");
    const keepers = keeperDefs.map((definition) => window.FormationModel.getBenchDisplayEntry(model, definition)?.player || null);
    const keeperWidth = 310;
    const keeperHeight = 58;
    const keeperGap = 18;
    const keeperX = (WIDTH - (keeperWidth * 2 + keeperGap)) / 2;
    keepers.forEach((player, index) => {
      drawBenchCard(ctx, {
        x: keeperX + index * (keeperWidth + keeperGap),
        y: 1494,
        width: keeperWidth,
        height: keeperHeight,
        role: "P",
        player,
        photo: playerPhoto(photos, player),
        crest: player?.isTeamLabel ? crestPhoto(photos, player.n) : null
      });
    });

    const columns = ["D", "C", "A"];
    const cardWidth = 265;
    const cardHeight = 54;
    const colGap = 24;
    const startX = (WIDTH - (cardWidth * 3 + colGap * 2)) / 2;

    columns.forEach((role, columnIndex) => {
      const definitions = model.definitions.bench.filter((definition) => definition.role === role);
      definitions.forEach((definition, rowIndex) => {
        const player = window.FormationModel.getBenchDisplayEntry(model, definition)?.player || null;
        drawBenchCard(ctx, {
          x: startX + columnIndex * (cardWidth + colGap),
          y: 1572 + rowIndex * 63,
          width: cardWidth,
          height: cardHeight,
          role,
          player,
          photo: playerPhoto(photos, player)
        });
      });
    });
  }

  function drawSwitch(ctx, pair) {
    if (!pair) return;
    const y = 1370;
    fillRounded(ctx, 130, y, 820, 66, 26, "rgba(255,255,255,.09)", "rgba(255,255,255,.16)", 1);
    const type = pair.type === "plus" ? "SWITCH PLUS" : "SWITCH BASE";
    centeredText(ctx, type, WIDTH / 2, y + 17, { size: 15, weight: 900, color: "rgba(223,255,237,.76)" });
    centeredText(ctx, `${pair.starter.n}  ↔  ${pair.bench.n}`, WIDTH / 2, y + 44, { size: 19, weight: 850, color: "#ffffff", maxWidth: 760 });
  }

  function drawHeader(ctx, model) {
    const league = leagueConfig();
    const accent = league.theme?.primaryLight || "#a855f7";
    const headingGradient = ctx.createLinearGradient(0, 0, WIDTH, 220);
    headingGradient.addColorStop(0, "#121d19");
    headingGradient.addColorStop(1, "#1a2521");
    fillRounded(ctx, 40, 38, WIDTH - 80, 230, 38, headingGradient, "rgba(255,255,255,.10)", 1);

    font(ctx, 850, 19);
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LINEUP FANTA", WIDTH / 2, 86);

    centeredText(ctx, league.name || league.label || "Lineup Fanta", WIDTH / 2, 132, {
      size: 44,
      weight: 900,
      color: "#ffffff",
      maxWidth: 880
    });

    centeredText(ctx, "FORMAZIONE", WIDTH / 2, 177, {
      size: 20,
      weight: 850,
      color: "rgba(232,255,242,.70)"
    });

    fillRounded(ctx, 82, 210, 916, 58, 24, "rgba(255,255,255,.08)");
    centeredText(ctx, `${model.manager.toUpperCase()}  ·  ${model.module}`, WIDTH / 2, 239, {
      size: 23,
      weight: 850,
      color: "#ffffff",
      maxWidth: 840
    });
  }

  function drawFooter(ctx) {
    const now = new Intl.DateTimeFormat("it-IT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());

    centeredText(ctx, "GENERATA CON LINEUP FANTA", WIDTH / 2, 1824, {
      size: 16,
      weight: 900,
      color: "rgba(229,255,240,.54)"
    });
    centeredText(ctx, now, WIDTH / 2, 1854, {
      size: 14,
      weight: 700,
      color: "rgba(229,255,240,.36)"
    });
  }

  async function renderCanvas(model) {
    const photos = await preloadPhotos(model);
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");

    const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    background.addColorStop(0, "#101714");
    background.addColorStop(.48, "#182622");
    background.addColorStop(1, "#0d1412");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "rgba(103, 194, 151, .08)";
    ctx.beginPath();
    ctx.arc(90, 120, 280, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(1000, 1730, 330, 0, Math.PI * 2);
    ctx.fill();

    drawHeader(ctx, model);
    drawPitch(ctx);
    drawStarterRows(ctx, model, photos);
    drawSwitch(ctx, model.switchPair);
    drawBench(ctx, model, photos);
    drawFooter(ctx);

    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Impossibile generare l'immagine"));
      }, "image/png");
    });
  }

  function safeFileName(model) {
    const league = String(leagueConfig().id || "lineup").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const manager = String(model.manager || "formazione").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return `${league}-${manager}-formazione.png`;
  }

  function setStoryModal(show) {
    const modal = document.getElementById("storyModal");
    if (!modal) return;
    modal.classList.toggle("show", show);
    modal.setAttribute("aria-hidden", String(!show));
    setModalOpen(show);
  }

  function updateStoryActions(ready) {
    ["saveStoryBtn", "copyStoryBtn"].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = !ready;
    });
  }

  async function open() {
    const model = storyModel();
    if (!model || !model.manager) {
      showToast("Seleziona una squadra prima", "error");
      return;
    }

    const outputModal = document.getElementById("outputModal");
    outputModal?.classList.remove("show");
    outputModal?.setAttribute("aria-hidden", "true");

    const preview = document.getElementById("storyPreviewImage");
    const status = document.getElementById("storyStatus");
    if (preview) preview.removeAttribute("src");
    if (status) status.textContent = "Creo la tua grafica…";
    updateStoryActions(false);
    setStoryModal(true);

    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const canvas = await renderCanvas(model);
      const blob = await canvasToBlob(canvas);

      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentBlob = blob;
      currentUrl = URL.createObjectURL(blob);
      currentFileName = safeFileName(model);

      if (preview) preview.src = currentUrl;
      if (status) status.textContent = "Anteprima pronta";
      updateStoryActions(true);
    } catch (error) {
      console.error("Story generation error:", error);
      if (status) status.textContent = "Non sono riuscito a generare la grafica";
      showToast("Errore nella generazione della grafica", "error");
    }
  }

  function close() {
    setStoryModal(false);
  }

  function storyFile() {
    return currentBlob ? new File([currentBlob], currentFileName, { type: "image/png" }) : null;
  }

  function isMobileStoryContext() {
    return window.matchMedia?.("(max-width: 767px)").matches ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
  }

  function isIOSStoryContext() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || "") ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function canShareFile(file) {
    if (!file || typeof navigator.share !== "function") return false;

    try {
      return typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });
    } catch (error) {
      return false;
    }
  }

  function download() {
    if (!currentBlob) return;
    const link = document.createElement("a");
    link.href = currentUrl || URL.createObjectURL(currentBlob);
    link.download = currentFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast(
      isMobileStoryContext()
        ? "Immagine salvata: la trovi in Galleria (album Download)"
        : "Immagine salvata: la trovi nella cartella Download",
      "success"
    );
  }

  async function invokeNativeShare() {
    const file = storyFile();
    if (!file || !canShareFile(file)) return false;

    try {
      await navigator.share({
        title: "Formazione Lineup Fanta",
        files: [file]
      });
      return true;
    } catch (error) {
      // An intentional close is handled and must not trigger a fallback download.
      if (error?.name === "AbortError") return true;
      console.warn("Native share failed", error);
      return false;
    }
  }

  async function save() {
    const file = storyFile();
    if (!file) {
      showToast("Attendi che l’anteprima sia pronta", "error");
      return;
    }

    // iPhone/iPad: il pannello nativo espone "Salva immagine" (→ Foto)
    if (isIOSStoryContext() && canShareFile(file)) {
      const shared = await invokeNativeShare();
      if (shared) return;
    }

    download();
  }

  async function copyImage() {
    if (!currentBlob) {
      showToast("Attendi che l’anteprima sia pronta", "error");
      return;
    }

    if (!window.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      showToast("Copia immagine richiede HTTPS e un browser compatibile", "error");
      return;
    }

    if (typeof ClipboardItem.supports === "function" && !ClipboardItem.supports("image/png")) {
      showToast("Questo browser non supporta la copia di immagini", "error");
      return;
    }

    const candidates = [
      () => new ClipboardItem({ "image/png": currentBlob }),
      () => new ClipboardItem({ "image/png": Promise.resolve(currentBlob) })
    ];

    for (const makeItem of candidates) {
      try {
        await navigator.clipboard.write([makeItem()]);
        showToast("Immagine copiata", "success");
        return;
      } catch (error) {
        console.warn("Clipboard image attempt failed", error);
      }
    }

    showToast("Copia immagine non disponibile: usa Salva", "error");
  }

  function bind() {
    document.getElementById("openStoryBtn")?.addEventListener("click", () => {
      open();
    });
    document.getElementById("closeStoryBtn")?.addEventListener("click", close);
    document.getElementById("saveStoryBtn")?.addEventListener("click", save);
    document.getElementById("copyStoryBtn")?.addEventListener("click", copyImage);

    const hint = document.getElementById("storyHint");
    if (hint) hint.hidden = !isIOSStoryContext();

    document.getElementById("storyModal")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) close();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }

  bind();

  return Object.freeze({ open, close });
})();
