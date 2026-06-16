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
  src.stop(t + dur); // deterministic release so the node is freed promptly
}

/**
 * Pitch-sliding tone: glides the frequency f0→f1 (linear) while the amplitude
 * decays. Powers the idol theme's kick pitch-fall (100→40Hz) and the vocal
 * lead's portamento "scoop" (歌声のうねり). `glide` lets the pitch settle faster
 * than the note's full length.
 */
function slideTone(
  f0: number,
  f1: number,
  dur: number,
  type: OscillatorType = "square",
  vol = 0.3,
  when = 0,
  glide = dur,
): void {
  const c = getCtx();
  if (!c || !master || muted) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.linearRampToValueAtTime(Math.max(1, f1), t + Math.min(glide, dur));
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur);
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

// Casino: bright C-major loop (I vi IV V) — upbeat, "lucky" feel.
const CASINO_PROG: Chord[] = [
  { root: 130.81, fifth: 196.0, arp: [261.63, 329.63, 392.0, 523.25] }, // C
  { root: 110.0, fifth: 164.81, arp: [220.0, 329.63, 440.0, 659.25] }, // Am
  { root: 174.61, fifth: 261.63, arp: [349.23, 440.0, 523.25, 698.46] }, // F
  { root: 196.0, fifth: 293.66, arp: [392.0, 493.88, 587.33, 783.99] }, // G
  { root: 130.81, fifth: 196.0, arp: [261.63, 329.63, 392.0, 523.25] }, // C
  { root: 110.0, fifth: 164.81, arp: [220.0, 329.63, 440.0, 659.25] }, // Am
  { root: 174.61, fifth: 261.63, arp: [349.23, 440.0, 523.25, 698.46] }, // F
  { root: 196.0, fifth: 293.66, arp: [392.0, 493.88, 587.33, 783.99] }, // G
];

// Forge: D-dorian, heavy and patient — anvil percussion added in bgmTick.
const FORGE_PROG: Chord[] = [
  { root: 73.42, fifth: 110.0, arp: [146.83, 220.0, 293.66, 220.0] }, // Dm
  { root: 73.42, fifth: 110.0, arp: [146.83, 220.0, 293.66, 220.0] }, // Dm
  { root: 87.31, fifth: 130.81, arp: [174.61, 261.63, 349.23, 261.63] }, // F
  { root: 98.0, fifth: 146.83, arp: [196.0, 293.66, 392.0, 293.66] }, // G
  { root: 73.42, fifth: 110.0, arp: [146.83, 220.0, 293.66, 220.0] }, // Dm
  { root: 65.41, fifth: 98.0, arp: [130.81, 196.0, 261.63, 196.0] }, // C
  { root: 87.31, fifth: 130.81, arp: [174.61, 261.63, 349.23, 261.63] }, // F
  { root: 73.42, fifth: 110.0, arp: [146.83, 220.0, 293.66, 220.0] }, // Dm
];

// Idol: 王道進行 (F G Em Am) ベースのアゲアゲなアイドルポップ。8小節サイクルの
// 後半で C を差して持ち上げる。arp[0..2] は各コードのトライアド（バッキング＆
// 高速アルペジオが使用）。
const IDOL_PROG: Chord[] = [
  { root: 87.31, fifth: 130.81, arp: [349.23, 440.0, 523.25, 440.0] }, // F  (F A C)
  { root: 98.0, fifth: 146.83, arp: [392.0, 493.88, 587.33, 493.88] }, // G  (G B D)
  { root: 82.41, fifth: 123.47, arp: [329.63, 392.0, 493.88, 392.0] }, // Em (E G B)
  { root: 110.0, fifth: 164.81, arp: [440.0, 523.25, 659.25, 523.25] }, // Am (A C E)
  { root: 87.31, fifth: 130.81, arp: [349.23, 440.0, 523.25, 440.0] }, // F
  { root: 98.0, fifth: 146.83, arp: [392.0, 493.88, 587.33, 493.88] }, // G
  { root: 65.41, fifth: 98.0, arp: [261.63, 329.63, 392.0, 329.63] }, // C  (C E G)
  { root: 98.0, fifth: 146.83, arp: [392.0, 493.88, 587.33, 493.88] }, // G
];

// Catchy 4-bar vocal hook (64 steps), reused over each half of the progression.
// 0 = rest. Played as `square` with a short portamento scoop per note.
const IDOL_LEAD: number[] = [
  // bar A (over F): G A C A
  392.0, 0, 0, 0, 440.0, 0, 0, 0, 523.25, 0, 0, 0, 440.0, 0, 0, 0,
  // bar B (over G): B D B A G
  493.88, 0, 0, 0, 587.33, 0, 0, 0, 493.88, 0, 440.0, 0, 392.0, 0, 0, 0,
  // bar C (over Em): E G B C B G
  329.63, 0, 392.0, 0, 493.88, 0, 0, 0, 523.25, 0, 493.88, 0, 392.0, 0, 0, 0,
  // bar D (over Am): A C E D C A
  440.0, 0, 523.25, 0, 659.25, 0, 0, 0, 587.33, 0, 523.25, 0, 440.0, 0, 0, 0,
];

export type BgmTheme = "dungeon" | "world" | "casino" | "forge" | "boss" | "idol";
interface ThemeDef {
  stepMs: number;
  prog: Chord[];
  metal?: boolean;
  idol?: boolean;
}
const THEMES: Record<BgmTheme, ThemeDef> = {
  dungeon: { stepMs: 150, prog: PROG },
  world: { stepMs: 142, prog: PROG },
  boss: { stepMs: 124, prog: PROG },
  casino: { stepMs: 132, prog: CASINO_PROG },
  forge: { stepMs: 172, prog: FORGE_PROG, metal: true },
  // BPM≈178 → 16分音符 ≈ 84ms。専用レンダラ idolTick が全パートを担当。
  idol: { stepMs: 84, prog: IDOL_PROG, idol: true },
};
let bgmTheme: BgmTheme = "dungeon";
let bgmTranspose = 1;

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

// Warm detuned-sine pad (two oscillators a few cents apart) for chord body.
function pad(freq: number, dur: number, vol: number, when = 0): void {
  tone(freq, dur, "sine", vol, when);
  tone(freq * DETUNE, dur, "sine", vol, when);
}

// Note with delay taps (echo): each tap later and quieter.
function echoTone(
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  when = 0,
  taps = 2,
  spread = 0.1,
  decay = 0.5,
): void {
  for (let i = 0; i <= taps; i++) tone(freq, dur, type, vol * Math.pow(decay, i), when + i * spread);
}

// Dispatcher: each theme has its own full-band renderer; all share one step clock.
function bgmTick(): void {
  if (muted) return;
  const def = THEMES[bgmTheme];
  if (def.idol) idolTick();
  else if (def.metal) forgeTick();
  else dungeonTick(); // dungeon / world / boss (variants inside)
  bgmStep = (bgmStep + 1) % (BAR * LOOP_BARS);
}

// ===== Dungeon / World / Boss renderer =====
// One A-minor cycle, layered up: sub-bass with a pitch-drop, detuned pad,
// rotating square arpeggio, echoing lead, and full drums. Boss = faster, with a
// dissonant stab, tom fill and ride; World = brighter with an octave shimmer.
function dungeonTick(): void {
  const def = THEMES[bgmTheme];
  const T = bgmTranspose;
  const step = bgmStep;
  const bar = Math.floor(step / BAR);
  const inBar = step % BAR;
  const mode = sectionOf(bar);
  const dyn = DYN[mode];
  const chord = def.prog[bar % def.prog.length];
  const secBar = bar % 8;
  const phraseStep = (secBar % 4) * BAR + inBar;
  const duck = inBar === 0 ? 0.6 : 1;
  const isBoss = bgmTheme === "boss";
  const isWorld = bgmTheme === "world";
  const full = mode === "B";

  // ---- Bass: bar head "drops" from the octave (slide) + sine sub; driving pulse on boss ----
  if (inBar === 0) {
    slideTone(chord.root * 2 * T, chord.root * T, 0.42, "triangle", 0.2, 0, 0.07);
    tone(chord.root * T, 0.5, "sine", 0.12);
  }
  if (inBar === 8 && dyn.bassOct) tone(chord.root * (isBoss ? 1 : 2) * T, 0.42, "triangle", 0.13);
  if (inBar === 12 && full) tone(chord.root * T, 0.3, "triangle", 0.11);
  if (isBoss && mode !== "A" && inBar % 2 === 1) tone(chord.root * T, 0.1, "sawtooth", 0.1);

  // ---- Pad: detuned sine root (+fifth fuller); world adds a high shimmer layer ----
  if (inBar === 0) {
    pad(chord.root * T, 1.6, 0.06);
    if (dyn.padFifth) pad(chord.fifth * T, 1.6, 0.05);
    if (isWorld && dyn.padFifth) pad(chord.fifth * 2 * T, 1.8, 0.025);
  }

  // ---- Arpeggio: square 8ths, figure rotates; world doubles an octave up in the chorus ----
  if (dyn.arp && inBar % 2 === 0) {
    const shape = ARP_SHAPES[secBar % ARP_SHAPES.length];
    const note = chord.arp[shape[(step >> 1) & 3]];
    const v = dyn.arpVol * duck;
    if (note) {
      tone(note * T, 0.12, "square", v);
      if (dyn.arpGhost) tone(note * T, 0.1, "square", v * 0.4, 0.075);
      if (isWorld && full) tone(note * 2 * T, 0.08, "square", v * 0.5, 0.04);
    }
  }

  // ---- Lead: sparse melody with echo taps (tighter, harsher on boss) ----
  if (dyn.lead) {
    const note = LEAD_PHRASE[phraseStep];
    if (note) echoTone(note * T, 0.26, "square", 0.12, 0, isBoss ? 1 : 2, isBoss ? 0.09 : 0.12, 0.45);
  }

  // ---- Boss extras: tritone stab on chorus heads + tom fill before the loop ----
  if (isBoss) {
    if (full && inBar === 0) {
      tone(chord.root * 1.5 * T, 0.2, "sawtooth", 0.1);
      tone(chord.root * 1.5 * 1.41 * T, 0.2, "sawtooth", 0.07); // ~tritone bite
    }
    if (full && secBar === 7 && inBar >= 12) {
      const toms = [196, 165, 147, 110];
      const f = toms[inBar - 12] ?? 110;
      slideTone(f * 2 * T, f * T, 0.11, "triangle", 0.15);
    }
  }

  // ---- Percussion: kick (+sub pitch-fall), off-beat hats, chorus snare, boss ride 8ths ----
  if (inBar === 0 || (dyn.kickMid && inBar === 8)) {
    noise(0.05, 0.18);
    slideTone(95 * T, 42 * T, 0.1, "sine", 0.2);
  }
  if (dyn.hat && inBar % 2 === 1) noise(0.025, isBoss ? 0.08 : 0.06);
  if (full && (inBar === 4 || inBar === 12)) {
    noise(0.14, 0.14);
    tone(190 * T, 0.1, "triangle", 0.1);
  }
  if (isBoss && mode !== "A" && inBar % 2 === 0) noise(0.018, 0.035);
}

// ===== Forge renderer =====
// Heavy, patient D-dorian: detuned-saw drone + deep sub, half-time kick, an anvil
// clank with metallic overtones and a ringing echo tail, and a slow hammer-fall
// lead (pitch drop). Builds with the section dynamics like the others.
function forgeTick(): void {
  const def = THEMES.forge;
  const T = bgmTranspose;
  const step = bgmStep;
  const bar = Math.floor(step / BAR);
  const inBar = step % BAR;
  const mode = sectionOf(bar);
  const dyn = DYN[mode];
  const chord = def.prog[bar % def.prog.length];
  const secBar = bar % 8;
  const phraseStep = (secBar % 4) * BAR + inBar;
  const full = mode === "B";

  // ---- Drone bass: detuned saw + deep sub, sustained across the bar ----
  if (inBar === 0) {
    tone(chord.root * T, 1.7, "sawtooth", 0.1);
    tone(chord.root * 1.008 * T, 1.7, "sawtooth", 0.09);
    tone(chord.root * 0.5 * T, 1.7, "sine", 0.12);
  }
  if (inBar === 8) tone(chord.root * T, 0.5, "triangle", 0.12);
  if (inBar === 0 && dyn.padFifth) pad(chord.fifth * T, 1.7, 0.05);

  // ---- Half-time heavy kick + sub thump ----
  if (inBar === 0 || (full && inBar === 8)) {
    noise(0.06, 0.2);
    slideTone(85 * T, 36 * T, 0.14, "sine", 0.22);
  }

  // ---- Anvil clank: metallic stack + ringing overtone echo, on each half-bar ----
  if (inBar === 0 || inBar === 8) {
    noise(0.03, 0.13);
    tone(1568, 0.06, "square", 0.06);
    tone(2093, 0.05, "square", 0.035, 0.01);
    echoTone(3136, 0.04, "square", 0.03, 0.02, 2, 0.12, 0.5);
  }
  if (full && (inBar === 4 || inBar === 12)) {
    tone(2349, 0.04, "square", 0.04);
    noise(0.02, 0.05);
  }

  // ---- Slow hammer-fall lead (pitch drop), only in fuller sections ----
  if (dyn.lead) {
    const note = LEAD_PHRASE[phraseStep];
    if (note) slideTone(note * 1.5 * T, note * T, 0.3, "square", 0.1, 0, 0.06);
  }

  // ---- Off-beat hat shimmer in the chorus ----
  if (dyn.hat && inBar % 2 === 1) noise(0.02, 0.05);
}

// ===== Idol theme renderer =====
// 王道進行のアイドルポップを 16bit ゲーム音源風に。A(Aメロ)→A2(Bメロ/ビルドアップ)
// →B(サビ)→A'(間奏) の起伏を、各パートの ON/OFF と音量で表現する。
function idolTick(): void {
  if (muted) return;
  const def = THEMES.idol;
  const T = bgmTranspose;
  const step = bgmStep;
  const bar = Math.floor(step / BAR);
  const inBar = step % BAR;
  const mode = sectionOf(bar);
  const chord = def.prog[bar % def.prog.length];
  const secPos = bar % 8; // 0..7 — どのセクションも8小節構成

  const isVerse = mode === "A";
  const isBuild = mode === "A2";
  const isChorus = mode === "B";

  const kickStep = inBar % 4 === 0; // 0,4,8,12
  const hatStep = inBar % 4 === 2; // 2,6,10,14 (裏打ち)
  const snareStep = inBar === 4 || inBar === 12;

  // ---- ① ドラム ----
  // キック: ノイズの急速減衰 + ピッチフォール(100→40Hz)で重低音。A2は抜く(解放感)。
  if (!isBuild && kickStep) {
    noise(0.05, 0.2);
    slideTone(100 * T, 40 * T, 0.12, "sine", 0.22);
  }
  // ハット: 極短ノイズの裏打ち。
  if (hatStep) noise(0.03, isChorus ? 0.09 : 0.06);
  // スネア: ノイズ + 180Hz の胴鳴り。
  if (!isBuild && snareStep) {
    noise(0.15, 0.16);
    tone(180 * T, 0.12, "triangle", 0.12);
  }
  // A2 ビルドアップ: 後半2小節でスネアロール + 上昇スイープ(しょわ〜)。
  if (isBuild) {
    const build = secPos / 7; // 0→1
    if (secPos >= 6) {
      noise(0.04, 0.05 + build * 0.22); // 16分スネアロール(音量上昇)
      slideTone(400 * T, 1600 * T, 0.08, "sawtooth", 0.04 + build * 0.05); // riser
    } else if (kickStep) {
      noise(0.03, 0.05 + build * 0.06); // 拍を保つ軽いパルス
    }
  }

  // ---- ② ベース(オクターブ奏法) ----
  // 偶数=ルート低音 / 奇数=1オクターブ上、頭に square のアタックを重ねる。
  const bassVol = isChorus ? 0.22 : isVerse ? 0.16 : 0.18;
  const bf = (inBar % 2 === 0 ? chord.root : chord.root * 2) * T;
  tone(bf, 0.13, "sawtooth", bassVol);
  tone(bf, 0.02, "square", bassVol * 0.6); // ポコッとしたアタック

  // ---- ③ バッキング(デチューンsaw和音) + 擬似サイドチェイン ----
  // Aメロは半分の密度。サビはキック位置で発音をスキップしてダッキング(ポンプ感)。
  if (!isVerse || inBar % 2 === 0) {
    const duck = isChorus && kickStep; // サビはキックで完全に抜く
    if (!duck) {
      const base = isChorus ? 0.07 : isBuild ? 0.04 + (secPos / 7) * 0.04 : 0.045;
      const bv = base * (kickStep ? 0.5 : 1); // サビ以外も拍頭は軽く下げる
      for (let i = 0; i < 3; i++) {
        const f = chord.arp[i] * T;
        tone(f, 0.1, "sawtooth", bv);
        tone(f * 1.005, 0.1, "sawtooth", bv); // ~5Hzデチューンで厚み
      }
    }
  }

  // ---- ④ キラキラ(超高速アルペジオ + エコー) サビのみ ----
  if (isChorus) {
    const stepSec = def.stepMs / 1000;
    for (let i = 0; i < 4; i++) {
      const f = chord.arp[i] * 2 * T; // 1オクターブ上のトライアド
      const when = (i / 4) * stepSec; // 1ステップに4音を詰める
      tone(f, 0.05, "square", 0.05, when);
      tone(f, 0.05, "square", 0.025, when + 0.02); // ディレイ(エコー)
    }
  }

  // ---- ⑤ 金コン(カウベル) セクション切替直前に「ピーン！」 ----
  if (secPos === 7 && inBar === 15) {
    tone(800 * T, 0.35, "sine", 0.16);
    tone(1230 * T, 0.35, "sine", 0.12); // 不協和な超高音アクセント
  }

  // ---- 主旋律(ボーカル): square + ポルタメントの「うねり」 ----
  // サビ全開、Bメロ後半から歌い出す。
  const leadOn = isChorus || (isBuild && secPos >= 4);
  if (leadOn) {
    const phraseStep = (bar % 4) * BAR + inBar;
    const note = IDOL_LEAD[phraseStep];
    if (note) {
      const lv = isChorus ? 0.14 : 0.09;
      slideTone(note * 0.985 * T, note * T, 0.26, "square", lv, 0, 0.04); // しゃくり
    }
  }
}

// Whether the player WANTS music on (independent of the timer, which we pause
// while the tab is hidden so the synth stops generating nodes in the background).
let bgmPlaying = false;
let visHooked = false;

function startTimer(): void {
  if (bgmTimer != null) return;
  bgmTimer = setInterval(bgmTick, THEMES[bgmTheme].stepMs);
}
function clearTimer(): void {
  if (bgmTimer != null) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

// Pause the BGM synth while the tab is backgrounded; resume on return. A long
// auto-battle session left in a background tab otherwise keeps spawning hundreds
// of audio nodes per second, bloating memory and stalling the tab on return.
function ensureVisibilityHook(): void {
  if (visHooked || typeof document === "undefined") return;
  visHooked = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimer();
    else if (bgmPlaying && !muted) startTimer();
  });
}

export function startBgm(): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  ensureVisibilityHook();
  bgmPlaying = true;
  if (bgmTimer != null) return;
  bgmStep = 0;
  startTimer();
}

/** Switch BGM theme (and optional pitch transpose for deeper chapters). */
export function setBgmTheme(theme: BgmTheme, transpose = 1): void {
  if (theme === bgmTheme && Math.abs(transpose - bgmTranspose) < 0.001) return;
  bgmTheme = theme;
  bgmTranspose = transpose;
  bgmStep = 0;
  // Only (re)start the timer if music is wanted and the tab is visible.
  clearTimer();
  if (bgmPlaying && !muted && (typeof document === "undefined" || !document.hidden)) {
    startTimer();
  }
}

export function stopBgm(): void {
  bgmPlaying = false;
  clearTimer();
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
