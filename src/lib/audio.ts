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

// ===== BGM: "The Sunless Vault" — a long-form A-minor dungeon loop =====
// 1 bar = 16 steps @ 150ms. Loop = 32 bars (~77s) that build A → A2 → B → A'.
// Layers: triangle bass pedal, detuned-sine pad, square arpeggio, sparse
// square lead, and noise percussion — all via the existing tone()/noise().

const BAR = 16;
const LOOP_BARS = 32;
const DETUNE = 1.006; // ~+10 cent chorus for the pad

interface Chord {
  root: number;
  fifth: number;
  arp: [number, number, number, number];
}

// 8-bar chord cycle: Am F Dm Esus | Am F G Am (i ♭VI iv v / i ♭VI ♭VII i).
const PROG: Chord[] = [
  { root: 110.0, fifth: 164.81, arp: [261.63, 329.63, 523.25, 329.63] }, // Am
  { root: 87.31, fifth: 130.81, arp: [261.63, 349.23, 523.25, 349.23] }, // F
  { root: 73.42, fifth: 110.0, arp: [174.61, 220.0, 349.23, 220.0] }, // Dm
  { root: 82.41, fifth: 123.47, arp: [246.94, 329.63, 493.88, 329.63] }, // E (no 3rd)
  { root: 110.0, fifth: 164.81, arp: [261.63, 329.63, 523.25, 329.63] }, // Am
  { root: 87.31, fifth: 130.81, arp: [261.63, 349.23, 523.25, 349.23] }, // F (♭VI)
  { root: 98.0, fifth: 146.83, arp: [246.94, 293.66, 587.33, 293.66] }, // G (♭VII)
  { root: 110.0, fifth: 164.81, arp: [261.63, 329.63, 523.25, 329.63] }, // Am
];

// Arpeggio figures (indices into chord.arp), rotated every bar for variety.
const ARP_SHAPES: number[][] = [
  [0, 1, 2, 1],
  [0, 2, 1, 1],
  [2, 1, 0, 1],
  [0, 1, 3, 2],
];

// Sparse 4-bar lead phrase (64 steps), used in A2/B. 0 = rest.
const LEAD_PHRASE: number[] = [
  440, 0, 0, 0, 523.25, 0, 0, 0, 659.25, 0, 0, 0, 0, 0, 0, 0,
  587.33, 0, 0, 0, 523.25, 0, 0, 0, 440, 0, 0, 0, 392.0, 0, 0, 0,
  440, 0, 0, 0, 659.25, 0, 0, 0, 880, 0, 0, 0, 0, 0, 0, 0,
  659.25, 0, 0, 0, 587.33, 0, 0, 0, 493.88, 0, 0, 0, 440, 0, 0, 0,
];

type Mode = "A" | "A2" | "B" | "Ap";
function sectionOf(bar: number): Mode {
  const b = bar % LOOP_BARS;
  if (b < 8) return "A";
  if (b < 16) return "A2";
  if (b < 24) return "B";
  return "Ap";
}

interface Dyn {
  padFifth: boolean;
  arp: boolean;
  arpGhost: boolean;
  lead: boolean;
  hat: boolean;
  kickMid: boolean;
  bassOct: boolean;
  arpVol: number;
}
const DYN: Record<Mode, Dyn> = {
  A: { padFifth: false, arp: false, arpGhost: false, lead: false, hat: false, kickMid: false, bassOct: false, arpVol: 0 },
  A2: { padFifth: true, arp: true, arpGhost: false, lead: true, hat: false, kickMid: false, bassOct: true, arpVol: 0.07 },
  B: { padFifth: true, arp: true, arpGhost: true, lead: true, hat: true, kickMid: true, bassOct: true, arpVol: 0.1 },
  Ap: { padFifth: true, arp: true, arpGhost: false, lead: false, hat: false, kickMid: false, bassOct: true, arpVol: 0.05 },
};

function bgmTick(): void {
  if (muted) return;
  const step = bgmStep;
  const bar = Math.floor(step / BAR);
  const inBar = step % BAR;
  const mode = sectionOf(bar);
  const dyn = DYN[mode];
  const chord = PROG[bar % PROG.length];
  const secBar = bar % 8;
  const phraseStep = (secBar % 4) * BAR + inBar;
  // Duck other voices on the bar head where pad + kick already stack.
  const duck = inBar === 0 ? 0.6 : 1;

  // Bass: root pedal + octave, with a small mid-bar pulse in section B.
  if (inBar === 0) tone(chord.root, 0.45, "triangle", 0.2);
  if (inBar === 8 && dyn.bassOct) tone(chord.root * 2, 0.45, "triangle", 0.13);
  if (inBar === 12 && mode === "B") tone(chord.root, 0.3, "triangle", 0.11);

  // Pad: detuned sine, root (+fifth in fuller sections) on each chord change.
  if (inBar === 0) {
    tone(chord.root, 1.6, "sine", 0.06);
    tone(chord.root * DETUNE, 1.6, "sine", 0.06);
    if (dyn.padFifth) {
      tone(chord.fifth, 1.6, "sine", 0.05);
      tone(chord.fifth * DETUNE, 1.6, "sine", 0.05);
    }
  }

  // Arpeggio: square eighth-notes following the chord, figure rotates per bar.
  if (dyn.arp && inBar % 2 === 0) {
    const shape = ARP_SHAPES[secBar % ARP_SHAPES.length];
    const note = chord.arp[shape[(step >> 1) & 3]];
    const v = dyn.arpVol * duck;
    if (note) {
      tone(note, 0.12, "square", v);
      if (dyn.arpGhost) tone(note, 0.1, "square", v * 0.4, 0.075);
    }
  }

  // Lead: sparse square melody, with a faint vibrato tail in section B.
  if (dyn.lead) {
    const note = LEAD_PHRASE[phraseStep];
    if (note) {
      tone(note, 0.26, "square", 0.12);
      if (mode === "B" && inBar === 12) tone(note * 1.01, 0.26, "square", 0.05, 0.1);
    }
  }

  // Percussion: kick (+sub) on bar head; mid-bar kick & off-beat hats in B.
  if (inBar === 0 || (dyn.kickMid && inBar === 8)) {
    noise(0.05, 0.18);
    tone(55, 0.08, "sine", 0.2);
  }
  if (dyn.hat && inBar % 2 === 1) noise(0.025, 0.06);

  bgmStep = (bgmStep + 1) % (BAR * LOOP_BARS);
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
