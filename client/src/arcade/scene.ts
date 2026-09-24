/**
 * Parallax scene painter.
 *
 * Backgrounds are procedural (no image downloads): layered silhouettes with a
 * gradient sky, drifting fog and per-scene props. Layer count is driven by the
 * quality profile, so "low" draws a flat gradient and "high" draws 4 depths
 * plus lighting.
 */
import type { QualityProfile } from "./quality.ts";

export type SceneId = "town" | "forest" | "cave" | "tower" | "abyss" | "arena" | "smithy";

interface Theme {
  skyTop: string;
  skyBottom: string;
  far: string;
  mid: string;
  near: string;
  ground: string;
  fog: string;
  light: string | null;
}

const THEMES: Record<SceneId, Theme> = {
  town: { skyTop: "#131a26", skyBottom: "#2a2118", far: "#1b2130", mid: "#141a26", near: "#0e131c", ground: "#191410", fog: "rgba(216,180,90,.05)", light: "#ffb45a" },
  forest: { skyTop: "#0f1a14", skyBottom: "#1c2a1e", far: "#16241a", mid: "#101a12", near: "#0a120c", ground: "#121a10", fog: "rgba(150,220,160,.05)", light: "#8fe0a0" },
  cave: { skyTop: "#0a0d14", skyBottom: "#141020", far: "#151224", mid: "#0e0c18", near: "#08070e", ground: "#0d0b12", fog: "rgba(120,160,255,.05)", light: "#6fb4e8" },
  tower: { skyTop: "#0c0a18", skyBottom: "#221a30", far: "#1a1428", mid: "#120e1c", near: "#0a0812", ground: "#100c18", fog: "rgba(190,140,255,.06)", light: "#b47ce8" },
  abyss: { skyTop: "#0a0208", skyBottom: "#220a14", far: "#1a0810", mid: "#12050a", near: "#080205", ground: "#0e0408", fog: "rgba(255,70,70,.06)", light: "#ff5a4a" },
  arena: { skyTop: "#16120c", skyBottom: "#2e2418", far: "#221a12", mid: "#18120c", near: "#100c08", ground: "#1a1410", fog: "rgba(255,200,120,.05)", light: "#ffc878" },
  smithy: { skyTop: "#140c08", skyBottom: "#2c1608", far: "#20120a", mid: "#160c06", near: "#0d0704", ground: "#160e08", fog: "rgba(255,140,50,.07)", light: "#ff8a32" },
};

/** Deterministic hash → pseudo-random in [0,1). Keeps skylines stable per scene. */
function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneId,
  w: number,
  h: number,
  clock: number,
  q: QualityProfile,
): void {
  const th = THEMES[scene] ?? THEMES.town;
  const horizon = h * 0.72;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, th.skyTop);
  sky.addColorStop(1, th.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  // ground
  const gr = ctx.createLinearGradient(0, horizon, 0, h);
  gr.addColorStop(0, th.ground);
  gr.addColorStop(1, "#050505");
  ctx.fillStyle = gr;
  ctx.fillRect(0, horizon, w, h - horizon);

  if (q.layers >= 2) silhouette(ctx, scene, w, horizon, clock * 4, 0.55, th.far, 1);
  if (q.layers >= 3) silhouette(ctx, scene, w, horizon, clock * 9, 0.34, th.mid, 2);
  if (q.layers >= 4) silhouette(ctx, scene, w, horizon, clock * 16, 0.2, th.near, 3);

  // ground line + floor grid for depth
  ctx.strokeStyle = "rgba(255,255,255,.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ctx.stroke();

  if (q.layers >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = th.light ?? "#888";
    for (let i = 1; i <= 6; i++) {
      const y = horizon + Math.pow(i / 6, 2) * (h - horizon);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // scene lighting pass
  if (q.lighting && th.light) {
    const pulse = 0.82 + Math.sin(clock * 2.1) * 0.08;
    radial(ctx, w * 0.5, horizon - h * 0.12, h * 0.85 * pulse, th.light, 0.16);
    if (scene === "smithy") radial(ctx, w * 0.22, horizon - 40, 220, "#ff7a20", 0.3);
    if (scene === "abyss") radial(ctx, w * 0.5, h * 0.2, 260, "#ff2a2a", 0.18);
  }

  // drifting fog band
  if (q.weather) {
    ctx.save();
    ctx.fillStyle = th.fog;
    for (let i = 0; i < 3; i++) {
      const y = horizon - 30 - i * 26;
      const off = ((clock * (8 + i * 5)) % (w + 400)) - 200;
      ctx.beginPath();
      ctx.ellipse(off, y, 260, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(off - w * 0.6, y, 200, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // vignette anchors the frame like a real game camera
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.62)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, alpha));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Procedural parallax silhouettes — trees, rooftops, stalagmites, pillars. */
function silhouette(
  ctx: CanvasRenderingContext2D,
  scene: SceneId,
  w: number,
  horizon: number,
  scroll: number,
  scale: number,
  color: string,
  layer: number,
) {
  const span = 150 * scale + 60;
  const count = Math.ceil(w / span) + 2;
  const off = -((scroll * scale * 0.35) % span);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const x = off + i * span;
    const seed = i + layer * 37;
    const hgt = (70 + rnd(seed) * 120) * scale;
    switch (scene) {
      case "forest": {
        const tw = 16 * scale;
        ctx.moveTo(x - tw, horizon);
        ctx.lineTo(x, horizon - hgt);
        ctx.lineTo(x + tw, horizon);
        ctx.moveTo(x - tw * 1.4, horizon - hgt * 0.35);
        ctx.lineTo(x, horizon - hgt * 1.15);
        ctx.lineTo(x + tw * 1.4, horizon - hgt * 0.35);
        break;
      }
      case "cave":
      case "abyss": {
        ctx.moveTo(x - 30 * scale, horizon);
        ctx.lineTo(x, horizon - hgt);
        ctx.lineTo(x + 30 * scale, horizon);
        // ceiling spikes
        ctx.moveTo(x - 24 * scale, 0);
        ctx.lineTo(x, hgt * 0.7);
        ctx.lineTo(x + 24 * scale, 0);
        break;
      }
      case "tower": {
        const bw = 54 * scale;
        ctx.rect(x - bw / 2, horizon - hgt, bw, hgt);
        ctx.moveTo(x - bw * 0.7, horizon - hgt);
        ctx.lineTo(x, horizon - hgt - 26 * scale);
        ctx.lineTo(x + bw * 0.7, horizon - hgt);
        break;
      }
      case "arena": {
        const bw = 70 * scale;
        ctx.rect(x - bw / 2, horizon - hgt * 0.7, bw, hgt * 0.7);
        for (let a = 0; a < 3; a++) {
          ctx.rect(x - bw / 2 + 8 * scale + a * 20 * scale, horizon - hgt * 0.55, 10 * scale, 16 * scale);
        }
        break;
      }
      case "smithy": {
        const bw = 60 * scale;
        ctx.rect(x - bw / 2, horizon - hgt * 0.6, bw, hgt * 0.6);
        ctx.rect(x + bw * 0.1, horizon - hgt * 0.95, 12 * scale, hgt * 0.4); // chimney
        break;
      }
      default: {
        // town rooftops
        const bw = 88 * scale;
        const bh = hgt * 0.62;
        ctx.rect(x - bw / 2, horizon - bh, bw, bh);
        ctx.moveTo(x - bw * 0.6, horizon - bh);
        ctx.lineTo(x, horizon - bh - 30 * scale);
        ctx.lineTo(x + bw * 0.6, horizon - bh);
        break;
      }
    }
  }
  ctx.fill();

  // lit windows on the town / tower layers
  if ((scene === "town" || scene === "tower") && layer <= 2) {
    ctx.fillStyle = `rgba(255,184,90,${0.16 + layer * 0.06})`;
    for (let i = 0; i < count; i++) {
      const x = off + i * span;
      const seed = i + layer * 37;
      if (rnd(seed + 9) < 0.45) continue;
      const bh = (70 + rnd(seed) * 120) * scale * 0.62;
      ctx.fillRect(x - 10 * scale, horizon - bh + 14 * scale, 8 * scale, 10 * scale);
      ctx.fillRect(x + 4 * scale, horizon - bh + 32 * scale, 8 * scale, 10 * scale);
    }
  }
}

/** Map a game location/battle context onto a scene. */
export function sceneFor(key: string | undefined): SceneId {
  const k = (key ?? "").toLowerCase();
  if (/dungeon|cave|crypt|mine|cavern/.test(k)) return "cave";
  if (/tower|spire/.test(k)) return "tower";
  if (/abyss|void|hell/.test(k)) return "abyss";
  if (/arena|duel|pvp|rank/.test(k)) return "arena";
  if (/smith|forge|anvil/.test(k)) return "smithy";
  if (/forest|wood|grove|plain|field|adventure/.test(k)) return "forest";
  return "town";
}
