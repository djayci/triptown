import gsap from 'gsap';
import type { Container } from 'pixi.js';
import { prefersReducedMotion } from './motion';

export { gsap };

/** Scale pop used for chips, buttons and stickers. */
export function pop(target: Container, amount = 1.12, duration = 0.18): gsap.core.Timeline {
  const base = target.scale.x;
  return gsap
    .timeline()
    .to(target.scale, { x: base * amount, y: base * amount, duration: duration / 2, ease: 'power2.out' })
    .to(target.scale, { x: base, y: base, duration: duration / 2, ease: 'back.out(3)' });
}

/** Screen shake. Skipped entirely under reduced motion. */
export function shake(target: Container, intensity = 10, duration = 0.35): gsap.core.Timeline | null {
  if (prefersReducedMotion()) return null;
  const { x, y } = target.position;
  const tl = gsap.timeline({ onComplete: () => target.position.set(x, y) });
  const steps = Math.max(4, Math.round(duration / 0.04));
  for (let i = 0; i < steps; i++) {
    const falloff = 1 - i / steps;
    tl.to(target.position, {
      x: x + (Math.random() * 2 - 1) * intensity * falloff,
      y: y + (Math.random() * 2 - 1) * intensity * falloff,
      duration: duration / steps,
      ease: 'none',
    });
  }
  return tl;
}

/** Brief tilt used for impact moments. Skipped under reduced motion. */
export function tilt(target: Container, degrees = -1.5, duration = 0.5): gsap.core.Timeline | null {
  if (prefersReducedMotion()) return null;
  return gsap
    .timeline()
    .to(target, { rotation: (degrees * Math.PI) / 180, duration: duration * 0.2, ease: 'power3.out' })
    .to(target, { rotation: 0, duration: duration * 0.8, ease: 'elastic.out(1, 0.4)' });
}

export function killTweens(target: object) {
  gsap.killTweensOf(target);
}
