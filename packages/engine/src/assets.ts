import { Assets, Spritesheet, Texture } from 'pixi.js';

/** Loads a packed atlas (Pixi spritesheet JSON + PNG) and returns a lookup by frame name. */
/**
 * `version` is appended to the atlas JSON *and* to the image it names. Both files keep stable
 * filenames across builds, unlike the hashed bundle, so without it a browser happily serves a cached
 * atlas from a previous build and the art silently does not change — which looks exactly like a build
 * or server problem and wastes an afternoon proving it is not.
 */
export async function loadAtlas(url: string, version?: string): Promise<(frame: string) => Texture> {
  if (!version) {
    const sheetOnly = await Assets.load<Spritesheet>(url);
    return frameLookup(sheetOnly);
  }
  const bust = (u: string) => `${u}${u.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
  const data = (await fetch(bust(url)).then((r) => r.json())) as { meta?: { image?: string } };
  if (data.meta?.image) data.meta.image = bust(new URL(data.meta.image, url).href);
  const sheet = await Assets.load<Spritesheet>({ src: bust(url), data });
  return frameLookup(sheet);
}

function frameLookup(sheet: Spritesheet): (frame: string) => Texture {
  return (frame: string) => {
    const texture = sheet.textures[frame];
    if (!texture) throw new Error(`Missing atlas frame: ${frame}`);
    return texture;
  };
}

/** Waits for web fonts so Pixi Text measures with the real faces. Never rejects. */
/** A family name loads its regular weight; `{ family, weights }` loads each listed weight, which a face used only at 800 needs. */
export type FontRequest = string | { family: string; weights: number[] };

export async function loadFonts(families: FontRequest[], timeoutMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const specs = families.flatMap((f) => (typeof f === 'string' ? [`32px "${f}"`] : f.weights.map((w) => `${w} 32px "${f.family}"`)));
  const loads = specs.map((spec) => document.fonts.load(spec).catch(() => []));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, timeoutMs))]);
}
