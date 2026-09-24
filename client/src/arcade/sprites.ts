/**
 * Procedural 2D character renderer.
 *
 * The project ships no sprite sheets, so actors are drawn as layered vector
 * "puppets" with a tiny skeletal animation system: torso, head, two arms, two
 * legs, plus a weapon. Every pose is a deterministic function of (clock, state),
 * so animation is frame-rate independent and reversible.
 *
 * Palettes are derived from the hero class / monster tier so a Warrior, a Mage
 * and a Slime all read differently at a glance without any image downloads.
 */

export type AnimState = "idle" | "walk" | "attack" | "cast" | "hurt" | "guard" | "dead" | "victory";

export interface Palette {
  skin: string;
  cloth: string;
  clothDark: string;
  metal: string;
  accent: string;
  hair: string;
}

export const PALETTES = {
  warrior: { skin: "#d9a06b", cloth: "#7c2f2f", clothDark: "#4a1b1b", metal: "#b9bcc4", accent: "#d8b45a", hair: "#3a2a1c" },
  mage: { skin: "#e0b184", cloth: "#2f3f7c", clothDark: "#1b264a", metal: "#9fb4d8", accent: "#6fd8e8", hair: "#e8e8e8" },
  rogue: { skin: "#c98f5e", cloth: "#243026", clothDark: "#141c16", metal: "#8f9aa0", accent: "#7fd88a", hair: "#1c1c1c" },
  paladin: { skin: "#dcae7c", cloth: "#5a4a7c", clothDark: "#332a4a", metal: "#e6d9a8", accent: "#ffe9a8", hair: "#c8a15a" },
  ranger: { skin: "#cf9a68", cloth: "#2f5a3a", clothDark: "#1a3322", metal: "#a8b09a", accent: "#9ad86f", hair: "#5a3a22" },
  beast: { skin: "#7c5a3a", cloth: "#4a3322", clothDark: "#2a1c12", metal: "#8a7a5a", accent: "#d86f4a", hair: "#3a2414" },
  undead: { skin: "#a8b8a8", cloth: "#3a3a4a", clothDark: "#22222c", metal: "#8a8a9a", accent: "#7fe8c8", hair: "#d8d8d8" },
  demon: { skin: "#8c3a3a", cloth: "#2a1220", clothDark: "#160a12", metal: "#a05a5a", accent: "#ff6a4a", hair: "#1a0a0a" },
  slime: { skin: "#6fd8a8", cloth: "#3aa87c", clothDark: "#1f6a4c", metal: "#8fe8c0", accent: "#c8ffe8", hair: "#6fd8a8" },
  boss: { skin: "#6a2a2a", cloth: "#1a1020", clothDark: "#0d0810", metal: "#c8a05a", accent: "#ff4a4a", hair: "#0a0a0a" },
} satisfies Record<string, Palette>;

/** Map a class id / monster name onto a palette without throwing on unknowns. */
export function paletteFor(key: string | undefined, isBoss = false): Palette {
  if (isBoss) return PALETTES.boss;
  const k = (key ?? "").toLowerCase();
  for (const name of Object.keys(PALETTES)) {
    if (k.includes(name)) return (PALETTES as Record<string, Palette>)[name] ?? PALETTES.warrior;
  }
  if (/slime|ooze|jelly/.test(k)) return PALETTES.slime;
  if (/skeleton|zombie|wraith|ghost|lich/.test(k)) return PALETTES.undead;
  if (/demon|imp|fiend|devil/.test(k)) return PALETTES.demon;
  if (/wolf|bear|boar|spider|rat|bat/.test(k)) return PALETTES.beast;
  return PALETTES.warrior;
}

export interface ActorPose {
  /** Horizontal lunge offset in world px (positive = toward the enemy). */
  lunge: number;
  /** Vertical bob. */
  bob: number;
  /** Body lean in radians. */
  lean: number;
  /** Weapon swing angle in radians. */
  swing: number;
  /** 0..1 squash factor for landing / impact. */
  squash: number;
  /** Global alpha (death fade). */
  alpha: number;
}

const TAU = Math.PI * 2;

/**
 * Pose solver. `t` is seconds since the state began; `clock` is the global
 * seconds counter used for looping idle motion.
 */
export function solvePose(state: AnimState, t: number, clock: number): ActorPose {
  const breathe = Math.sin(clock * 1.8) * 1.6;
  switch (state) {
    case "walk": {
      const p = clock * 7;
      return { lunge: 0, bob: Math.abs(Math.sin(p)) * -4, lean: Math.sin(p) * 0.05, swing: Math.sin(p) * 0.5, squash: 0, alpha: 1 };
    }
    case "attack": {
      // Wind-up (0-0.18), strike (0.18-0.32), recover (0.32-0.55)
      const d = Math.min(t / 0.55, 1);
      const windup = Math.min(d / 0.33, 1);
      const strike = d < 0.33 ? 0 : Math.min((d - 0.33) / 0.25, 1);
      const recover = d < 0.58 ? 0 : (d - 0.58) / 0.42;
      const lunge = 34 * ease.outBack(strike) * (1 - ease.inCubic(recover));
      return {
        lunge,
        bob: -6 * strike * (1 - recover),
        lean: 0.22 * strike - 0.12 * windup,
        swing: -1.15 * windup + 2.6 * ease.outQuint(strike),
        squash: 0.12 * strike,
        alpha: 1,
      };
    }
    case "cast": {
      const d = Math.min(t / 0.8, 1);
      const rise = ease.outCubic(Math.min(d / 0.5, 1));
      const release = d < 0.6 ? 0 : (d - 0.6) / 0.4;
      return {
        lunge: 6 * rise,
        bob: -10 * rise + breathe,
        lean: -0.1 * rise,
        swing: -2.2 * rise + 1.4 * ease.outQuint(release),
        squash: 0,
        alpha: 1,
      };
    }
    case "hurt": {
      const d = Math.min(t / 0.4, 1);
      const k = (1 - d) * Math.sin(d * TAU * 3);
      return { lunge: -18 * (1 - ease.outCubic(d)), bob: -3 * k, lean: -0.3 * (1 - d), swing: 0.4 * k, squash: 0.18 * (1 - d), alpha: 1 };
    }
    case "guard": {
      return { lunge: -6, bob: breathe * 0.4, lean: -0.08, swing: -0.9, squash: 0.06, alpha: 1 };
    }
    case "dead": {
      const d = Math.min(t / 0.9, 1);
      return { lunge: -10 * d, bob: 26 * ease.inCubic(d), lean: -1.35 * ease.outCubic(d), swing: 1.2 * d, squash: 0.4 * d, alpha: 1 - 0.55 * d };
    }
    case "victory": {
      const p = clock * 5;
      const hop = Math.max(0, Math.sin(p));
      return { lunge: 0, bob: -14 * hop, lean: 0, swing: -1.6 - 0.3 * hop, squash: 0.1 * (1 - hop), alpha: 1 };
    }
    default:
      return { lunge: 0, bob: breathe, lean: Math.sin(clock * 0.9) * 0.02, swing: -0.15 + Math.sin(clock * 1.4) * 0.06, squash: 0, alpha: 1 };
  }
}

export const ease = {
  outCubic: (x: number) => 1 - Math.pow(1 - x, 3),
  inCubic: (x: number) => x * x * x,
  outQuint: (x: number) => 1 - Math.pow(1 - x, 5),
  outBack: (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2),
  outElastic: (x: number) => (x === 0 || x === 1 ? x : Math.pow(2, -9 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

export type WeaponKind = "sword" | "axe" | "staff" | "dagger" | "bow" | "claw" | "none";

export function weaponFor(classId: string | undefined, palette: Palette): WeaponKind {
  const k = (classId ?? "").toLowerCase();
  if (palette === PALETTES.mage) return "staff";
  if (k.includes("rogue") || k.includes("assassin")) return "dagger";
  if (k.includes("ranger") || k.includes("hunter") || k.includes("archer")) return "bow";
  if (k.includes("berserk") || k.includes("barbar")) return "axe";
  if (palette === PALETTES.beast || palette === PALETTES.slime) return "claw";
  return "sword";
}

export interface DrawOpts {
  /** World-space anchor (feet centre). */
  x: number;
  y: number;
  /** Actor height in px; everything else scales from it. */
  height: number;
  /** 1 = facing right, -1 = facing left. */
  facing: 1 | -1;
  palette: Palette;
  weapon: WeaponKind;
  pose: ActorPose;
  /** Draw a soft contact shadow. */
  shadow: boolean;
  /** White flash 0..1 when struck. */
  flash: number;
  /** Silhouette only (used for the low tier to cut fill cost). */
  flat: boolean;
  isBoss?: boolean;
}

/** Draw one animated humanoid/creature puppet. */
export function drawActor(ctx: CanvasRenderingContext2D, o: DrawOpts): void {
  const { pose, palette: pal } = o;
  const h = o.height;
  const u = h / 100; // unit scale
  const squashY = 1 - pose.squash * 0.35;
  const squashX = 1 + pose.squash * 0.3;

  ctx.save();
  ctx.globalAlpha = pose.alpha;
  ctx.translate(o.x + pose.lunge * o.facing, o.y + pose.bob);

  if (o.shadow) {
    ctx.save();
    ctx.globalAlpha = pose.alpha * 0.4;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 2 * u, 26 * u * squashX, 7 * u, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.scale(o.facing * squashX, squashY);
  ctx.rotate(pose.lean * o.facing);

  const body = o.flat ? pal.clothDark : pal.cloth;
  const shade = pal.clothDark;

  // ── legs ──────────────────────────────────────────────────────────────
  const stride = pose.swing * 6 * u;
  leg(ctx, -7 * u, -stride, u, shade);
  leg(ctx, 7 * u, stride, u, shade);

  // ── torso ─────────────────────────────────────────────────────────────
  ctx.fillStyle = body;
  roundRect(ctx, -14 * u, -58 * u, 28 * u, 34 * u, 6 * u);
  ctx.fill();
  if (!o.flat) {
    ctx.fillStyle = shade;
    roundRect(ctx, -14 * u, -34 * u, 28 * u, 10 * u, 4 * u);
    ctx.fill();
    // belt / trim
    ctx.fillStyle = pal.accent;
    ctx.fillRect(-14 * u, -37 * u, 28 * u, 3 * u);
    // pauldrons
    ctx.fillStyle = pal.metal;
    ctx.beginPath();
    ctx.ellipse(-15 * u, -54 * u, 8 * u, 6 * u, 0, 0, TAU);
    ctx.ellipse(15 * u, -54 * u, 8 * u, 6 * u, 0, 0, TAU);
    ctx.fill();
  }

  // ── rear arm ──────────────────────────────────────────────────────────
  arm(ctx, -12 * u, -52 * u, pose.swing * 0.5 - 0.3, u, shade, pal.skin);

  // ── head ──────────────────────────────────────────────────────────────
  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.ellipse(0, -68 * u, 11 * u, 12 * u, 0, 0, TAU);
  ctx.fill();
  if (!o.flat) {
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.ellipse(0, -74 * u, 11.5 * u, 7.5 * u, 0, Math.PI, TAU);
    ctx.fill();
    // eye
    ctx.fillStyle = "#12100e";
    ctx.fillRect(4 * u, -69 * u, 2.4 * u, 2.8 * u);
    if (o.isBoss) {
      ctx.fillStyle = pal.accent;
      ctx.fillRect(4 * u, -69 * u, 2.4 * u, 2.8 * u);
      // horns
      ctx.beginPath();
      ctx.moveTo(-9 * u, -76 * u);
      ctx.lineTo(-15 * u, -90 * u);
      ctx.lineTo(-4 * u, -79 * u);
      ctx.moveTo(9 * u, -76 * u);
      ctx.lineTo(15 * u, -90 * u);
      ctx.lineTo(4 * u, -79 * u);
      ctx.fillStyle = pal.metal;
      ctx.fill();
    }
  }

  // ── front arm + weapon ────────────────────────────────────────────────
  ctx.save();
  ctx.translate(12 * u, -52 * u);
  ctx.rotate(pose.swing);
  ctx.fillStyle = pal.cloth;
  roundRect(ctx, -3.5 * u, -2 * u, 7 * u, 22 * u, 3 * u);
  ctx.fill();
  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.ellipse(0, 21 * u, 4.5 * u, 4.5 * u, 0, 0, TAU);
  ctx.fill();
  ctx.translate(0, 21 * u);
  drawWeapon(ctx, o.weapon, u, pal, o.flat);
  ctx.restore();

  if (o.flash > 0) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = pose.alpha * o.flash * 0.85;
    ctx.fillStyle = "#fff";
    ctx.fillRect(-40 * u, -95 * u, 80 * u, 100 * u);
  }

  ctx.restore();
}

function leg(ctx: CanvasRenderingContext2D, x: number, dx: number, u: number, color: string) {
  ctx.fillStyle = color;
  roundRect(ctx, x - 5 * u + dx, -26 * u, 10 * u, 26 * u, 4 * u);
  ctx.fill();
}

function arm(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, u: number, cloth: string, skin: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = cloth;
  roundRect(ctx, -3.5 * u, -2 * u, 7 * u, 22 * u, 3 * u);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 21 * u, 4.2 * u, 4.2 * u, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawWeapon(ctx: CanvasRenderingContext2D, kind: WeaponKind, u: number, pal: Palette, flat: boolean) {
  switch (kind) {
    case "sword":
      ctx.fillStyle = "#3a2a1c";
      ctx.fillRect(-2 * u, -4 * u, 4 * u, 12 * u);
      ctx.fillStyle = pal.accent;
      ctx.fillRect(-7 * u, -6 * u, 14 * u, 3 * u);
      ctx.fillStyle = pal.metal;
      ctx.beginPath();
      ctx.moveTo(-3 * u, -6 * u);
      ctx.lineTo(3 * u, -6 * u);
      ctx.lineTo(1.6 * u, -46 * u);
      ctx.lineTo(0, -52 * u);
      ctx.lineTo(-1.6 * u, -46 * u);
      ctx.closePath();
      ctx.fill();
      if (!flat) {
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.fillRect(-0.8 * u, -44 * u, 1.4 * u, 36 * u);
      }
      break;
    case "axe":
      ctx.fillStyle = "#3a2a1c";
      ctx.fillRect(-2 * u, -40 * u, 4 * u, 48 * u);
      ctx.fillStyle = pal.metal;
      ctx.beginPath();
      ctx.moveTo(2 * u, -40 * u);
      ctx.quadraticCurveTo(22 * u, -34 * u, 16 * u, -14 * u);
      ctx.quadraticCurveTo(8 * u, -20 * u, 2 * u, -18 * u);
      ctx.closePath();
      ctx.fill();
      break;
    case "staff":
      ctx.fillStyle = "#4a3320";
      ctx.fillRect(-2 * u, -52 * u, 4 * u, 62 * u);
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(0, -56 * u, 6 * u, 0, TAU);
      ctx.fill();
      if (!flat) {
        const g = ctx.createRadialGradient(0, -56 * u, 0, 0, -56 * u, 16 * u);
        g.addColorStop(0, "rgba(120,220,240,.55)");
        g.addColorStop(1, "rgba(120,220,240,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, -56 * u, 16 * u, 0, TAU);
        ctx.fill();
      }
      break;
    case "dagger":
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(-1.6 * u, -3 * u, 3.2 * u, 9 * u);
      ctx.fillStyle = pal.metal;
      ctx.beginPath();
      ctx.moveTo(-2.4 * u, -4 * u);
      ctx.lineTo(2.4 * u, -4 * u);
      ctx.lineTo(0, -26 * u);
      ctx.closePath();
      ctx.fill();
      break;
    case "bow":
      ctx.strokeStyle = "#5a3a20";
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.arc(0, -16 * u, 22 * u, -1.15, 1.15);
      ctx.stroke();
      ctx.strokeStyle = "rgba(240,240,240,.7)";
      ctx.lineWidth = 1 * u;
      ctx.beginPath();
      ctx.moveTo(9 * u, -36 * u);
      ctx.lineTo(9 * u, 4 * u);
      ctx.stroke();
      break;
    case "claw":
      ctx.fillStyle = pal.metal;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 4 * u, 0);
        ctx.lineTo(i * 4 * u + 2 * u, -14 * u);
        ctx.lineTo(i * 4 * u - 1.5 * u, -12 * u);
        ctx.closePath();
        ctx.fill();
      }
      break;
    default:
      break;
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
