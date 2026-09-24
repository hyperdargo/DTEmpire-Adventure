/**
 * Canvas HUD — health bars, portraits, turn banner, action buttons.
 * Drawn directly on the canvas so it scales with the render target and never
 * fights the DOM. Buttons expose hit-rects that main.ts tests against pointer
 * events, and the same rects back keyboard focus for accessibility.
 */
import { roundRect } from "./sprites.ts";
import type { Combatant } from "./api.ts";

export interface Rect { x: number; y: number; w: number; h: number }

export interface HudButton {
  id: string;
  label: string;
  hint: string;
  rect: Rect;
  enabled: boolean;
  tone: "attack" | "skill" | "guard" | "flee" | "auto";
}

const TONES: Record<HudButton["tone"], { bg: string; edge: string; text: string }> = {
  attack: { bg: "#d8b45a", edge: "#f0d890", text: "#14100a" },
  skill: { bg: "#3a4a7c", edge: "#7c9ce0", text: "#eaf0ff" },
  guard: { bg: "#2a3a30", edge: "#6fa88a", text: "#dff0e6" },
  flee: { bg: "#2a2020", edge: "#8a6a6a", text: "#f0dede" },
  auto: { bg: "#1e1e1e", edge: "#6a6a6a", text: "#e8e8e8" },
};

export function hit(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Animated health bar: `shown` lags `target` so damage "drains" visibly. */
export class Bar {
  shown: number;
  target: number;
  constructor(target: number) { this.target = target; this.shown = target; }
  set(v: number) { this.target = v; }
  update(dt: number) {
    const d = this.target - this.shown;
    if (Math.abs(d) < 0.0005) { this.shown = this.target; return; }
    this.shown += d * Math.min(1, dt * 6);
  }
}

export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  pct: number, lag: number, color: string, label: string, sub: string,
): void {
  ctx.save();
  // frame
  ctx.fillStyle = "rgba(6,6,6,.82)";
  roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 1;
  roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 5);
  ctx.stroke();

  // drain ghost
  ctx.fillStyle = "rgba(220,70,70,.55)";
  roundRect(ctx, x, y, w * Math.max(pct, lag), h, 3);
  ctx.fill();

  // live fill
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, color);
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w * pct, h, 3);
  ctx.fill();

  // gloss
  ctx.fillStyle = "rgba(255,255,255,.14)";
  roundRect(ctx, x, y, w * pct, h * 0.45, 3);
  ctx.fill();

  ctx.font = '700 13px "Segoe UI",system-ui,sans-serif';
  ctx.fillStyle = "#f0f0f0";
  ctx.textAlign = "left";
  ctx.fillText(label, x, y - 9);
  ctx.textAlign = "right";
  ctx.fillStyle = "#a8a8a8";
  ctx.font = '600 12px "Segoe UI",system-ui,sans-serif';
  ctx.fillText(sub, x + w, y - 9);
  ctx.restore();
}

export function drawPortrait(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, icon: string, c: Combatant, accent: string): void {
  ctx.save();
  ctx.fillStyle = "rgba(10,10,10,.9)";
  roundRect(ctx, x, y, size, size, 8);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, size, size, 8);
  ctx.stroke();
  ctx.font = `${size * 0.56}px "Segoe UI Emoji",system-ui,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon || "⚔️", x + size / 2, y + size / 2 + 1);
  // level pip
  ctx.fillStyle = accent;
  roundRect(ctx, x + size - 22, y + size - 15, 22, 15, 4);
  ctx.fill();
  ctx.fillStyle = "#12100a";
  ctx.font = '800 11px "Segoe UI",system-ui,sans-serif';
  ctx.fillText(String(c.level), x + size - 11, y + size - 7);
  ctx.restore();
  ctx.textBaseline = "alphabetic";
}

export function drawStatusIcons(ctx: CanvasRenderingContext2D, x: number, y: number, effects: { kind: string; turns: number }[]): void {
  const glyph: Record<string, string> = {
    burn: "🔥", poison: "☠️", stun: "💫", bleed: "🩸", shield: "🛡️", haste: "⚡",
    slow: "🐌", weaken: "🔻", regen: "💚", rage: "😡", freeze: "❄️",
  };
  ctx.save();
  ctx.font = '15px "Segoe UI Emoji",system-ui,sans-serif';
  ctx.textAlign = "left";
  effects.slice(0, 6).forEach((e, i) => {
    const bx = x + i * 26;
    ctx.fillStyle = "rgba(0,0,0,.6)";
    roundRect(ctx, bx, y, 23, 23, 4);
    ctx.fill();
    ctx.fillText(glyph[e.kind] ?? "✦", bx + 3, y + 17);
    ctx.fillStyle = "#e8e8e8";
    ctx.font = '700 9px "Segoe UI",system-ui,sans-serif';
    ctx.fillText(String(e.turns), bx + 16, y + 21);
    ctx.font = '15px "Segoe UI Emoji",system-ui,sans-serif';
  });
  ctx.restore();
}

export function drawButton(ctx: CanvasRenderingContext2D, b: HudButton, hovered: boolean, pressed: boolean): void {
  const t = TONES[b.tone];
  const r = b.rect;
  const off = pressed ? 2 : 0;
  ctx.save();
  ctx.globalAlpha = b.enabled ? 1 : 0.38;

  // drop shadow plate (gives the chunky arcade button feel)
  ctx.fillStyle = "rgba(0,0,0,.65)";
  roundRect(ctx, r.x, r.y + 4, r.w, r.h, 9);
  ctx.fill();

  const g = ctx.createLinearGradient(r.x, r.y + off, r.x, r.y + r.h + off);
  g.addColorStop(0, hovered && b.enabled ? shade(t.bg, 0.18) : t.bg);
  g.addColorStop(1, shade(t.bg, -0.3));
  ctx.fillStyle = g;
  roundRect(ctx, r.x, r.y + off, r.w, r.h, 9);
  ctx.fill();
  ctx.strokeStyle = t.edge;
  ctx.lineWidth = hovered && b.enabled ? 2 : 1;
  roundRect(ctx, r.x, r.y + off, r.w, r.h, 9);
  ctx.stroke();

  ctx.fillStyle = t.text;
  ctx.textAlign = "center";
  ctx.font = '800 15px "Segoe UI",system-ui,sans-serif';
  ctx.fillText(b.label, r.x + r.w / 2, r.y + r.h / 2 + 1 + off);
  if (b.hint) {
    ctx.font = '600 10px "Segoe UI",system-ui,sans-serif';
    ctx.globalAlpha *= 0.75;
    ctx.fillText(b.hint, r.x + r.w / 2, r.y + r.h - 7 + off);
  }
  ctx.restore();
}

export function drawBanner(ctx: CanvasRenderingContext2D, w: number, y: number, text: string, sub: string, alpha: number): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.font = '900 40px "Segoe UI",system-ui,sans-serif';
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(0,0,0,.85)";
  ctx.strokeText(text, w / 2, y);
  ctx.fillStyle = "#f2e2b4";
  ctx.fillText(text, w / 2, y);
  if (sub) {
    ctx.font = '700 15px "Segoe UI",system-ui,sans-serif';
    ctx.fillStyle = "#c8c8c8";
    ctx.fillText(sub, w / 2, y + 26);
  }
  ctx.restore();
}

export function drawLogPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, lines: string[]): void {
  if (!lines.length) return;
  const h = lines.length * 18 + 14;
  ctx.save();
  ctx.fillStyle = "rgba(8,8,8,.62)";
  roundRect(ctx, x, y, w, h, 7);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  roundRect(ctx, x, y, w, h, 7);
  ctx.stroke();
  ctx.font = '600 12px "Segoe UI",system-ui,sans-serif';
  ctx.textAlign = "left";
  lines.forEach((l, i) => {
    ctx.globalAlpha = 0.45 + (i / Math.max(1, lines.length - 1)) * 0.55;
    ctx.fillStyle = "#d8d8d8";
    ctx.fillText(l.slice(0, 64), x + 10, y + 22 + i * 18);
  });
  ctx.restore();
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
