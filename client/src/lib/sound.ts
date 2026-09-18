// Tiny synthesized sound kit. No audio files: everything is generated with WebAudio.
// Off by default; the choice is remembered on this device.

const KEY = "dte:sound";
let ctx: AudioContext | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage unavailable (private mode); sound stays session-only.
  }
  if (on) play("coin");
}

function audio(): AudioContext | null {
  if (!soundEnabled()) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; slide?: number; delay?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? "triangle";
  osc.frequency.setValueAtTime(freq, t);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.12, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain = 0.15) {
  const a = audio();
  if (!a) return;
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const g = a.createGain();
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;
  g.gain.value = gain;
  src.buffer = buffer;
  src.connect(filter).connect(g).connect(a.destination);
  src.start();
}

export type Sfx = "hit" | "crit" | "hurt" | "block" | "heal" | "coin" | "level" | "flip" | "win" | "lose" | "click" | "rare";

export function play(sfx: Sfx) {
  switch (sfx) {
    case "hit":
      noise(0.08, 0.18);
      tone(180, 0.09, { type: "square", gain: 0.05, slide: 0.5 });
      break;
    case "crit":
      noise(0.14, 0.25);
      tone(520, 0.18, { type: "sawtooth", gain: 0.06, slide: 0.3 });
      break;
    case "hurt":
      tone(140, 0.16, { type: "sawtooth", gain: 0.07, slide: 0.6 });
      break;
    case "block":
      tone(880, 0.05, { type: "square", gain: 0.04 });
      tone(660, 0.08, { type: "square", gain: 0.04, delay: 0.03 });
      break;
    case "heal":
      [523, 659, 784].forEach((f, i) => tone(f, 0.18, { gain: 0.05, delay: i * 0.06 }));
      break;
    case "coin":
      tone(988, 0.07, { type: "square", gain: 0.04 });
      tone(1319, 0.12, { type: "square", gain: 0.04, delay: 0.06 });
      break;
    case "level":
      [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { gain: 0.06, delay: i * 0.08 }));
      break;
    case "flip":
      noise(0.05, 0.08);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { gain: 0.06, delay: i * 0.1 }));
      break;
    case "lose":
      [392, 330, 262].forEach((f, i) => tone(f, 0.3, { type: "sine", gain: 0.06, delay: i * 0.14 }));
      break;
    case "click":
      tone(1200, 0.03, { type: "square", gain: 0.02 });
      break;
    case "rare":
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.35, { type: "sine", gain: 0.05, delay: i * 0.07 }));
      break;
  }
}
