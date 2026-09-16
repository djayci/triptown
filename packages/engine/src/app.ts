import { Application, type ApplicationOptions } from 'pixi.js';

export interface Viewport {
  width: number;
  height: number;
  portrait: boolean;
  resolution: number;
}

export interface GameApp {
  app: Application;
  viewport(): Viewport;
  onResize(listener: (v: Viewport) => void): () => void;
  /** Fires when the page or webview is hidden/shown. The ticker is already paused/resumed. */
  onVisibility(listener: (visible: boolean) => void): () => void;
  destroy(): void;
}

export const MAX_RESOLUTION = 2;

export function cappedResolution(devicePixelRatio: number): number {
  return Math.max(1, Math.min(MAX_RESOLUTION, devicePixelRatio || 1));
}

/**
 * Boots a Pixi application that fills `parent`, renders at DPR capped to 2 for crisp but
 * affordable output, and pauses its ticker while the page is hidden.
 */
export async function createGameApp(
  parent: HTMLElement,
  options: Partial<ApplicationOptions> = {},
): Promise<GameApp> {
  const app = new Application();
  const resolution = cappedResolution(window.devicePixelRatio);
  await app.init({
    resizeTo: parent,
    resolution,
    autoDensity: true,
    antialias: true,
    background: '#ffd43b',
    preference: 'webgl',
    ...options,
  });
  parent.appendChild(app.canvas);

  const resizeListeners = new Set<(v: Viewport) => void>();
  const visibilityListeners = new Set<(visible: boolean) => void>();

  const viewport = (): Viewport => {
    const width = app.screen.width;
    const height = app.screen.height;
    return { width, height, portrait: height >= width, resolution: app.renderer.resolution };
  };

  let lastW = -1;
  let lastH = -1;
  const checkResize = () => {
    // Pixi's resizeTo updates the screen on window resize; notify once per real change.
    const dpr = cappedResolution(window.devicePixelRatio);
    if (app.renderer.resolution !== dpr) app.renderer.resolution = dpr;
    const v = viewport();
    if (v.width === lastW && v.height === lastH) return;
    lastW = v.width;
    lastH = v.height;
    resizeListeners.forEach((l) => l(v));
  };
  app.renderer.on('resize', checkResize);
  const observer = new ResizeObserver(() => {
    app.resize();
    checkResize();
  });
  observer.observe(parent);

  const onVisibilityChange = () => {
    const visible = document.visibilityState === 'visible';
    if (visible) app.ticker.start();
    else app.ticker.stop();
    visibilityListeners.forEach((l) => l(visible));
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  return {
    app,
    viewport,
    onResize(listener) {
      resizeListeners.add(listener);
      listener(viewport());
      return () => resizeListeners.delete(listener);
    },
    onVisibility(listener) {
      visibilityListeners.add(listener);
      return () => visibilityListeners.delete(listener);
    },
    destroy() {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      app.destroy(true, { children: true });
    },
  };
}
