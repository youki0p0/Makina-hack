// Tiny chiptune (16-bit-ish) audio engine built on the Web Audio API.
// No asset files: all BGM and SFX are synthesized procedurally.

const MUTE_KEY = "dice-hackslash-muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let bgmTimer: ReturnType<typeof setInterval> | null = null;
let bgmStep = 0;
let initialized = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  if (!initialized) {
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
    initialized = true;
  }
  return muted;
}

/** Resume the audio context (must be called from a user gesture). */
export function initAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
  isMuted();
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "square",
  vol = 0.3,
  when = 0,
): void {
  const c = getCtx();
  if (!c || !master || muted) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur);
}

function noise(dur: number, vol = 0.3): void {
  const c = getCtx();
  if (!c || !master || muted) return;
  const t = c.currentTime;
  const len = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g);
  g.connect(master);
  src.start(t);
}

export type Sfx =
  | "hit"
  | "hurt"
  | "crit"
  | "heal"
  | "select"
  | "roll"
  | "win"
  | "lose"
  | "coin";

export function sfx(kind: Sfx): void {
  switch (kind) {
    case "hit":
      tone(330, 0.07, "square", 0.28);
      tone(220, 0.06, "square", 0.2, 0.02);
      break;
    case "hurt":
      tone(140, 0.14, "sawtooth", 0.28);
      break;
    case "crit":
      noise(0.16, 0.22);
      tone(440, 0.1, "square", 0.3);
      tone(660, 0.1, "square", 0.25, 0.06);
      break;
    case "heal":
      tone(523, 0.1, "sine", 0.25);
      tone(784, 0.12, "sine", 0.25, 0.08);
      break;
    case "select":
      tone(520, 0.05, "square", 0.2);
      break;
    case "roll":
      tone(740, 0.04, "square", 0.15);
      tone(880, 0.04, "square", 0.15, 0.04);
      break;
    case "coin":
      tone(988, 0.05, "square", 0.2);
      tone(1319, 0.08, "square", 0.2, 0.05);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "square", 0.25, i * 0.12));
      break;
    case "lose":
      [392, 330, 262].forEach((f, i) => tone(f, 0.22, "triangle", 0.25, i * 0.16));
      break;
  }
}

// ===== BGM: a looping chiptune in A minor (square lead + triangle bass) =====

const LEAD: number[] = [
  440, 0, 523, 0, 659, 0, 523, 0,
  587, 0, 523, 0, 440, 0, 392, 0,
  440, 0, 659, 0, 880, 0, 659, 0,
  587, 0, 523, 0, 494, 0, 440, 0,
];
const BASS: number[] = [
  110, 0, 0, 0, 87.31, 0, 0, 0,
  98, 0, 0, 0, 82.41, 0, 0, 0,
  110, 0, 0, 0, 87.31, 0, 0, 0,
  98, 0, 0, 98, 110, 0, 0, 0,
];

function bgmTick(): void {
  if (muted) return;
  const i = bgmStep % LEAD.length;
  if (LEAD[i]) tone(LEAD[i], 0.13, "square", 0.14);
  if (BASS[i]) tone(BASS[i], 0.18, "triangle", 0.2);
  bgmStep++;
}

export function startBgm(): void {
  if (muted || bgmTimer != null) return;
  const c = getCtx();
  if (!c) return;
  bgmStep = 0;
  bgmTimer = setInterval(bgmTick, 150);
}

export function stopBgm(): void {
  if (bgmTimer != null) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

export function setMuted(m: boolean): void {
  muted = m;
  initialized = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  }
  if (m) {
    stopBgm();
  } else {
    startBgm();
  }
}
