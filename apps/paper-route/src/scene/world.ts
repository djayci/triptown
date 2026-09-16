import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { PALETTE } from './palette';
import { COURIER_AHEAD, LANE_X } from './street';

export type QualityTier = 'high' | 'medium' | 'low';

export interface TierSettings {
  pixelRatio: number;
  shadowMap: number;
  drawDistance: number;
  /** Depth-of-field and haze pass; the first effect dropped when frames slow down (design D5). */
  depthPass: boolean;
  /** Metres of street dressed on the near side of the road; the low tier stops at the kerb. */
  nearSideDetail: boolean;
}

export function tierSettings(tier: QualityTier, dpr: number): TierSettings {
  switch (tier) {
    case 'high':
      return { pixelRatio: Math.min(dpr, 2), shadowMap: 2048, drawDistance: 150, depthPass: true, nearSideDetail: true };
    case 'medium':
      return { pixelRatio: Math.min(dpr, 1.5), shadowMap: 1024, drawDistance: 110, depthPass: false, nearSideDetail: true };
    case 'low':
      return { pixelRatio: 1, shadowMap: 0, drawDistance: 80, depthPass: false, nearSideDetail: false };
  }
}

/**
 * Depth treatment: a cross-shaped blur whose radius follows a vertical mask, so the band holding the
 * courier stays sharp while the far end of the street and the near foreground soften, plus a warm
 * haze toward the top of the frame. Screen-space and cheap; a real bokeh pass is not worth its cost
 * on a mid-range phone (design D5).
 */
/**
 * Blur weight of the depth pass at a vertical screen position (0 at the bottom, 1 at the top).
 * Mirrors the shader's mask so the bands can be checked without a GPU.
 */
export function depthBlurWeight(y: number, sharpFrom = DEPTH_SHARP_FROM, sharpTo = DEPTH_SHARP_TO): number {
  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };
  return Math.max(smoothstep(sharpFrom, 0, y), smoothstep(sharpTo, 1, y));
}

export const DEPTH_SHARP_FROM = 0.2;
export const DEPTH_SHARP_TO = 0.8;

export const DepthBandShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    texel: { value: new THREE.Vector2(1 / 390, 1 / 844) },
    sharpFrom: { value: DEPTH_SHARP_FROM },
    sharpTo: { value: DEPTH_SHARP_TO },
    strength: { value: 1.8 },
    haze: { value: new THREE.Color(PALETTE.haze) },
    hazeStrength: { value: 0.16 },
  },
  vertexShader: `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 texel; uniform float sharpFrom; uniform float sharpTo;
uniform float strength; uniform vec3 haze; uniform float hazeStrength;
varying vec2 vUv;
void main() {
  // 0 inside the sharp band, rising toward the top and bottom edges of the frame.
  float blur = max(smoothstep(sharpFrom, 0.0, vUv.y), smoothstep(sharpTo, 1.0, vUv.y));
  vec4 c = texture2D(tDiffuse, vUv);
  if (blur > 0.001) {
    float r = blur * strength;
    vec4 sum = c * 2.0;
    for (int i = 1; i <= 3; i++) {
      float o = float(i) * r;
      sum += texture2D(tDiffuse, vUv + vec2(texel.x * o, 0.0));
      sum += texture2D(tDiffuse, vUv - vec2(texel.x * o, 0.0));
      sum += texture2D(tDiffuse, vUv + vec2(0.0, texel.y * o));
      sum += texture2D(tDiffuse, vUv - vec2(0.0, texel.y * o));
    }
    c = sum / 14.0;
  }
  // Warm morning haze toward the far end of the street.
  c.rgb = mix(c.rgb, haze, hazeStrength * smoothstep(0.6, 1.0, vUv.y));
  gl_FragColor = c;
}`,
};

export interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  settings: TierSettings;
  /** Small screen-space offset for the setback shake; the camera angle itself never moves. */
  setShake(x: number, y: number): void;
  setDepthEffects(on: boolean): void;
  setTier(tier: QualityTier): void;
  resize(width: number, height: number): void;
  render(): void;
  dispose(): void;
}

/**
 * Camera rig for the Dawn Diorama view (design D1): orthographic, fixed offset, looking down on the
 * street from the near-left. The route runs along −Z, so it climbs to the upper left of the frame and
 * the houses on +X sit across the street in the upper right. The camera never rotates or zooms.
 */
export const CAMERA_OFFSET = new THREE.Vector3(-15, 38, 34);
/** Aim point relative to the courier, chosen so the courier sits above the HUD panel. */
export const CAMERA_TARGET = new THREE.Vector3(3.6, 0.9, -8.6);
/** Where the courier sits vertically in clip space: above the HUD panel at every frame shape. */
export const COURIER_SCREEN_Y = 0.16;
const COURIER_POINT = new THREE.Vector3(LANE_X, 1.1, -COURIER_AHEAD);
/** Width of the orthographic frustum in metres at portrait aspect. */
export const VIEW_WIDTH = 13;

/** Builds the round's camera for an aspect ratio. Exported so the projection can be unit tested. */
export function isoCamera(aspect: number): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  frameCamera(camera, aspect);
  return camera;
}

/** Sizes the frustum for an aspect and re-aims it; returns the aim point the camera now looks at. */
export function frameCamera(camera: THREE.OrthographicCamera, aspect: number): THREE.Vector3 {
  const w = VIEW_WIDTH / 2;
  const h = w / Math.max(aspect, 0.001);
  Object.assign(camera, { left: -w, right: w, top: h, bottom: -h });
  const target = CAMERA_TARGET.clone();
  const aim = () => {
    camera.position.copy(target).add(CAMERA_OFFSET);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
  };
  // Slide the aim point along the route until the courier sits at the same height on every frame
  // shape, so a short screen never hides them behind the HUD panel. The projection is linear, so one
  // measured step and one correction land it exactly.
  aim();
  const y0 = COURIER_POINT.clone().project(camera).y;
  target.z -= 1;
  aim();
  const perMetre = COURIER_POINT.clone().project(camera).y - y0;
  target.z += 1 - (COURIER_SCREEN_Y - y0) / (perMetre || 1);
  aim();
  return target;
}

export function createWorld(container: HTMLElement, tier: QualityTier): World {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.lawn);

  const camera = isoCamera(390 / 844);
  let aimPoint = frameCamera(camera, 390 / 844);

  // Fixed first-light key and fill. Nothing here follows the multiplier: lighting that tracked the
  // round would read as progress and as a tell (design D7).
  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.9));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.position.set(26, 22, 20).add(CAMERA_TARGET);
  sun.target.position.copy(CAMERA_TARGET);
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.02;
  // Fitted to what the orthographic frustum can see, not to the whole street.
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 30, bottom: -30, near: 1, far: 130 });
  scene.add(sun, sun.target);

  let settings = tierSettings(tier, window.devicePixelRatio || 1);
  let depthEffects = true;
  let composer: EffectComposer;
  let depthPass: ShaderPass | null = null;

  const depthOn = () => settings.depthPass && depthEffects;

  function buildComposer() {
    composer?.dispose();
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    depthPass = depthOn() ? new ShaderPass(DepthBandShader) : null;
    if (depthPass) composer.addPass(depthPass);
    composer.addPass(new OutputPass());
  }

  function applyTier() {
    renderer.setPixelRatio(settings.pixelRatio);
    renderer.shadowMap.enabled = settings.shadowMap > 0;
    sun.castShadow = settings.shadowMap > 0;
    if (settings.shadowMap > 0) {
      sun.shadow.mapSize.set(settings.shadowMap, settings.shadowMap);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    buildComposer();
    world.resize(container.clientWidth || 390, container.clientHeight || 844);
  }

  const world: World = {
    renderer,
    scene,
    camera,
    get settings() {
      return settings;
    },
    setShake(x, y) {
      camera.position.copy(aimPoint).add(CAMERA_OFFSET);
      camera.position.x += x;
      camera.position.y += y;
      camera.lookAt(aimPoint);
    },
    setDepthEffects(on) {
      if (on === depthEffects) return;
      depthEffects = on;
      buildComposer();
      world.resize(container.clientWidth || 390, container.clientHeight || 844);
    },
    setTier(next) {
      settings = tierSettings(next, window.devicePixelRatio || 1);
      applyTier();
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;
      aimPoint = frameCamera(camera, width / height);
      composer.setSize(width, height);
      depthPass?.uniforms.texel!.value.set(1 / (width * settings.pixelRatio), 1 / (height * settings.pixelRatio));
    },
    render() {
      composer.render();
    },
    dispose() {
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  applyTier();
  return world;
}
