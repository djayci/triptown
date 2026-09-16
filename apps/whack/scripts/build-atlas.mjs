// Rasterizes art/art.mjs at 2x and packs everything into one Pixi spritesheet.
// Output: public/assets/atlas.png + public/assets/atlas.json (committed).
import { Resvg } from '@resvg/resvg-js';
import { MaxRectsPacker } from 'maxrects-packer';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SPRITES } from '../art/art.mjs';

const SCALE = 2;
const PADDING = 4;
const OUT = 'public/assets';

const images = Object.entries(SPRITES).map(([name, svg]) => {
  const w = Number(/width="(\d+)"/.exec(svg)[1]);
  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: w * SCALE } }).render();
  const png = PNG.sync.read(rendered.asPng());
  return { name, png, width: png.width, height: png.height };
});

const packer = new MaxRectsPacker(2048, 2048, PADDING, { smart: true, pot: true, square: false, allowRotation: false });
packer.addArray(images.map((img) => ({ width: img.width, height: img.height, data: img })));
if (packer.bins.length !== 1) throw new Error(`Atlas overflow: ${packer.bins.length} bins`);
const bin = packer.bins[0];

const sheet = new PNG({ width: bin.width, height: bin.height });
const frames = {};
for (const rect of bin.rects) {
  const img = rect.data;
  PNG.bitblt(img.png, sheet, 0, 0, img.width, img.height, rect.x, rect.y);
  frames[img.name] = {
    frame: { x: rect.x, y: rect.y, w: img.width, h: img.height },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: img.width, h: img.height },
    sourceSize: { w: img.width, h: img.height },
  };
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/atlas.png`, PNG.sync.write(sheet));
writeFileSync(
  `${OUT}/atlas.json`,
  JSON.stringify({ frames, meta: { image: 'atlas.png', format: 'RGBA8888', size: { w: bin.width, h: bin.height }, scale: String(SCALE) } }, null, 1),
);
console.info(`atlas ${bin.width}x${bin.height}, ${images.length} frames`);
