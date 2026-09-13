export type PreparedLogo = { mimeType: string; dataBase64: string; previewUrl: string };

type Bounds = { x: number; y: number; width: number; height: number };

const MAX_DIMENSION = 8192;
const MAX_PIXELS = 20_000_000;

function findVisibleBounds(context: CanvasRenderingContext2D, width: number, height: number): Bounds {
  const { data } = context.getImageData(0, 0, width, height);
  const corner = [data[0], data[1], data[2], data[3]];
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha <= 12) continue;

      const distance = Math.abs(data[offset] - corner[0])
        + Math.abs(data[offset + 1] - corner[1])
        + Math.abs(data[offset + 2] - corner[2])
        + Math.abs(alpha - corner[3]);
      const cornerLooksTransparent = corner[3] <= 20;
      const visible = cornerLooksTransparent || distance > 34;
      if (!visible) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return { x: 0, y: 0, width, height };
  const rawWidth = maxX - minX + 1;
  const rawHeight = maxY - minY + 1;
  const padding = Math.max(2, Math.round(Math.max(rawWidth, rawHeight) * 0.035));
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  return {
    x,
    y,
    width: Math.min(width - x, rawWidth + padding * 2),
    height: Math.min(height - y, rawHeight + padding * 2)
  };
}

export async function prepareLogo(file: File): Promise<PreparedLogo> {
  if (!file.type.startsWith("image/")) throw new Error("Seleziona un file immagine.");
  if (file.size > 8 * 1024 * 1024) throw new Error("L'immagine originale è troppo pesante.");

  const bitmap = await createImageBitmap(file);
  try {
    if (
      bitmap.width <= 0 || bitmap.height <= 0 ||
      bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION ||
      bitmap.width * bitmap.height > MAX_PIXELS
    ) {
      throw new Error("L'immagine ha dimensioni non supportate.");
    }

    const source = document.createElement("canvas");
    source.width = bitmap.width;
    source.height = bitmap.height;
    const sourceContext = source.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) throw new Error("Impossibile elaborare l'immagine.");
    sourceContext.drawImage(bitmap, 0, 0);

    const bounds = findVisibleBounds(sourceContext, source.width, source.height);
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Impossibile elaborare l'immagine.");
    context.clearRect(0, 0, size, size);

    const scale = Math.max(size / bounds.width, size / bounds.height);
    const width = bounds.width * scale;
    const height = bounds.height * scale;
    context.drawImage(
      source,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      (size - width) / 2,
      (size - height) / 2,
      width,
      height
    );

    const dataUrl = canvas.toDataURL("image/png", 0.92);
    return { mimeType: "image/png", dataBase64: dataUrl.split(",")[1], previewUrl: dataUrl };
  } finally {
    bitmap.close();
  }
}

export type TeamIdentityUpdate = { logoUrl: string; displayName: string };

export async function uploadTeamLogo(leagueId: string, teamName: string, code: string, prepared: PreparedLogo | null, displayName?: string): Promise<TeamIdentityUpdate> {
  const response = await fetch("/api/team-logo", {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leagueId, teamName, code,
      ...(prepared ? { upload: { mimeType: prepared.mimeType, dataBase64: prepared.dataBase64 } } : {}),
      ...(displayName !== undefined ? { displayName } : {})
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  const update = { logoUrl: String(payload.logoUrl || ""), displayName: String(payload.displayName ?? "") };
  window.dispatchEvent(new CustomEvent("lineup:team-logo-updated", {
    detail: { leagueId, teamName, ...update }
  }));
  return update;
}
