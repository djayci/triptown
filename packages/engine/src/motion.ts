// Reduced-motion preference shared by all fx helpers.

type Listener = (reduced: boolean) => void;

let override: boolean | null = null;
const listeners = new Set<Listener>();
let query: MediaQueryList | null = null;

function mediaQuery(): MediaQueryList | null {
  if (query || typeof matchMedia !== 'function') return query;
  query = matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener?.('change', () => listeners.forEach((l) => l(prefersReducedMotion())));
  return query;
}

export function prefersReducedMotion(): boolean {
  if (override !== null) return override;
  return mediaQuery()?.matches ?? false;
}

/** Forces the flag (e.g. an in-game setting or tests). Pass null to follow the system again. */
export function setReducedMotionOverride(value: boolean | null) {
  override = value;
  listeners.forEach((l) => l(prefersReducedMotion()));
}

export function onReducedMotionChange(listener: Listener): () => void {
  mediaQuery();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
