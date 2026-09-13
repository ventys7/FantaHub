import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareLogo } from "./logoUpload";

const file = new File(["logo"], "logo.png", { type: "image/png" });

function bitmap(width: number, height: number) {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("prepareLogo", () => {
  it.each([
    [0, 100],
    [100, 0],
    [-1, 100],
    [100, -1],
    [8193, 100],
    [100, 8193],
    [5000, 5000]
  ])("rifiuta dimensioni %sx%s prima di creare canvas", async (width, height) => {
    const decoded = bitmap(width, height);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(decoded));
    const createElement = vi.spyOn(document, "createElement");

    await expect(prepareLogo(file)).rejects.toThrow(/dimensioni/i);
    expect(createElement).not.toHaveBeenCalledWith("canvas");
    expect(decoded.close).toHaveBeenCalledOnce();
  });

  it("mantiene l'output PNG 256x256 per dimensioni valide", async () => {
    const decoded = bitmap(100, 80);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(decoded));
    const sourceContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(100 * 80 * 4) }))
    };
    const outputContext = { clearRect: vi.fn(), drawImage: vi.fn() };
    const source = { width: 0, height: 0, getContext: vi.fn(() => sourceContext) };
    const output = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => outputContext),
      toDataURL: vi.fn(() => "data:image/png;base64,cG5n")
    };
    vi.spyOn(document, "createElement")
      .mockReturnValueOnce(source as unknown as HTMLCanvasElement)
      .mockReturnValueOnce(output as unknown as HTMLCanvasElement);

    await expect(prepareLogo(file)).resolves.toEqual({
      mimeType: "image/png",
      dataBase64: "cG5n",
      previewUrl: "data:image/png;base64,cG5n"
    });
    expect(output).toMatchObject({ width: 256, height: 256 });
    expect(decoded.close).toHaveBeenCalledOnce();
  });
});
