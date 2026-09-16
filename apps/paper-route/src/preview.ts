// Dev-only scene preview (not part of the production build): renders a fixed frame or a scripted ride.
import { Courier } from './scene/courier';
import { Street } from './scene/street';
import { createWorld, type QualityTier } from './scene/world';

const q = new URLSearchParams(location.search);
const container = document.getElementById('scene')!;
// Fixed frame size so headless captures match the 390×844 concept frames regardless of window chrome.
container.style.cssText = `position:fixed;left:0;top:0;width:${q.get('w') ?? 390}px;height:${q.get('h') ?? 844}px`;
const world = createWorld(container, (q.get('tier') as QualityTier | null) ?? 'high');
const street = new Street();
const courier = new Courier();
world.scene.add(street.group, courier.group);
courier.setRolls(Number(q.get('rolls') ?? 3));
courier.setPose(q.get('state') === 'wipeout' ? 'fallen' : 'ride');

const rideSeconds = Number(q.get('ride') ?? 0);
const report = { frames: 0, maxCalls: 0, geometries: [] as number[], houseStarts: [] as number[] };
// Count every pass of the composer, not just the last one.
world.renderer.info.autoReset = false;
(window as unknown as { __preview: typeof report }).__preview = report;

let distance = Number(q.get('distance') ?? 30);
const step = 1 / 60;
function frame() {
  street.update(distance, world.settings.drawDistance);
  courier.update(step, 12);
  world.renderer.info.reset();
  world.render();
  report.frames++;
  report.maxCalls = Math.max(report.maxCalls, world.renderer.info.render.calls);
  if (report.frames % 300 === 0) report.geometries.push(world.renderer.info.memory.geometries);
}

if (rideSeconds > 0) {
  // Scripted ride at 20 m/s, stepped deterministically so headless runs are repeatable.
  for (let t = 0; t < rideSeconds; t += step) {
    distance += 20 * step;
    frame();
  }
  report.houseStarts = street.houseStarts(1);
} else {
  frame();
}
const starts = report.houseStarts;
const gaps = starts.slice(1).map((v, i) => +(v - starts[i]!).toFixed(1));
document.title = `done calls=${report.maxCalls} frames=${report.frames} geos=${report.geometries.join(',')} gaps=${gaps.slice(0, 12).join(',')}`;
