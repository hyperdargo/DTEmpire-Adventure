/**
 * Arcade client entry point.
 *
 * Architecture
 * ────────────
 *  fixed-step game loop  →  state machine (boot → town → battle → result)
 *  server battle events  →  a timed "choreography" queue that plays each event
 *                            as animation + FX, so combat reads like a game
 *                            instead of a log dump.
 *
 * The server stays authoritative: every action is a normal API call and the
 * renderer only visualises the returned events. Nothing about outcomes,
 * damage or rewards is computed here.
 */
import { gameApi, ApiError, type Battle, type BattleEvent, type Me } from "./api.ts";
import { Fx } from "./fx.ts";
import { Bar, drawBanner, drawButton, drawHealthBar, drawLogPanel, drawPortrait, drawStatusIcons, hit, type HudButton } from "./hud.ts";
import { loadQuality, profile, saveQuality, type Quality, type QualityProfile } from "./quality.ts";
import { drawScene, sceneFor, type SceneId } from "./scene.ts";
import { drawActor, ease, paletteFor, solvePose, weaponFor, type AnimState, type Palette, type WeaponKind } from "./sprites.ts";

// ── canvas bootstrap ─────────────────────────────────────────────────────
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
const boot = document.getElementById("boot") as HTMLDivElement;

let quality: Quality = loadQuality();
let prof: QualityProfile = profile(quality);
let W = 0, H = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, prof.dpr);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
}
window.addEventListener("resize", resize);
resize();

const fx = new Fx(prof.particles);

// ── actor view-models ────────────────────────────────────────────────────
interface ActorView {
  state: AnimState;
  stateAt: number;
  x: number; y: number;
  facing: 1 | -1;
  palette: Palette;
  weapon: WeaponKind;
  flash: number;
  bar: Bar;
  height: number;
}

function makeActor(facing: 1 | -1): ActorView {
  return {
    state: "idle", stateAt: 0, x: 0, y: 0, facing,
    palette: paletteFor("warrior"), weapon: "sword", flash: 0,
    bar: new Bar(1), height: 108,
  };
}

const hero = makeActor(1);
const foe = makeActor(-1);

function setState(a: ActorView, s: AnimState) {
  if (a.state === "dead" && s !== "idle") return;
  a.state = s;
  a.stateAt = clock;
}

// ── global game state ────────────────────────────────────────────────────
type Screen = "loading" | "login" | "hub" | "battle" | "result" | "offline";

let screen: Screen = "loading";
let me: Me | null = null;
let battle: Battle | null = null;
let scene: SceneId = "town";
let clock = 0;
let banner = { text: "", sub: "", until: 0 };
const log: string[] = [];
let busy = false;
let lastError = "";

/** Pending battle events waiting to be played out visually. */
interface Beat { at: number; ev: BattleEvent }
let beats: Beat[] = [];
let beatCursor = 0;
let beatStart = 0;
let playingBattleId = "";

function pushLog(s: string) {
  log.push(s);
  if (log.length > 5) log.shift();
}

function showBanner(text: string, sub = "", seconds = 2.2) {
  banner = { text, sub, until: clock + seconds };
}

// ── battle choreography ──────────────────────────────────────────────────
/** Convert a server event list into a timeline with per-event dwell times. */
function scheduleEvents(events: BattleEvent[], fromIndex: number) {
  const next: Beat[] = [];
  let t = 0;
  for (let i = fromIndex; i < events.length; i++) {
    const ev = events[i];
    if (!ev) continue;
    next.push({ at: t, ev });
    switch (ev.t) {
      case "action": t += 0.42; break;
      case "hit": t += 0.34; break;
      case "miss": t += 0.3; break;
      case "heal": t += 0.3; break;
      case "telegraph": t += 0.6; break;
      case "dot": t += 0.26; break;
      case "effect": t += 0.2; break;
      case "stunned": t += 0.4; break;
      case "end": t += 0.5; break;
      default: t += 0.12; break;
    }
  }
  beats = next;
  beatCursor = 0;
  beatStart = clock;
}

function actorOf(who: "player" | "enemy" | "pet"): ActorView {
  return who === "enemy" ? foe : hero;
}

function playBeat(ev: BattleEvent) {
  switch (ev.t) {
    case "turn":
      pushLog(`— Turn ${ev.n} —`);
      break;
    case "action": {
      const a = actorOf(ev.by);
      const isSpell = /cast|bolt|flame|frost|heal|arcane|holy|shadow/i.test(ev.label);
      setState(a, isSpell ? "cast" : "attack");
      pushLog(`${ev.icon ?? "•"} ${ev.by === "enemy" ? foeName() : "You"}: ${ev.label}`);
      if (isSpell && prof.particles) fx.burst(a.x + 34 * a.facing, a.y - 96, "magic", 14, 1.6, a.facing > 0 ? 0 : Math.PI, 110);
      break;
    }
    case "hit": {
      const src = actorOf(ev.by);
      const tgt = actorOf(ev.target);
      const strength = ev.crit ? 1 : 0.55;
      tgt.flash = 1;
      setState(tgt, tgt.state === "dead" ? "dead" : "hurt");
      fx.slash(tgt.x, tgt.y - 62, src.facing, ev.crit ? "#ffe9a8" : "#ffffff", ev.crit ? 82 : 62);
      fx.burst(tgt.x, tgt.y - 62, "blood", ev.crit ? 26 : 14, 2.4, src.facing > 0 ? -0.5 : Math.PI + 0.5, ev.crit ? 300 : 190);
      fx.burst(tgt.x, tgt.y - 62, "spark", ev.crit ? 18 : 9, 2.8, 0, 220);
      fx.floater(tgt.x, tgt.y - 110, `-${ev.dmg}`, ev.crit ? "#ffd24a" : "#ff6a5a", ev.crit);
      if (prof.shake) fx.impact(ev.crit ? 18 : 8);
      if (ev.crit) fx.flash("#ffdca8", 0.2);
      if (ev.absorbed) fx.floater(tgt.x + 40, tgt.y - 130, `🛡 ${ev.absorbed}`, "#8fd8ff");
      pushLog(`${ev.crit ? "💥 CRIT " : ""}${ev.dmg} damage to ${ev.target === "enemy" ? foeName() : "you"}`);
      break;
    }
    case "miss": {
      const tgt = actorOf(ev.target);
      fx.floater(tgt.x, tgt.y - 112, "MISS", "#b8c4d0");
      pushLog(`${ev.by === "enemy" ? foeName() : "You"} missed`);
      break;
    }
    case "heal": {
      const tgt = actorOf(ev.target);
      fx.burst(tgt.x, tgt.y - 50, "heal", 22, 2.2, -Math.PI / 2, 120);
      fx.floater(tgt.x, tgt.y - 116, `+${ev.amount}`, "#7fe8a8");
      pushLog(`+${ev.amount} HP (${ev.source})`);
      break;
    }
    case "effect": {
      const tgt = actorOf(ev.target);
      fx.burst(tgt.x, tgt.y - 60, "magic", 12, 2.4, 0, 90);
      pushLog(`${ev.kind} applied (${ev.turns}t)`);
      break;
    }
    case "dot": {
      const tgt = actorOf(ev.target);
      tgt.flash = 0.6;
      fx.burst(tgt.x, tgt.y - 60, "ember", 14, 2.2, -Math.PI / 2, 130);
      fx.floater(tgt.x, tgt.y - 104, `-${ev.dmg}`, "#ff9a4a");
      break;
    }
    case "stunned": {
      const tgt = actorOf(ev.target);
      fx.floater(tgt.x, tgt.y - 116, "STUNNED", "#ffe07a");
      fx.burst(tgt.x, tgt.y - 90, "spark", 16, 2.6, -Math.PI / 2, 120);
      break;
    }
    case "telegraph": {
      const a = actorOf(ev.by);
      setState(a, "guard");
      fx.floater(a.x, a.y - 130, ev.text.toUpperCase(), "#ff7a5a", true);
      fx.flash("#5a0000", 0.14);
      pushLog(`⚠ ${ev.text}`);
      break;
    }
    case "flee":
      pushLog(ev.ok ? "You escaped!" : "Escape failed!");
      break;
    case "end": {
      if (ev.result === "won") {
        setState(hero, "victory");
        setState(foe, "dead");
        fx.burst(foe.x, foe.y - 60, "shard", 40, Math.PI * 2, 0, 260);
        showBanner("VICTORY", "Tap to continue", 3);
      } else if (ev.result === "lost") {
        setState(hero, "dead");
        fx.flash("#400000", 0.35);
        showBanner("DEFEATED", "Tap to return to town", 3);
      } else {
        showBanner(ev.result === "fled" ? "ESCAPED" : "TIME UP", "Tap to continue", 2.6);
      }
      screen = "result";
      break;
    }
  }
}

function foeName(): string {
  return battle?.state.enemy.name ?? "Enemy";
}

/** Apply a fresh battle payload, queueing any newly-arrived events. */
function adoptBattle(b: Battle, playFrom: number) {
  const fresh = b.id !== playingBattleId;
  battle = b;
  playingBattleId = b.id;
  scene = sceneFor(`${b.kind} ${JSON.stringify(b.context)}`);

  hero.palette = paletteFor(b.state.player.classId ?? b.state.player.name);
  hero.weapon = weaponFor(b.state.player.classId, hero.palette);
  foe.palette = paletteFor(b.state.enemy.classId ?? b.state.enemy.name, b.state.enemy.isBoss);
  foe.weapon = weaponFor(b.state.enemy.classId, foe.palette);
  foe.height = b.state.enemy.isBoss ? 150 : 108;

  if (fresh) {
    setState(hero, "idle");
    setState(foe, "idle");
    hero.bar.shown = b.state.player.hp / Math.max(1, b.state.player.maxHp);
    foe.bar.shown = b.state.enemy.hp / Math.max(1, b.state.enemy.maxHp);
  }
  scheduleEvents(b.state.events, playFrom);
  screen = b.state.status === "active" ? "battle" : "result";
}

// ── server actions ───────────────────────────────────────────────────────
async function guarded<T>(fn: () => Promise<T>): Promise<T | null> {
  if (busy) return null;
  busy = true;
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "Connection lost";
    lastError = msg;
    showBanner("⚠", msg, 2.4);
    if (e instanceof ApiError && e.status === 401) location.href = "/login";
    return null;
  } finally {
    busy = false;
  }
}

async function doAction(action: unknown) {
  if (!battle || battle.state.status !== "active") return;
  const before = battle.state.events.length;
  const id = battle.id;
  const r = await guarded(() => gameApi.act(id, action));
  if (r) {
    if (r.me) me = r.me;
    adoptBattle(r.battle, before);
  }
}

async function doAuto() {
  if (!battle) return;
  const before = battle.state.events.length;
  const id = battle.id;
  const r = await guarded(() => gameApi.auto(id, true));
  if (r) {
    if (r.me) me = r.me;
    adoptBattle(r.battle, before);
  }
}

async function doFlee() {
  if (!battle) return;
  const before = battle.state.events.length;
  const id = battle.id;
  const r = await guarded(() => gameApi.forfeit(id));
  if (r) adoptBattle(r.battle, before);
}

async function startAdventure() {
  const r = await guarded(() => gameApi.startAdventure());
  if (r?.battle) {
    playingBattleId = "";
    adoptBattle(r.battle, 0);
  } else {
    showBanner("No energy", "Rest at the inn to recover", 2.4);
  }
}

async function refreshMe() {
  const r = await guarded(() => gameApi.me());
  if (r) {
    me = r;
    const q = r.hero?.settings?.graphicsQuality;
    if (q && q !== quality) applyQuality(q, false);
  }
}

function applyQuality(q: Quality, persist = true) {
  quality = q;
  prof = profile(q);
  fx.resize(prof.particles);
  resize();
  saveQuality(q);
  if (persist) void guarded(() => gameApi.saveGraphics(q));
  showBanner("Graphics", `${q.toUpperCase()} preset active`, 1.6);
}

// ── input ────────────────────────────────────────────────────────────────
let pointer = { x: -1, y: -1, down: false };
let buttons: HudButton[] = [];
let focusIndex = -1;

canvas.addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; });
canvas.addEventListener("pointerdown", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.down = true; });
canvas.addEventListener("pointerup", (e) => {
  pointer.down = false;
  handleClick(e.clientX, e.clientY);
});
canvas.addEventListener("pointerleave", () => { pointer.x = -1; pointer.y = -1; pointer.down = false; });

function handleClick(x: number, y: number) {
  if (screen === "result") { returnToHub(); return; }
  const b = buttons.find((v) => v.enabled && hit(v.rect, x, y));
  if (b) activate(b.id);
}

function activate(id: string) {
  switch (id) {
    case "attack": void doAction({ type: "attack" }); break;
    case "guard": void doAction({ type: "guard" }); break;
    case "auto": void doAuto(); break;
    case "flee": void doFlee(); break;
    case "adventure": void startAdventure(); break;
    case "web": location.href = "/town"; break;
    case "gfx-low": applyQuality("low"); break;
    case "gfx-medium": applyQuality("medium"); break;
    case "gfx-high": applyQuality("high"); break;
    default:
      if (id.startsWith("skill:")) void doAction({ type: "skill", skillId: id.slice(6) });
      break;
  }
}

function returnToHub() {
  battle = null;
  playingBattleId = "";
  beats = [];
  screen = "hub";
  scene = "town";
  setState(hero, "idle");
  setState(foe, "idle");
  hero.state = "idle";
  void refreshMe();
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const list = buttons.filter((b) => b.enabled);
    if (!list.length) return;
    focusIndex = (focusIndex + (e.shiftKey ? -1 : 1) + list.length) % list.length;
    return;
  }
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (screen === "result") { returnToHub(); return; }
    const list = buttons.filter((b) => b.enabled);
    const focused = focusIndex >= 0 ? list[focusIndex] : undefined;
    if (focused) activate(focused.id);
    return;
  }
  const map: Record<string, string> = { "1": "attack", "2": "guard", a: "auto", f: "flee", e: "adventure" };
  const mapped = map[e.key.toLowerCase()];
  if (mapped) activate(mapped);
  if (e.key === "F1") { e.preventDefault(); applyQuality("low"); }
  if (e.key === "F2") { e.preventDefault(); applyQuality("medium"); }
  if (e.key === "F3") { e.preventDefault(); applyQuality("high"); }
});

// ── layout + render ──────────────────────────────────────────────────────
function layout() {
  const groundY = H * 0.74;
  hero.y = groundY;
  foe.y = groundY;
  const spread = Math.min(W * 0.28, 260);
  hero.x = W / 2 - spread;
  foe.x = W / 2 + spread;
}

function buildButtons(): HudButton[] {
  const pad = 14;
  const barH = 62;
  const y = H - barH - pad;
  const out: HudButton[] = [];

  if (screen === "battle" && battle?.state.status === "active") {
    const live = beatCursor >= beats.length;
    const skills = battle.state.player.skills.filter((s) => s.cd === 0).slice(0, 3);
    const slots = 3 + skills.length;
    const gap = 8;
    const totalW = Math.min(W - pad * 2, 720);
    const bw = (totalW - gap * (slots - 1)) / slots;
    let x = (W - totalW) / 2;
    const add = (id: string, label: string, hint: string, tone: HudButton["tone"], enabled = true) => {
      out.push({ id, label, hint, tone, enabled: enabled && live && !busy, rect: { x, y, w: bw, h: barH } });
      x += bw + gap;
    };
    add("attack", "ATTACK", "1", "attack");
    for (const s of skills) add(`skill:${s.id}`, s.id.replace(/_/g, " ").slice(0, 10).toUpperCase(), `R${s.rank}`, "skill");
    add("guard", "GUARD", "2", "guard");
    add("auto", "AUTO", "A", "auto");
    if (battle.state.canFlee) add("flee", "FLEE", "F", "flee");
  } else if (screen === "hub") {
    const bw = Math.min(280, W - 48);
    out.push({ id: "adventure", label: "⚔  ENTER BATTLE", hint: "E", tone: "attack", enabled: !busy, rect: { x: W / 2 - bw / 2, y: H * 0.62, w: bw, h: 62 } });
    out.push({ id: "web", label: "TOWN & MENUS", hint: "full web UI", tone: "auto", enabled: true, rect: { x: W / 2 - bw / 2, y: H * 0.62 + 74, w: bw, h: 52 } });
  }

  // graphics switcher — always available, top-right
  const gw = 62, gh = 26, gy = 14;
  (["low", "medium", "high"] as Quality[]).forEach((q, i) => {
    out.push({
      id: `gfx-${q}`,
      label: q === "low" ? "LOW" : q === "medium" ? "MED" : "HIGH",
      hint: "",
      tone: quality === q ? "attack" : "auto",
      enabled: true,
      rect: { x: W - 14 - (3 - i) * (gw + 6), y: gy, w: gw, h: gh },
    });
  });
  return out;
}

function drawHubOverlay() {
  const h = me?.hero;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = '900 44px "Segoe UI",system-ui,sans-serif';
  ctx.fillStyle = "#f0e0b8";
  ctx.strokeStyle = "rgba(0,0,0,.8)";
  ctx.lineWidth = 6;
  ctx.strokeText("DTEMPIRE ADVENTURE", W / 2, H * 0.3);
  ctx.fillText("DTEMPIRE ADVENTURE", W / 2, H * 0.3);
  ctx.font = '600 14px "Segoe UI",system-ui,sans-serif';
  ctx.fillStyle = "#9a9a9a";
  ctx.fillText("ARCADE CLIENT", W / 2, H * 0.3 + 24);

  if (h) {
    ctx.font = '700 17px "Segoe UI",system-ui,sans-serif';
    ctx.fillStyle = "#e8e8e8";
    ctx.fillText(`${h.name}  ·  Lv ${h.level}${h.className ? `  ·  ${h.className}` : ""}`, W / 2, H * 0.42);
    ctx.font = '600 14px "Segoe UI",system-ui,sans-serif';
    ctx.fillStyle = "#d8b45a";
    const energy = h.energy !== undefined ? `   ⚡ ${h.energy}/${h.maxEnergy ?? "?"}` : "";
    ctx.fillText(`🪙 ${h.coins.toLocaleString()}   ❤ ${h.hp}/${h.maxHp}${energy}`, W / 2, H * 0.42 + 24);
  } else {
    ctx.font = '600 15px "Segoe UI",system-ui,sans-serif';
    ctx.fillStyle = "#c8785a";
    ctx.fillText("Not signed in — open the web app to log in", W / 2, H * 0.42);
  }
  ctx.restore();
}

function drawBattleHud() {
  if (!battle) return;
  const p = battle.state.player;
  const e = battle.state.enemy;
  const barW = Math.min(W * 0.36, 330);

  drawPortrait(ctx, 14, 44, 54, p.icon, p, "#d8b45a");
  drawHealthBar(ctx, 78, 58, barW, 16, hero.bar.shown, hero.bar.shown, "#5ad88a", p.name, `${p.hp}/${p.maxHp}`);
  drawStatusIcons(ctx, 78, 80, p.effects);

  drawPortrait(ctx, W - 68, 44, 54, e.icon, e, e.isBoss ? "#ff5a4a" : "#a8a8a8");
  drawHealthBar(ctx, W - 78 - barW, 58, barW, 16, foe.bar.shown, foe.bar.shown, e.isBoss ? "#e05a4a" : "#d87a5a", e.name, `${e.hp}/${e.maxHp}`);
  drawStatusIcons(ctx, W - 78 - barW, 80, e.effects);

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = '700 13px "Segoe UI",system-ui,sans-serif';
  ctx.fillStyle = "#8a8a8a";
  ctx.fillText(`TURN ${battle.state.turn} / ${battle.state.maxTurns}`, W / 2, 34);
  ctx.restore();

  drawLogPanel(ctx, 14, H - 62 - 28 - log.length * 18 - 14, Math.min(360, W - 28), log);
}

function render(dt: number) {
  layout();
  drawScene(ctx, scene, W, H, clock, prof);

  // ambient emitters per scene
  if (prof.weather) {
    if (scene === "smithy") fx.ambient(W * 0.22, H * 0.7, "ember", dt, 26, 60);
    else if (scene === "cave" || scene === "tower" || scene === "abyss") fx.ambient(Math.random() * W, H * 0.8, "magic", dt, 14, W);
    else fx.ambient(Math.random() * W, H * 0.78, "dust", dt, 9, W);
  }

  const shake = fx.shakeOffset(prof.shake);
  ctx.save();
  ctx.translate(shake.x, shake.y);

  const inBattle = screen === "battle" || screen === "result";
  if (inBattle && battle) {
    drawActor(ctx, {
      x: foe.x, y: foe.y, height: foe.height, facing: foe.facing, palette: foe.palette,
      weapon: foe.weapon, pose: solvePose(foe.state, clock - foe.stateAt, clock),
      shadow: prof.shadows, flash: foe.flash, flat: quality === "low", isBoss: battle.state.enemy.isBoss,
    });
  }
  drawActor(ctx, {
    x: hero.x, y: hero.y, height: hero.height, facing: hero.facing, palette: hero.palette,
    weapon: hero.weapon, pose: solvePose(hero.state, clock - hero.stateAt, clock),
    shadow: prof.shadows, flash: hero.flash, flat: quality === "low",
  });

  fx.drawSlashes(ctx);
  fx.drawParticles(ctx, prof.lighting);
  fx.drawFloaters(ctx);
  ctx.restore();

  fx.drawFlash(ctx, W, H);

  if (screen === "login") drawLoginScreen();
  if (screen === "hub") drawHubOverlay();
  if (inBattle) drawBattleHud();

  buttons = buildButtons();
  const focusable = buttons.filter((b) => b.enabled);
  buttons.forEach((b) => {
    const hovered = hit(b.rect, pointer.x, pointer.y) || focusable[focusIndex]?.id === b.id;
    drawButton(ctx, b, hovered, hovered && pointer.down);
  });

  const bannerAlpha = banner.until > clock ? Math.min(1, (banner.until - clock) * 1.6) : 0;
  drawBanner(ctx, W, H * 0.34, banner.text, banner.sub, bannerAlpha);

  if (busy) {
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(clock * 6) * 0.2;
    ctx.fillStyle = "#d8b45a";
    ctx.beginPath();
    ctx.arc(W - 22, H - 22, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (screen === "offline") {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = '800 22px "Segoe UI",system-ui,sans-serif';
    ctx.fillStyle = "#e0a08a";
    ctx.fillText("Cannot reach the realm", W / 2, H / 2);
    ctx.font = '600 14px "Segoe UI",system-ui,sans-serif';
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText(lastError || "Retrying…", W / 2, H / 2 + 24);
    ctx.restore();
  }
}

// ── update ───────────────────────────────────────────────────────────────
function update(dt: number) {
  fx.update(dt);
  hero.flash = Math.max(0, hero.flash - dt * 4);
  foe.flash = Math.max(0, foe.flash - dt * 4);

  // return to idle when a one-shot animation finishes
  for (const a of [hero, foe]) {
    const age = clock - a.stateAt;
    if ((a.state === "attack" && age > 0.55) || (a.state === "cast" && age > 0.8) || (a.state === "hurt" && age > 0.4) || (a.state === "guard" && age > 1.2)) {
      a.state = "idle";
      a.stateAt = clock;
    }
  }

  // play queued battle beats on their schedule
  while (beatCursor < beats.length) {
    const b = beats[beatCursor];
    if (!b || clock - beatStart < b.at) break;
    playBeat(b.ev);
    beatCursor++;
  }

  // drive bars toward the authoritative values once the beats have played
  if (battle) {
    const p = battle.state.player, e = battle.state.enemy;
    hero.bar.set(p.hp / Math.max(1, p.maxHp));
    foe.bar.set(e.hp / Math.max(1, e.maxHp));
    hero.bar.update(dt);
    foe.bar.update(dt);
    if (p.hp <= 0 && hero.state !== "dead") setState(hero, "dead");
    if (e.hp <= 0 && foe.state !== "dead") setState(foe, "dead");
  }
}

let lastT = performance.now();
let accum = 0;
function frame(now: number) {
  const raw = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;
  accum += raw * 1000;
  // frame pacing for the low tier (30fps cap saves battery on phones)
  if (accum < prof.frameMs - 1) { requestAnimationFrame(frame); return; }
  const dt = accum / 1000;
  accum = 0;
  clock += dt;
  update(dt);
  render(dt);
  requestAnimationFrame(frame);
}

// ── login screen ─────────────────────────────────────────────────────────
let loginOverlay: HTMLDivElement | null = null;
let loginError = "";

function showLoginForm() {
  if (loginOverlay) return;
  const el = document.createElement("div");
  el.id = "login-overlay";
  el.innerHTML = `
    <div style="position:fixed;inset:0;display:grid;place-content:center;z-index:40;pointer-events:all">
      <div style="width:340px;padding:32px 28px;background:rgba(14,14,14,.94);border:1px solid #333;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.7)">
        <div style="text-align:center;margin-bottom:20px">
          <img src="/icon-192.png" style="width:56px;height:56px;image-rendering:pixelated;margin-bottom:10px" alt="">
          <div style="color:#f0e0b8;font:800 22px 'Segoe UI',system-ui,sans-serif;letter-spacing:.04em">DTEMPIRE ADVENTURE</div>
          <div style="color:#8a8a8a;font:600 12px 'Segoe UI',system-ui,sans-serif;margin-top:4px">ARCADE CLIENT</div>
        </div>
        <div id="login-err" style="color:#ff6a5a;font:600 12px 'Segoe UI',system-ui,sans-serif;text-align:center;min-height:18px;margin-bottom:8px"></div>
        <input id="login-user" type="text" placeholder="Username" autocomplete="username"
          style="width:100%;padding:10px 14px;margin-bottom:10px;background:#1a1a1a;border:1px solid #444;border-radius:8px;color:#e8e8e8;font:600 14px 'Segoe UI',system-ui,sans-serif;outline:none">
        <input id="login-pass" type="password" placeholder="Password" autocomplete="current-password"
          style="width:100%;padding:10px 14px;margin-bottom:16px;background:#1a1a1a;border:1px solid #444;border-radius:8px;color:#e8e8e8;font:600 14px 'Segoe UI',system-ui,sans-serif;outline:none">
        <button id="login-btn"
          style="width:100%;padding:12px;background:#d8b45a;border:none;border-radius:8px;color:#14100a;font:800 15px 'Segoe UI',system-ui,sans-serif;cursor:pointer;margin-bottom:10px">SIGN IN</button>
        <button id="guest-btn"
          style="width:100%;padding:10px;background:transparent;border:1px solid #555;border-radius:8px;color:#b8b8b8;font:700 13px 'Segoe UI',system-ui,sans-serif;cursor:pointer">PLAY AS GUEST</button>
        <div style="color:#666;font:500 11px 'Segoe UI',system-ui,sans-serif;text-align:center;margin-top:14px">
          Or <a href="/" style="color:#d8b45a;text-decoration:underline">open the full web app</a> to register
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  loginOverlay = el;

  const errEl = el.querySelector("#login-err") as HTMLDivElement;
  const userEl = el.querySelector("#login-user") as HTMLInputElement;
  const passEl = el.querySelector("#login-pass") as HTMLInputElement;
  const loginBtn = el.querySelector("#login-btn") as HTMLButtonElement;
  const guestBtn = el.querySelector("#guest-btn") as HTMLButtonElement;

  async function doLogin() {
    const u = userEl.value.trim();
    const p = passEl.value;
    if (!u || !p) { errEl.textContent = "Enter username and password"; return; }
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in…";
    errEl.textContent = "";
    try {
      await gameApi.login(u, p);
      await loginComplete();
    } catch (e) {
      errEl.textContent = e instanceof ApiError ? e.message : "Connection failed";
      loginBtn.disabled = false;
      loginBtn.textContent = "SIGN IN";
    }
  }

  async function doGuest() {
    guestBtn.disabled = true;
    guestBtn.textContent = "Creating guest…";
    errEl.textContent = "";
    try {
      await gameApi.guest();
      await loginComplete();
    } catch (e) {
      errEl.textContent = e instanceof ApiError ? e.message : "Connection failed";
      guestBtn.disabled = false;
      guestBtn.textContent = "PLAY AS GUEST";
    }
  }

  loginBtn.addEventListener("click", doLogin);
  guestBtn.addEventListener("click", doGuest);
  passEl.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  userEl.addEventListener("keydown", (e) => { if (e.key === "Enter") passEl.focus(); });
  setTimeout(() => userEl.focus(), 100);
}

async function loginComplete() {
  const r = await gameApi.me();
  if (!r.user) { loginError = "Login failed"; return; }
  // Remove overlay
  if (loginOverlay) { loginOverlay.remove(); loginOverlay = null; }
  await enterGame(r);
}

function drawLoginScreen() {
  drawScene(ctx, "town", W, H, clock, prof);
  // Dim overlay
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // The actual login form is a DOM overlay (loginOverlay) so text input works
}

// ── startup ──────────────────────────────────────────────────────────────
async function start() {
  const r = await guarded(() => gameApi.me());
  if (!r) { screen = "offline"; }
  else {
    me = r;
    if (!r.user) {
      screen = "login";
      showLoginForm();
      // Don't proceed — loginComplete() will call enterGame()
      boot.style.transition = "opacity .4s";
      boot.style.opacity = "0";
      setTimeout(() => boot.remove(), 420);
      requestAnimationFrame(frame);
      return;
    }
    await enterGame(r);
  }
  boot.style.transition = "opacity .4s";
  boot.style.opacity = "0";
  setTimeout(() => boot.remove(), 420);
  requestAnimationFrame(frame);
}

async function enterGame(r: Me) {
  me = r;
  const q = r.hero?.settings?.graphicsQuality;
  if (q) { quality = q; prof = profile(q); fx.resize(prof.particles); resize(); }
  hero.palette = paletteFor(r.hero?.classId ?? "warrior");
  hero.weapon = weaponFor(r.hero?.classId, hero.palette);
  const ab = await guarded(() => gameApi.activeBattle());
  if (ab?.battle) adoptBattle(ab.battle, Math.max(0, ab.battle.state.events.length - 6));
  else { screen = "hub"; scene = "town"; }
}

// keep the session warm and pick up web-app changes made in another tab
setInterval(() => { if (screen === "hub") void refreshMe(); }, 30_000);

void start();

// expose for the desktop/mobile shells (live-update button, quality push)
declare global {
  interface Window { arcade?: { setQuality(q: Quality): void; reload(): void } }
}
window.arcade = {
  setQuality: (q: Quality) => applyQuality(q),
  reload: () => location.reload(),
};

export { ease };
