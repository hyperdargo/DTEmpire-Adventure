/**
 * Arcade client — quality tiers.
 * Mirrors the web app's graphicsQuality setting (low | medium | high) but drives
 * the canvas renderer instead of CSS: particle budgets, lighting, shadows, FPS cap.
 */
export type Quality = "low" | "medium" | "high";

export interface QualityProfile {
  /** Max device pixel ratio used for the backing store. */
  dpr: number;
  /** Simultaneous particles allowed on screen. */
  particles: number;
  /** Radial light gradients (torches, forge glow, spell light). */
  lighting: boolean;
  /** Soft drop shadows under actors. */
  shadows: boolean;
  /** Parallax background layers to draw. */
  layers: number;
  /** Screen shake on heavy hits. */
  shake: boolean;
  /** Animated ambient weather (embers, dust, rain). */
  weather: boolean;
  /** Target frame budget in ms (16.6 = 60fps, 33.3 = 30fps). */
  frameMs: number;
}

export const PROFILES: Record<Quality, QualityProfile> = {
  low: { dpr: 1, particles: 0, lighting: false, shadows: false, layers: 1, shake: false, weather: false, frameMs: 33.3 },
  medium: { dpr: 1.5, particles: 90, lighting: false, shadows: true, layers: 2, shake: true, weather: true, frameMs: 16.6 },
  high: { dpr: 2, particles: 320, lighting: true, shadows: true, layers: 4, shake: true, weather: true, frameMs: 16.6 },
};

const KEY = "dtempire.graphics";

export function loadQuality(): Quality {
  const v = localStorage.getItem(KEY);
  if (v === "low" || v === "medium" || v === "high") return v;
  // Auto-detect on first run: low-core / small-memory devices start on medium.
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return cores <= 4 || mem <= 3 ? "medium" : "high";
}

export function saveQuality(q: Quality): void {
  localStorage.setItem(KEY, q);
}

export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function profile(q: Quality): QualityProfile {
  const p = { ...PROFILES[q] };
  if (reducedMotion()) {
    p.shake = false;
    p.weather = false;
    p.particles = Math.min(p.particles, 24);
  }
  return p;
}
