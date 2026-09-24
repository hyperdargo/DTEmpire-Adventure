/**
 * Particle + effect system for the arcade client.
 *
 * Pooled fixed-size arrays — no per-frame allocation, so the GC never stutters
 * mid-battle. The pool size comes from the quality profile (low = 0 particles,
 * the system then becomes a no-op).
 */

export type FxKind = "spark" | "ember" | "blood" | "dust" | "magic" | "heal" | "shard";

interface Particle {
  alive: boolean;
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  gravity: number;
  kind: FxKind;
}

export interface Floater {
  alive: boolean;
  x: number; y: number;
  vy: number;
  life: number; maxLife: number;
  text: string;
  color: string;
  size: number;
  crit: boolean;
}

interface Slash {
  alive: boolean;
  x: number; y: number;
  life: number; maxLife: number;
  angle: number;
  radius: number;
  color: string;
  facing: number;
}

const COLORS: Record<FxKind, string[]> = {
  spark: ["#ffe9a8", "#ffc85a", "#fff4d0"],
  ember: ["#ff8a32", "#ff5a1a", "#ffb45a"],
  blood: ["#b4342a", "#8a1e1a", "#d84a3a"],
  dust: ["#6a5f52", "#4a4038", "#8a7a68"],
  magic: ["#6fd8e8", "#a87cff", "#c8f0ff"],
  heal: ["#7fe8a8", "#b8ffd0", "#4ac87c"],
  shard: ["#c8ccd4", "#8a909a", "#eef2f8"],
};

export class Fx {
  private pool: Particle[] = [];
  private floaters: Floater[] = [];
  private slashes: Slash[] = [];
  private shake = 0;
  private shakeDecay = 4;
  private flashAlpha = 0;
  private flashColor = "#fff";
  budget: number;

  constructor(budget: number) {
    this.budget = budget;
    this.resize(budget);
    for (let i = 0; i < 24; i++) {
      this.floaters.push({ alive: false, x: 0, y: 0, vy: 0, life: 0, maxLife: 0, text: "", color: "#fff", size: 20, crit: false });
    }
    for (let i = 0; i < 8; i++) {
      this.slashes.push({ alive: false, x: 0, y: 0, life: 0, maxLife: 0, angle: 0, radius: 0, color: "#fff", facing: 1 });
    }
  }

  /** Re-size the pool when the player changes graphics tier at runtime. */
  resize(budget: number): void {
    this.budget = budget;
    this.pool.length = 0;
    for (let i = 0; i < budget; i++) {
      this.pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 1, color: "#fff", gravity: 0, kind: "spark" });
    }
  }

  private take(): Particle | null {
    for (let i = 0; i < this.pool.length; i++) {
      const c = this.pool[i];
      if (c && !c.alive) return c;
    }
    return null;
  }

  burst(x: number, y: number, kind: FxKind, count: number, spread = Math.PI * 2, dir = 0, speed = 180): void {
    if (this.budget === 0) return;
    const palette = COLORS[kind];
    for (let i = 0; i < count; i++) {
      const p = this.take();
      if (!p) return;
      const a = dir + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.9);
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.maxLife = p.life = 0.35 + Math.random() * 0.65;
      p.size = kind === "ember" ? 1.5 + Math.random() * 2.5 : 2 + Math.random() * 3.5;
      p.color = palette[(Math.random() * palette.length) | 0] ?? "#ffffff";
      p.gravity = kind === "magic" || kind === "heal" ? -60 : 520;
      p.kind = kind;
    }
  }

  /** Continuous ambient emitter (forge embers, cave motes). */
  ambient(x: number, y: number, kind: FxKind, dt: number, rate: number, spreadX: number): void {
    if (this.budget === 0) return;
    if (Math.random() > rate * dt) return;
    const p = this.take();
    if (!p) return;
    const palette = COLORS[kind];
    p.alive = true;
    p.x = x + (Math.random() - 0.5) * spreadX;
    p.y = y;
    p.vx = (Math.random() - 0.5) * 24;
    p.vy = -20 - Math.random() * 40;
    p.maxLife = p.life = 1.6 + Math.random() * 2.2;
    p.size = 1 + Math.random() * 2;
    p.color = palette[(Math.random() * palette.length) | 0] ?? "#ffffff";
    p.gravity = -12;
    p.kind = kind;
  }

  floater(x: number, y: number, text: string, color: string, crit = false): void {
    const f = this.floaters.find((v) => !v.alive);
    if (!f) return;
    f.alive = true;
    f.x = x + (Math.random() - 0.5) * 24;
    f.y = y;
    f.vy = crit ? -130 : -96;
    f.maxLife = f.life = crit ? 1.25 : 1;
    f.text = text;
    f.color = color;
    f.size = crit ? 34 : 24;
    f.crit = crit;
  }

  slash(x: number, y: number, facing: number, color = "#fff4d0", radius = 64): void {
    const s = this.slashes.find((v) => !v.alive);
    if (!s) return;
    s.alive = true;
    s.x = x;
    s.y = y;
    s.maxLife = s.life = 0.26;
    s.angle = -0.9;
    s.radius = radius;
    s.color = color;
    s.facing = facing;
  }

  impact(strength: number): void {
    this.shake = Math.min(this.shake + strength, 26);
  }

  flash(color: string, alpha: number): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const f of this.floaters) {
      if (!f.alive) continue;
      f.life -= dt;
      if (f.life <= 0) { f.alive = false; continue; }
      f.y += f.vy * dt;
      f.vy += 150 * dt;
    }
    for (const s of this.slashes) {
      if (!s.alive) continue;
      s.life -= dt;
      if (s.life <= 0) s.alive = false;
    }
    this.shake = Math.max(0, this.shake - this.shakeDecay * dt * 14);
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 3.2);
  }

  /** Camera offset for the current shake amplitude. */
  shakeOffset(enabled: boolean): { x: number; y: number } {
    if (!enabled || this.shake <= 0) return { x: 0, y: 0 };
    return { x: (Math.random() - 0.5) * this.shake, y: (Math.random() - 0.5) * this.shake };
  }

  drawParticles(ctx: CanvasRenderingContext2D, glow: boolean): void {
    if (glow) ctx.globalCompositeOperation = "lighter";
    for (const p of this.pool) {
      if (!p.alive) continue;
      const k = p.life / p.maxLife;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      const s = p.size * (p.kind === "shard" ? k : 1);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  drawSlashes(ctx: CanvasRenderingContext2D): void {
    for (const s of this.slashes) {
      if (!s.alive) continue;
      const k = 1 - s.life / s.maxLife;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.facing, 1);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 7 * (1 - k * 0.6);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, s.angle + k * 1.5, s.angle + k * 1.5 + 1.5);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawFloaters(ctx: CanvasRenderingContext2D): void {
    for (const f of this.floaters) {
      if (!f.alive) continue;
      const k = f.life / f.maxLife;
      const pop = f.crit ? 1 + (1 - k) * 0.25 : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.8);
      ctx.translate(f.x, f.y);
      ctx.scale(pop, pop);
      ctx.font = `900 ${f.size}px "Segoe UI",system-ui,sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(0,0,0,.85)";
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawFlash(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.flashAlpha <= 0) return;
    ctx.globalAlpha = this.flashAlpha;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}
