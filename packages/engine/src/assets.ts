import { Assets, Spritesheet, Texture } from 'pixi.js';

/** Loads a packed atlas (Pixi spritesheet JSON + PNG) and returns a lookup by frame name. */
export async function loadAtlas(url: string): Promise<(frame: string) => Texture> {
  const sheet = await Assets.load<Spritesheet>(url);
  return (frame: string) => {
    const texture = sheet.textures[frame];
    if (!texture) throw new Error(`Missing atlas frame: ${frame}`);
    return texture;
  };
}

/** Waits for web fonts so Pixi Text measures with the real faces. Never rejects. */
export async function loadFonts(families: string[], timeoutMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const loads = families.map((f) => document.fonts.load(`32px "${f}"`).catch(() => []));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, timeoutMs))]);
}
