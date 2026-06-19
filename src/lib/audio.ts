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

// ===== Spatial helpers (stereo pan + shared reverb send) =====
// Used by the idol (casino) theme to give it width and air. A single convolver
// with a synthesized impulse is shared by all reverb-sent voices.

function clampPan(p: number): number {
  return Math.max(-1, Math.min(1, p));
}

let reverbBus: GainNode | null = null;
function makeImpulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = c.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = c.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}
function getReverbBus(): GainNode | null {
  const c = getCtx();
  if (!c || !master) return null;
  if (reverbBus) return reverbBus;
  const input = c.createGain();
  const conv = c.createConvolver();
  conv.buffer = makeImpulse(c, 1.5, 2.4);
  const wet = c.createGain();
  wet.gain.value = 0.85;
  input.connect(conv);
  conv.connect(wet);
  wet.connect(master);
  reverbBus = input;
  return reverbBus;
}

/** Route a gain node to master, optionally stereo-panned and with a reverb send. */
function connectOut(c: AudioContext, g: GainNode, pan: number, reverb: number): void {
  let out: AudioNode = g;
  if (pan !== 0 && typeof c.createStereoPanner === "function") {
    const p = c.createStereoPanner();
    p.pan.value = clampPan(pan);
    g.connect(p);
    out = p;
  }
  out.connect(master!);
  if (reverb > 0) {
    const bus = getReverbBus();
    if (bus) {
      const send = c.createGain();
      send.gain.value = reverb;
      out.connect(send);
      send.connect(bus);
    }
  }
}

/** Like tone(), but with stereo pan + optional reverb send. */
function voice(
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  when = 0,
  pan = 0,
  reverb = 0,
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
  connectOut(c, g, pan, reverb);
  osc.start(t);
  osc.stop(t + dur);
}

/** Portamento voice with pan + reverb (for the spacious vocal lead). */
function slideVoice(
  f0: number,
  f1: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  when = 0,
  glide = dur,
  pan = 0,
  reverb = 0,
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
  connectOut(c, g, pan, reverb);
  osc.start(t);
  osc.stop(t + dur);
}

/** Panned noise burst with optional reverb (stereo claps / spacious risers). */
function noisePan(dur: number, vol: number, pan = 0, reverb = 0): void {
  const c = getCtx();
  if (!c || !master || muted) return;
  const t = c.currentTime;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g);
  connectOut(c, g, pan, reverb);
  src.start(t);
  src.stop(t + dur);
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

// ===== Slot (パチスロ) SFX =====
// レバーON / リール停止 / 小役 / リーチ / ボーナス揃い。tone/noise/slideTone で合成。
export type SlotSfx = "lever" | "stop" | "small" | "reach" | "bonus" | "bonusBig" | "pan";

export function slotSfx(kind: SlotSfx): void {
  switch (kind) {
    case "pan": // 台パン: 筐体を殴る鈍い衝撃音
      noise(0.12, 0.4);
      slideTone(160, 50, 0.18, "square", 0.3);
      tone(60, 0.14, "sine", 0.3, 0.01);
      break;
    case "lever": // レバーを下げた「ガコッ」
      noise(0.05, 0.2);
      slideTone(240, 90, 0.13, "square", 0.26);
      tone(70, 0.08, "sine", 0.18, 0.01);
      break;
    case "stop": // リール停止の「ガコン」
      noise(0.03, 0.16);
      tone(180, 0.05, "square", 0.22);
      tone(110, 0.06, "square", 0.16, 0.01);
      break;
    case "small": // 小役の「ピロン↑」
      tone(880, 0.06, "square", 0.2);
      tone(1318, 0.1, "square", 0.2, 0.06);
      break;
    case "reach": // リーチの煽り(上昇サイレン)
      slideTone(400, 1200, 0.6, "sawtooth", 0.12);
      slideTone(404, 1212, 0.6, "sawtooth", 0.1, 0.0);
      noise(0.5, 0.05);
      break;
    case "bonus": // REGULAR 揃い ファンファーレ
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "square", 0.26, i * 0.1));
      break;
    case "bonusBig": // BIG(7/BAR) 揃い 大ファンファーレ
      noise(0.12, 0.18);
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        tone(f, 0.2, "square", 0.28, i * 0.09);
        tone(f * 1.005, 0.2, "square", 0.18, i * 0.09); // 厚み
      });
      tone(1047, 0.3, "square", 0.22, 0.5);
      tone(1319, 0.36, "square", 0.22, 0.56);
      break;
  }
}

// ===== BGM: "The Sunless Vault" — a long-form A-minor dungeon loop =====
// 1 bar = 16 steps @ 150ms. Loop = 32 bars (~77s) that build A → A2 → B → A'.
// Layers: triangle bass pedal, detuned-sine pad, square arpeggio, sparse
// square lead, and noise percussion — all via the existing tone()/noise().

const BAR = 16;
const LOOP_BARS = 32;
// The final-boss theme runs a longer, self-contained loop with its own dynamics
// (build → climax → quiet breakdown → rebuild → grand climax).
const FINAL_LOOP_BARS = 48;
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

/** Per-chapter battle themes (w1…w11) plus the fixed-location themes. */
export type WorldKey =
  | "w1" | "w2" | "w3" | "w4" | "w5" | "w6" | "w7" | "w8" | "w9" | "w10" | "w11";
export type BgmTheme = "dungeon" | "casino" | "forge" | "boss" | "idol" | "seaIdol" | "final" | "credits" | WorldKey;

// ===== Credits theme: "Running Toward Light" (図鑑のクレジット曲) =====
// 明るくほろ苦い D メジャー。IV→V→vi を多用し、簡単には解決しない。
// 32小節ループ: イントロ4 / Aメロ8 / プリサビ4 / サビ16。BPM132 (16分 = stepMs)。
// 既存エンジン(ファイル不使用・全合成)の流儀でオリジナル作曲を移植したもの。
const CREDITS_STEP_MS = 114; // 16th note @ ~132 BPM

// note-name (例 "F#5") → 周波数。
function noteHz(s: string): number {
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let semis = base[s[0]];
  let i = 1;
  if (s[1] === "#") {
    semis += 1;
    i = 2;
  }
  const oct = parseInt(s.slice(i), 10);
  return hz(12 * (oct + 1) + semis);
}

// 32小節のコード進行(1小節1コード)。ch() は hoist 済みの関数宣言なのでここで使える。
const CREDITS_PROG: Chord[] = [
  ch(59, "min"), ch(55, "maj"), ch(57, "maj"), ch(57, "maj"), // intro: Bm G A A
  ch(50, "maj"), ch(57, "maj"), ch(59, "min"), ch(55, "maj"), // verse A: D A Bm G
  ch(50, "maj"), ch(57, "maj"), ch(55, "maj"), ch(57, "maj"), // verse B: D A G A
  ch(52, "min"), ch(54, "min"), ch(55, "maj"), ch(57, "maj"), // pre-chorus: Em F#m G A
  ch(55, "maj"), ch(57, "maj"), ch(59, "min"), ch(59, "min"), // chorus: G A Bm Bm
  ch(55, "maj"), ch(57, "maj"), ch(50, "maj"), ch(50, "maj"), //         G A D D
  ch(55, "maj"), ch(57, "maj"), ch(59, "min"), ch(57, "maj"), //         G A Bm A
  ch(55, "maj"), ch(57, "maj"), ch(57, "maj"), ch(50, "maj"), //         G A A D
];

type CreditsNote = [string, number]; // [音名 | "r"(休符), 拍数]
// 8つの4小節フレーズ(各16拍)= 作曲した主旋律。
const CREDITS_PHRASES: CreditsNote[][] = [
  // intro lead (Bm G A A)
  [["F#5",1],["D5",1],["F#5",2],["E5",1],["D5",1],["B4",2],["C#5",1],["E5",1],["A4",1],["C#5",1],["E5",2],["r",2]],
  // verse A (D A Bm G)
  [["F#4",1],["A4",1],["D5",1],["A4",0.5],["F#4",0.5],["E4",1],["A4",1],["C#5",1.5],["B4",0.5],["D5",1],["B4",1],["F#4",1],["B4",0.5],["D5",0.5],["B4",1],["D5",1],["E5",1],["D5",1]],
  // verse B (D A G A)
  [["A4",1],["F#4",1],["D4",1],["F#4",1],["E4",1],["A4",1],["C#5",1],["A4",1],["B4",1.5],["A4",0.5],["G4",1],["B4",1],["C#5",1],["B4",1],["A4",1],["E4",1]],
  // pre-chorus (Em F#m G A) — 上昇して緊張を高める
  [["E4",1],["G4",1],["B4",1],["E5",1],["F#4",1],["A4",1],["C#5",1],["F#5",1],["G4",1],["B4",1],["D5",1],["G5",1],["A4",1],["C#5",1],["E5",1],["A5",1]],
  // chorus A (G A Bm Bm)
  [["D5",2],["E5",1],["D5",1],["C#5",2],["E5",2],["F#5",2],["E5",1],["D5",1],["B4",2],["D5",2]],
  // chorus B (G A D D)
  [["D5",1],["E5",1],["G5",2],["F#5",2],["E5",2],["D5",2],["A4",1],["D5",1],["F#5",4]],
  // chorus C (G A Bm A)
  [["B4",1],["D5",1],["E5",2],["C#5",1],["E5",1],["A5",2],["F#5",2],["D5",2],["E5",2],["C#5",1],["E5",1]],
  // chorus D (G A A D) — 最後にだけ I(D) へ解決
  [["D5",1],["E5",1],["F#5",1],["G5",1],["A5",2],["E5",2],["F#5",2],["E5",1],["C#5",1],["D5",4]],
];

// フレーズ列を 512 ステップ(=32小節×16)の「ステップ→周波数/長さ」表に展開。
function buildCreditsLead(): { freq: number[]; dur: number[] } {
  const total = BAR * LOOP_BARS; // 512 steps
  const freq = new Array<number>(total).fill(0);
  const dur = new Array<number>(total).fill(0);
  const secPerBeat = (CREDITS_STEP_MS / 1000) * 4; // 1拍 = 4ステップ
  let beat = 0;
  for (const phrase of CREDITS_PHRASES) {
    for (const [name, d] of phrase) {
      if (name !== "r") {
        const stepIdx = Math.round(beat * 4) % total;
        freq[stepIdx] = noteHz(name);
        dur[stepIdx] = d * secPerBeat;
      }
      beat += d;
    }
  }
  return { freq, dur };
}
const CREDITS_LEAD = buildCreditsLead();

function creditsSection(bar: number): "intro" | "verse" | "pre" | "chorus" {
  if (bar < 4) return "intro";
  if (bar < 12) return "verse";
  if (bar < 16) return "pre";
  return "chorus";
}

interface ThemeDef {
  stepMs: number;
  prog: Chord[];
  metal?: boolean;
  idol?: boolean;
  casino?: boolean;
  credits?: boolean;
  /** 海っぽいリカラー（idolTick に波/マリンベル/明るいシマーを足す）。 */
  sea?: boolean;
}
const THEMES: Record<"dungeon" | "casino" | "forge" | "boss" | "idol" | "seaIdol" | "credits", ThemeDef> = {
  dungeon: { stepMs: 150, prog: PROG },
  boss: { stepMs: 124, prog: PROG },
  credits: { stepMs: CREDITS_STEP_MS, prog: CREDITS_PROG, credits: true },
  // 落ち着いた煌びやかなラウンジ。専用レンダラ casinoTick が担当(通常カジノBGM)。
  casino: { stepMs: 162, prog: CASINO_PROG, casino: true },
  forge: { stepMs: 172, prog: FORGE_PROG, metal: true },
  // BPM≈178 → 16分音符 ≈ 84ms。専用レンダラ idolTick(BIG中=ダイスラッシュ専用BGM)。
  idol: { stepMs: 84, prog: IDOL_PROG, idol: true },
  // 同じ Idol 曲(同BPM/同進行)を海っぽくリカラー＝甘ダイス連チャン用BGM。
  seaIdol: { stepMs: 84, prog: IDOL_PROG, idol: true, sea: true },
};
let bgmTheme: BgmTheme = "dungeon";
let bgmTranspose = 1;

// ===== Per-world battle music (場所コンセプトのオリジナル曲) =====
// Each chapter gets its own composition: a key/progression for mood, a tempo,
// instrument timbres and feature flags (pad / bell / choir / drone / arp / drum
// style / reverb). One flexible renderer (worldTick) turns a config into a track,
// so all 11 worlds sound distinct and match their location concept.

/** MIDI note → frequency (A4 = 69 = 440Hz). */
function hz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
/** Build a chord (low root + fifth + a mid-octave triad arp) from a MIDI root. */
function ch(rootMidi: number, quality: "min" | "maj" | "sus" | "dom"): Chord {
  const third = quality === "maj" || quality === "dom" ? 4 : quality === "sus" ? 5 : 3;
  return {
    root: hz(rootMidi),
    fifth: hz(rootMidi + 7),
    arp: [hz(rootMidi + 12 + third), hz(rootMidi + 19), hz(rootMidi + 24), hz(rootMidi + 19)],
  };
}

type DrumStyle = "none" | "soft" | "march" | "drive" | "techno";
interface WorldMusic {
  name: string;
  desc: string;
  stepMs: number;
  prog: Chord[];
  bassWave: OscillatorType;
  arpWave: OscillatorType;
  drums: DrumStyle;
  pad?: boolean;
  bell?: boolean;
  choir?: boolean;
  drone?: boolean;
  arp?: boolean;
  arpRate?: number; // steps per arp note (1 = 16ths, 2 = 8ths)
  lead?: boolean;
  reverb?: number;
}

const WORLD_MUSIC: Record<WorldKey, WorldMusic> = {
  // 1 始まりの草原 — bright pastoral D major, gentle.
  w1: {
    name: "始まりの草原", desc: "明るく牧歌的なD majorのフィールド曲",
    stepMs: 150, prog: [ch(50, "maj"), ch(45, "maj"), ch(47, "min"), ch(43, "maj"), ch(50, "maj"), ch(45, "maj"), ch(43, "maj"), ch(45, "maj")],
    bassWave: "triangle", arpWave: "square", drums: "soft", pad: true, arp: true, arpRate: 2, lead: true, reverb: 0.12,
  },
  // 2 深き洞窟 — dark, slow A minor; dripping bells + low drone, very sparse.
  w2: {
    name: "深き洞窟", desc: "暗く緩やかなA minor。水滴のベルと低いドローン",
    stepMs: 182, prog: [ch(45, "min"), ch(41, "maj"), ch(38, "min"), ch(40, "min"), ch(45, "min"), ch(48, "maj"), ch(41, "maj"), ch(40, "min")],
    bassWave: "triangle", arpWave: "sine", drums: "none", pad: true, bell: true, drone: true, reverb: 0.42,
  },
  // 3 古代遺跡 — grand E Phrygian march, brass-ish saws.
  w3: {
    name: "古代遺跡", desc: "荘厳なEフリジアンの行進曲。ブラス風のこぎり波",
    stepMs: 150, prog: [ch(40, "min"), ch(41, "maj"), ch(43, "maj"), ch(40, "min"), ch(40, "min"), ch(45, "min"), ch(41, "maj"), ch(40, "min")],
    bassWave: "sawtooth", arpWave: "sawtooth", drums: "march", pad: true, arp: true, arpRate: 2, lead: true, reverb: 0.24,
  },
  // 4 氷結世界 — crystalline B minor, suspended chords, shimmering bells.
  w4: {
    name: "氷結世界", desc: "硝子のように冷たいB minor。煌めくベルとサス和音",
    stepMs: 158, prog: [ch(47, "min"), ch(43, "maj"), ch(50, "maj"), ch(45, "sus"), ch(47, "min"), ch(42, "min"), ch(43, "maj"), ch(45, "sus")],
    bassWave: "triangle", arpWave: "triangle", drums: "soft", pad: true, bell: true, choir: true, arp: true, arpRate: 2, reverb: 0.46,
  },
  // 5 灼熱火山 — aggressive driving E minor, fast, harsh.
  w5: {
    name: "灼熱火山", desc: "獰猛で疾走するE minor。歪んだベースと突進ドラム",
    stepMs: 118, prog: [ch(40, "min"), ch(48, "maj"), ch(43, "maj"), ch(50, "maj"), ch(40, "min"), ch(41, "maj"), ch(45, "min"), ch(47, "maj")],
    bassWave: "sawtooth", arpWave: "square", drums: "drive", arp: true, arpRate: 1, lead: true, reverb: 0.08,
  },
  // 6 奈落 — ominous, slow, dissonant D minor drone.
  w6: {
    name: "奈落", desc: "不穏でゆったりとしたD minor。不協和音とドローン",
    stepMs: 178, prog: [ch(38, "min"), ch(44, "min"), ch(38, "min"), ch(46, "maj"), ch(38, "min"), ch(39, "maj"), ch(44, "min"), ch(38, "min")],
    bassWave: "sawtooth", arpWave: "sawtooth", drums: "none", pad: true, drone: true, reverb: 0.4,
  },
  // 7 天界 — radiant C major, airy choir + bells.
  w7: {
    name: "天界", desc: "荘厳で晴れやかなC major。聖歌隊の声とベル",
    stepMs: 152, prog: [ch(48, "maj"), ch(43, "maj"), ch(45, "min"), ch(41, "maj"), ch(48, "maj"), ch(50, "maj"), ch(43, "dom"), ch(48, "maj")],
    bassWave: "sine", arpWave: "sine", drums: "soft", pad: true, bell: true, choir: true, arp: true, arpRate: 2, lead: true, reverb: 0.5,
  },
  // 8 星界 — dreamy F# minor, fast twinkling arps, deep reverb.
  w8: {
    name: "星界", desc: "幻想的なF# minor。瞬く高速アルペジオと深い残響",
    stepMs: 104, prog: [ch(42, "min"), ch(50, "maj"), ch(45, "maj"), ch(40, "maj"), ch(42, "min"), ch(37, "maj"), ch(44, "min"), ch(45, "maj")],
    bassWave: "triangle", arpWave: "triangle", drums: "soft", bell: true, arp: true, arpRate: 1, reverb: 0.46,
  },
  // 9 虚無 — ambient drone, minimal, almost no rhythm.
  w9: {
    name: "虚無", desc: "アンビエントなドローン。リズムは希薄、漂う無音の音楽",
    stepMs: 196, prog: [ch(45, "min"), ch(45, "sus"), ch(43, "min"), ch(45, "min"), ch(45, "min"), ch(44, "maj"), ch(43, "min"), ch(45, "sus")],
    bassWave: "sine", arpWave: "sine", drums: "none", pad: true, drone: true, bell: true, reverb: 0.52,
  },
  // 10 機械神界 — mechanical techno, driving 16th acid arps.
  w10: {
    name: "機械神界", desc: "機械的なテクノ。駆動する16分アシッド・アルペジオ",
    stepMs: 92, prog: [ch(45, "min"), ch(41, "maj"), ch(48, "maj"), ch(43, "maj"), ch(45, "min"), ch(41, "maj"), ch(40, "min"), ch(43, "dom")],
    bassWave: "square", arpWave: "square", drums: "techno", arp: true, arpRate: 1, lead: true, reverb: 0.14,
  },
  // 11 Endless Abyss — hypnotic dark violet B minor loop.
  w11: {
    name: "Endless Abyss", desc: "催眠的な暗紫のB minorループ",
    stepMs: 150, prog: [ch(47, "min"), ch(42, "min"), ch(43, "maj"), ch(40, "min"), ch(47, "min"), ch(45, "maj"), ch(42, "min"), ch(43, "maj")],
    bassWave: "sawtooth", arpWave: "triangle", drums: "soft", pad: true, drone: true, arp: true, arpRate: 2, reverb: 0.34,
  },
};

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
// Intro (sparse, mode A) is kept short — 3 bars instead of 8 — so the melody/arp
// (mode A2) kicks in fast and the track doesn't feel like it takes forever to start.
function sectionOf(bar: number): Mode {
  const b = bar % LOOP_BARS;
  if (b < 3) return "A";
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

/** Step length (ms) for the current theme — world/final themes carry their own tempo. */
function themeStepMs(theme: BgmTheme): number {
  if (theme === "final") return FINAL_STEP_MS;
  const w = WORLD_MUSIC[theme as WorldKey];
  if (w) return w.stepMs;
  return THEMES[theme as keyof typeof THEMES].stepMs;
}

// Dispatcher: each theme has its own full-band renderer; all share one step clock.
function bgmTick(): void {
  if (muted) return;
  const world = WORLD_MUSIC[bgmTheme as WorldKey];
  if (bgmTheme === "final") {
    finalTick();
  } else if (world) {
    worldTick(world);
  } else {
    const def = THEMES[bgmTheme as keyof typeof THEMES];
    if (def.credits) creditsTick();
    else if (def.idol) idolTick(def.sea === true);
    else if (def.metal) forgeTick();
    else if (def.casino) casinoTick();
    else dungeonTick(); // dungeon / boss (variants inside)
  }
  const loopBars = bgmTheme === "final" ? FINAL_LOOP_BARS : LOOP_BARS;
  bgmStep = (bgmStep + 1) % (BAR * loopBars);
}

// ===== Per-world renderer (場所コンセプト曲) =====
// Config-driven: bass + optional drone/pad/choir/arp/bell/lead and a drum style,
// shaped by the shared section dynamics (short intro → build → chorus → outro).
function worldDrums(style: DrumStyle, inBar: number, mode: Mode, full: boolean): void {
  if (style === "none") {
    if (full && inBar % 4 === 2) noise(0.02, 0.04);
    return;
  }
  if (style === "soft") {
    if (inBar === 0 || (full && inBar === 8)) {
      noise(0.05, 0.16);
      slideTone(95, 42, 0.1, "sine", 0.18);
    }
    if (mode !== "A" && inBar % 2 === 1) noise(0.02, 0.05);
    if (full && (inBar === 4 || inBar === 12)) noise(0.12, 0.12);
    return;
  }
  if (style === "march") {
    if (inBar % 4 === 0) {
      noise(0.05, 0.18);
      slideTone(90, 40, 0.1, "sine", 0.2);
    }
    if (inBar % 4 === 2) noise(0.04, 0.1); // snare
    if (full && (inBar === 6 || inBar === 14)) noise(0.1, 0.12);
    return;
  }
  if (style === "drive") {
    if (inBar % 2 === 0) {
      noise(0.04, 0.16);
      slideTone(100, 40, 0.08, "sine", 0.2);
    }
    if (mode !== "A" && inBar % 2 === 1) noise(0.02, 0.07);
    if (full && (inBar === 4 || inBar === 12)) {
      noise(0.13, 0.14);
      tone(190, 0.1, "triangle", 0.1);
    }
    return;
  }
  // techno: four-on-the-floor kick + offbeat hats + clap
  if (inBar % 4 === 0) {
    noise(0.04, 0.18);
    slideTone(110, 40, 0.08, "sine", 0.22);
  }
  if (mode !== "A" && inBar % 2 === 1) noise(0.02, 0.08);
  if (full && inBar === 8) noise(0.05, 0.12);
}

function worldTick(cfg: WorldMusic): void {
  const T = bgmTranspose;
  const step = bgmStep;
  const bar = Math.floor(step / BAR);
  const inBar = step % BAR;
  const mode = sectionOf(bar);
  const dyn = DYN[mode];
  const chord = cfg.prog[bar % cfg.prog.length];
  const full = mode === "B";
  const rev = cfg.reverb ?? 0;
  const secBar = bar % 8;
  const phraseStep = (secBar % 4) * BAR + inBar;

  // ---- Bass: octave "drop" at the bar head, fifth mid-bar in fuller sections ----
  if (inBar === 0) {
    slideTone(chord.root * 2 * T, chord.root * T, 0.4, cfg.bassWave, 0.18, 0, 0.08);
    tone(chord.root * T, 0.5, "sine", 0.1);
  }
  if (inBar === 8 && dyn.bassOct) tone(chord.fifth * T, 0.4, cfg.bassWave, 0.12);

  // ---- Drone: a sustained low bed for cave / abyss / void ----
  if (cfg.drone && inBar === 0) {
    voice(chord.root * T, 2.0, "sawtooth", 0.05, 0, -0.3, rev);
    voice(chord.root * 1.006 * T, 2.0, "sawtooth", 0.05, 0, 0.3, rev);
  }

  // ---- Pad: warm detuned-sine chord body ----
  if (cfg.pad && inBar === 0) {
    pad(chord.root * T, 1.6, 0.05);
    if (dyn.padFifth) pad(chord.fifth * T, 1.6, 0.04);
  }

  // ---- Choir: airy "aah" voices, wide + reverberant (heaven / ice) ----
  if (cfg.choir && inBar === 0) {
    voice(chord.arp[0] * T, 2.0, "sine", 0.04, 0, -0.45, Math.max(0.4, rev));
    voice(chord.arp[1] * T, 2.0, "sine", 0.04, 0.05, 0.45, Math.max(0.4, rev));
  }

  // ---- Arpeggio: square/triangle figure, 8ths or 16ths ----
  if (cfg.arp && dyn.arp) {
    const rate = cfg.arpRate ?? 2;
    if (inBar % rate === 0) {
      const shape = ARP_SHAPES[secBar % ARP_SHAPES.length];
      const note = chord.arp[shape[Math.floor(step / rate) & 3]];
      const v = dyn.arpVol * (inBar === 0 ? 0.6 : 1);
      if (note) {
        tone(note * T, 0.12, cfg.arpWave, v);
        if (dyn.arpGhost) tone(note * T, 0.1, cfg.arpWave, v * 0.4, 0.06);
      }
    }
  }

  // ---- Bell: crystalline high notes, stereo + reverb (ice / astral / cave drip) ----
  if (cfg.bell && (full ? inBar % 2 === 0 : inBar % 4 === 2)) {
    const note = chord.arp[(step >> 1) % chord.arp.length] * 2 * T;
    const pan = (step >> 1) % 2 === 0 ? -0.6 : 0.6;
    voice(note, 0.28, "sine", 0.05, 0, pan, Math.max(0.4, rev));
  }

  // ---- Lead: sparse melody with echo, only in fuller sections ----
  if (cfg.lead && dyn.lead) {
    const note = LEAD_PHRASE[phraseStep];
    if (note) echoTone(note * T, 0.26, cfg.arpWave, 0.1, 0, 2, 0.12, 0.45);
  }

  worldDrums(cfg.drums, inBar, mode, full);
}

// ===== Final boss theme (1000F: 機神デウス＝エクス＝マキナ) =====
// 最終決戦はメインテーマ(メニュー＝dungeonの PROG / LEAD_PHRASE)の荘厳な再臨。
// 48小節の長いループに起伏を付ける: 導入ビルド → 全効果のクライマックス →
// 一旦静かなブレイク → そこからフェードで音がどんどん乗る再構築 → 大サビ。
// テンポはダイスラッシュ並みに疾走、効果(ブラス/合唱/サブ/ティンパニ/ヒット)は満載。
const FINAL_STEP_MS = 84; // ダイスラッシュ(idol)と同じ突っ走るテンポ(≈178 BPM, 16分)

// ラスボス曲のコード進行 = 小室進行(vi–IV–V–I = Am–F–G–C)。主旋律(LEAD_PHRASE,
// A minor)の動きはそのままに、コードだけ差し替える。4小節周期で旋律と揃う。
const FINAL_PROG: Chord[] = [ch(45, "min"), ch(41, "maj"), ch(43, "maj"), ch(48, "maj")];

// 48小節の構成(近代EDM流): クライマックスA[0–14] → 崩しの遷移[15] →
// 静寂から2小節ごとに1レイヤーずつ積むビルド[16–31] → ドロップ → 大サビ[32–47]。
// クライマックス↔ループ継ぎ目(47→0)は両方フルなので滑らか。

/** Full-band climax (used by [0–14] and [32–47]). */
function finalClimax(chord: Chord, step: number, inBar: number, bar: number, lb: number): void {
  // kick / hats / snare backbeat
  if (inBar % 4 === 0) {
    noise(0.06, 0.24);
    slideTone(120, 40, 0.12, "sine", 0.28);
  }
  if (inBar % 2 === 1) noise(0.02, 0.09);
  if (inBar === 4 || inBar === 12) {
    noise(0.16, 0.2);
    tone(190, 0.12, "triangle", 0.14);
  }
  // octave bass + sub
  if (inBar % 2 === 0) tone(inBar % 4 === 0 ? chord.root : chord.root * 2, 0.14, "sawtooth", 0.2);
  if (inBar === 0) tone(chord.root * 0.5, 0.6, "sine", 0.16);
  // wide brass power chords
  if (inBar === 0 || inBar === 8) {
    voice(chord.root, 0.5, "sawtooth", 0.1, 0, -0.55, 0.22);
    voice(chord.root * 1.007, 0.5, "sawtooth", 0.1, 0, 0.55, 0.22);
    voice(chord.fifth, 0.5, "sawtooth", 0.09, 0, 0.3, 0.22);
    voice(chord.root * 2, 0.5, "sawtooth", 0.07, 0, -0.3, 0.22);
  }
  // grand choir bed
  if (inBar === 0) {
    voice(chord.arp[0], 1.8, "sine", 0.05, 0, -0.5, 0.5);
    voice(chord.arp[1], 1.8, "sine", 0.05, 0.04, 0.5, 0.5);
    voice(chord.fifth * 2, 1.8, "sine", 0.035, 0.08, 0, 0.5);
  }
  // fast arp + high shimmer
  const an = chord.arp[ARP_SHAPES[(bar % 8) % ARP_SHAPES.length][step & 3]];
  if (an) tone(an, 0.1, "square", 0.07);
  if (inBar % 2 === 0) {
    const bnote = chord.arp[(step >> 1) % chord.arp.length] * 2;
    voice(bnote, 0.3, "triangle", 0.045, 0, (step >> 1) % 2 === 0 ? -0.6 : 0.6, 0.5);
  }
  // soaring brass lead — メニューで耳に聴こえる並び(E-D-B-A から)に合わせて開始位置を回転。
  const note = LEAD_PHRASE[((bar + 3) % 4) * BAR + inBar];
  if (note) {
    echoTone(note, 0.28, "sawtooth", 0.13, 0, 2, 0.11, 0.45);
    echoTone(note * 2, 0.24, "square", 0.06, 0, 1, 0.11, 0.45);
    voice(note, 0.3, "sine", 0.05, 0, 0, 0.4);
  }
  // orchestral hit + crash ONLY at the real drop (bar 32, after the build).
  // 冒頭(bar 0)では鳴らさない — 大シンバルでいきなり始まるのを避ける。
  if (lb === 32 && inBar === 0) {
    noise(0.4, 0.22);
    tone(chord.root, 0.4, "sawtooth", 0.13);
    tone(chord.fifth, 0.4, "sawtooth", 0.1);
  }
}

function finalTick(): void {
  if (muted) return;
  const step = bgmStep;
  const bar = Math.floor(step / BAR);
  const inBar = step % BAR;
  const chord = FINAL_PROG[bar % FINAL_PROG.length]; // ★ 小室進行(旋律はメインテーマのまま)
  const lb = bar % FINAL_LOOP_BARS;

  // ===== [15] クライマックス→静寂の "崩し" 遷移(EDMのダウンリフター+リバースシンバル) =====
  if (lb === 15) {
    if (inBar === 0) slideTone(chord.root * 4, chord.root, 1.3, "sawtooth", 0.13); // downlifter
    // 加速するスネアロール → bar頭に向かって膨らむ逆再生シンバル
    if (inBar % (inBar < 8 ? 2 : 1) === 0) noise(0.03, 0.05 + inBar * 0.012);
    noisePan(0.06, 0.02 + (inBar / 16) * 0.24, 0, 0.35);
    // 合唱だけは繋ぎとして残す
    if (inBar === 0) {
      voice(chord.arp[0], 1.6, "sine", 0.045, 0, -0.5, 0.5);
      voice(chord.arp[1], 1.6, "sine", 0.045, 0.04, 0.5, 0.5);
    }
    return;
  }

  // ===== クライマックス [0–14] / 大サビ [32–47] =====
  if (lb < 15 || lb >= 32) {
    finalClimax(chord, step, inBar, bar, lb);
    return;
  }

  // ===== 静寂 → 2小節ごとにレイヤーを積むビルド [16–31] =====
  const tier = Math.floor((lb - 16) / 2); // 0..7、2小節ごとに +1
  // [16] ドロップ着地のインパクト + 長い残響テールで静寂へ
  if (lb === 16 && inBar === 0) {
    noise(0.5, 0.26);
    tone(chord.root, 0.5, "sine", 0.2);
    voice(chord.root, 2.6, "sawtooth", 0.05, 0, 0, 0.6); // reverberant boom tail
  }

  // tier0(常時): 剥き出しの合唱パッド + 柔らかい主旋律 + 疎なベル(静かな曲調)
  if (inBar === 0) {
    voice(chord.arp[0], 2.2, "sine", 0.06, 0, -0.5, 0.55);
    voice(chord.arp[1], 2.2, "sine", 0.06, 0.04, 0.5, 0.55);
    voice(chord.fifth * 2, 2.2, "sine", 0.04, 0.08, 0, 0.55);
  }
  if (inBar % 4 === 0) {
    const bnote = chord.arp[(step >> 1) % chord.arp.length] * 2;
    voice(bnote, 0.5, "sine", 0.05, 0, bar % 2 ? 0.5 : -0.5, 0.55);
  }
  // 主旋律: ビルド中は柔らかいサイン。メニューと同じく E-D-B-A から始まる並びに合わせる。
  const note = LEAD_PHRASE[((bar + 3) % 4) * BAR + inBar];
  if (note) voice(note, 0.5, "sine", 0.06 + Math.min(0.03, tier * 0.005), 0, 0, 0.5);

  // tier1+: 柔らかいサブ
  if (tier >= 1 && inBar === 0) tone(chord.root * 0.5, 1.0, "sine", 0.12);
  // tier1+(=2番目のレイヤー追加から): バックコーラス「Ha—」。半小節ごとに和音上で
  // 声のように歌う(息の"H"+デチューンの母音)。tierが上がるほど少し前に出る。
  if (tier >= 1 && (inBar === 0 || inBar === 8)) {
    const vv = 0.045 + Math.min(0.03, (tier - 1) * 0.006);
    const f = inBar === 0 ? chord.arp[0] : chord.arp[1];
    noisePan(0.05, vv * 0.5, inBar === 0 ? -0.4 : 0.4, 0.4); // 息の "H"
    voice(f, 1.1, "sine", vv, 0.02, inBar === 0 ? -0.45 : 0.45, 0.5); // 母音の芯
    voice(f * 1.006, 1.1, "triangle", vv * 0.6, 0.04, inBar === 0 ? 0.45 : -0.45, 0.55); // 人声感のデチューン
  }
  // tier2+: 静かな4つ打ちキック(徐々に強く)
  if (tier >= 2 && inBar % 4 === 0) {
    noise(0.04, 0.07 + tier * 0.02);
    slideTone(110, 42, 0.1, "sine", 0.1 + tier * 0.02);
  }
  // tier3+: 裏ハット
  if (tier >= 3 && inBar % 2 === 1) noise(0.02, 0.05);
  // tier4+: オクターブ・ベース駆動
  if (tier >= 4 && inBar % 2 === 0) tone(inBar % 4 === 0 ? chord.root : chord.root * 2, 0.13, "sawtooth", 0.14);
  // tier5+: アルペジオ復帰
  if (tier >= 5) {
    const an = chord.arp[ARP_SHAPES[(bar % 8) % ARP_SHAPES.length][step & 3]];
    if (an) tone(an, 0.1, "square", 0.05);
  }
  // tier6+: ブラスstab + バックビートのクラップ
  if (tier >= 6) {
    if (inBar === 0) {
      voice(chord.root, 0.4, "sawtooth", 0.07, 0, -0.5, 0.2);
      voice(chord.fifth, 0.4, "sawtooth", 0.06, 0, 0.5, 0.2);
    }
    if (inBar === 4 || inBar === 12) noisePan(0.05, 0.12, 0, 0.2);
  }
  // tier7(最後の2小節 30–31): ドロップ直前のスネアロール加速 + riser
  if (tier >= 7) {
    const p = (lb - 30 + inBar / 16) / 2; // 0..1
    if (inBar % (p < 0.5 ? 2 : 1) === 0) noise(0.03, 0.08 + p * 0.24);
    if (inBar % 2 === 0) slideTone(300, 1600, 0.14, "sawtooth", 0.03 + p * 0.07);
  }
}

// ===== Casino renderer (落ち着いた煌びやかラウンジ) =====
// 通常カジノBGM。柔らかいサイン/トライアングルのコードとパッド、低めの音量、
// リバーブ＋ステレオの高域ベルで「煌びやか」、重いキックは無しで「落ち着いた」雰囲気。
function casinoTick(): void {
  const def = THEMES.casino;
  const T = bgmTranspose;
  const step = bgmStep;
  const bar = Math.floor(step / BAR);
  const inBar = step % BAR;
  const full = sectionOf(bar) === "B";
  const chord = def.prog[bar % def.prog.length];

  // ふんわりパッド(root+5th)を左右に広げて残響で空気感。
  if (inBar === 0) {
    voice(chord.root * T, 2.0, "sine", 0.05, 0, -0.4, 0.35);
    voice(chord.root * 1.005 * T, 2.0, "sine", 0.05, 0, 0.4, 0.35);
    voice(chord.fifth * T, 2.0, "sine", 0.04, 0, 0.15, 0.4);
  }

  // 柔らかいベース(1拍目=ルート / 3拍目=5度)。
  if (inBar === 0) voice(chord.root * 0.5 * T, 0.5, "triangle", 0.12);
  if (inBar === 8) voice(chord.fifth * 0.5 * T, 0.4, "triangle", 0.1);

  // エレピ風の和音を拍頭で軽くアルペジオ(グラス感)。
  if (inBar % 4 === 0) {
    for (let i = 0; i < 3; i++) {
      voice(chord.arp[i] * T, 0.5, "triangle", 0.06, i * 0.04, (i - 1) * 0.4, 0.25);
    }
  }

  // 煌びやか: 高域ベルをステレオ+残響で。サビは少し密に。
  const bellOn = full ? inBar % 2 === 0 : inBar % 4 === 2;
  if (bellOn) {
    const note = chord.arp[(step >> 1) % chord.arp.length] * 2 * T;
    const pan = (step >> 1) % 2 === 0 ? -0.6 : 0.6;
    voice(note, 0.25, "sine", 0.05, 0, pan, 0.5);
    voice(note, 0.2, "triangle", 0.03, 0.09, -pan, 0.5); // 反対側へキラッとエコー
  }

  // 控えめなブラシ・ハット(裏)とソフトな拍頭。重いキックは置かない。
  if (inBar % 2 === 1) noise(0.02, 0.03);
  if (inBar === 0) {
    noise(0.03, 0.06);
    voice(95 * T, 0.06, "sine", 0.1);
  }
}

// ===== Dungeon / World / Boss renderer =====
// One A-minor cycle, layered up: sub-bass with a pitch-drop, detuned pad,
// rotating square arpeggio, echoing lead, and full drums. Boss = faster, with a
// dissonant stab, tom fill and ride; World = brighter with an octave shimmer.
function dungeonTick(): void {
  const def = bgmTheme === "boss" ? THEMES.boss : THEMES.dungeon;
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
  }

  // ---- Arpeggio: square 8ths, figure rotates; world doubles an octave up in the chorus ----
  if (dyn.arp && inBar % 2 === 0) {
    const shape = ARP_SHAPES[secBar % ARP_SHAPES.length];
    const note = chord.arp[shape[(step >> 1) & 3]];
    const v = dyn.arpVol * duck;
    if (note) {
      tone(note * T, 0.12, "square", v);
      if (dyn.arpGhost) tone(note * T, 0.1, "square", v * 0.4, 0.075);
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

// ===== Credits renderer ("Running Toward Light") =====
// 全合成のクレジット曲。スパークリングなパルス・アルペジオ + 明るいパルス・リードで
// 始まり(イントロ)、トライアングル・ベースとドラムでAメロ、密度を上げてプリサビ、
// ワイドに開いたサビへ。装備や場所のテーマと同じ step クロックに乗る。
function creditsTick(): void {
  if (muted) return;
  const T = bgmTranspose;
  const step = bgmStep;
  const bar = Math.floor(step / BAR); // 0..31
  const inBar = step % BAR;
  const chord = CREDITS_PROG[bar];
  const sect = creditsSection(bar);
  const intro = sect === "intro";
  const verse = sect === "verse";
  const pre = sect === "pre";
  const chorus = sect === "chorus";
  const duck = inBar === 0 ? 0.7 : 1;

  // ---- Bass(triangle): イントロは静かなペダル、以降は駆けるオクターブ8分 ----
  if (intro) {
    if (inBar === 0) tone(chord.root * T, 1.4, "triangle", 0.12);
  } else if (inBar % 2 === 0) {
    const oct = inBar % 4 === 0 ? 1 : 2; // root → octave のバウンス
    tone(chord.root * oct * T, 0.16, "triangle", chorus ? 0.2 : 0.16);
  }

  // ---- 暖かいデチューン・パッド(小節頭) ----
  if (inBar === 0) {
    pad(chord.root * T, 1.5, intro ? 0.04 : 0.055);
    if (!intro) pad(chord.fifth * T, 1.5, 0.04);
  }

  // ---- きらめくパルス・アルペジオ(本曲の signature。通常8分 / ビルド・サビは16分) ----
  const arpRate = pre || chorus ? 1 : 2;
  if (inBar % arpRate === 0) {
    const shape = ARP_SHAPES[bar % ARP_SHAPES.length];
    const note = chord.arp[shape[Math.floor(step / arpRate) & 3]];
    if (note) tone(note * T, 0.12, "square", (intro ? 0.09 : chorus ? 0.07 : 0.06) * duck);
  }

  // ---- スクエア・リード(作曲した主旋律)。サビはオクターブ重ね＋残響でワイドに ----
  const lf = CREDITS_LEAD.freq[step];
  if (lf) {
    const dur = CREDITS_LEAD.dur[step];
    const lv = chorus ? 0.13 : intro ? 0.085 : 0.11;
    voice(lf * T, dur, "square", lv, 0, -0.05, chorus ? 0.18 : 0.08);
    voice(lf * 2 * T, dur, "square", lv * 0.22, 0, 0.05, 0.12);
  }

  // ---- 高域のスパークル(イントロの煌めき＋サビのシマー、ステレオ＋残響) ----
  if ((intro && inBar % 8 === 0) || (chorus && inBar % 4 === 0)) {
    const n = chord.arp[2] * 2 * T;
    const pan = (step >> 2) % 2 === 0 ? -0.5 : 0.5;
    voice(n, 0.3, "sine", 0.045, 0, pan, 0.4);
  }

  // ---- ドラム ----
  if (intro) {
    if (bar >= 2 && inBar % 4 === 2) noise(0.02, 0.04); // 後半だけ軽いハット
  } else {
    if (inBar === 0 || inBar === 8) {
      // キック(1・3拍)
      noise(0.05, 0.18);
      slideTone(110 * T, 42 * T, 0.1, "sine", 0.2);
    }
    if (inBar === 4 || inBar === 12) {
      // スネア(2・4拍)
      noise(0.14, 0.14);
      tone(190 * T, 0.1, "triangle", 0.1);
    }
    if ((verse && inBar % 4 === 2) || ((pre || chorus) && inBar % 2 === 1)) noise(0.025, 0.06); // ハット
    if (pre && bar === 15 && inBar >= 8) noise(0.03, 0.08 + (inBar - 8) * 0.012); // サビ直前のフィル
    if (chorus && (bar === 16 || bar === 24) && inBar === 0) noise(0.5, 0.16); // クラッシュ
  }
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
// →B(サビ)→A'(間奏) の起伏を表現。ステレオパン+共有リバーブで空間の広がりを、
// クラップ/キラキラ上昇/ワイドstab/高域シマーで特殊アクセントを加えている。
function idolTick(sea = false): void {
  if (muted) return;
  const def = THEMES.idol;
  const T = bgmTranspose;
  const step = bgmStep;
  const bar = Math.floor(step / BAR);
  const inBar = step % BAR;
  const mode = sectionOf(bar);
  const chord = def.prog[bar % def.prog.length];
  const secPos = bar % 8; // 0..7 — どのセクションも8小節構成
  const stepSec = def.stepMs / 1000;

  const isVerse = mode === "A";
  const isBuild = mode === "A2";
  const isChorus = mode === "B";

  const kickStep = inBar % 4 === 0; // 0,4,8,12
  const hatStep = inBar % 4 === 2; // 2,6,10,14 (裏打ち)
  const snareStep = inBar === 4 || inBar === 12;

  // ---- ① ドラム ----
  // キック: 重低音は定位センターで芯を保つ。A2は抜く(解放感)。
  if (!isBuild && kickStep) {
    noise(0.05, 0.2);
    slideTone(100 * T, 40 * T, 0.12, "sine", 0.22);
  }
  // ハット: 裏打ちを左右に振って横の広がりを出す。
  if (hatStep) {
    const hatPan = (inBar / 2) % 2 === 0 ? -0.55 : 0.55;
    noisePan(0.03, isChorus ? 0.09 : 0.06, hatPan, 0.08);
  }
  // スネア: ノイズ + 180Hz の胴鳴り。軽くリバーブ。
  if (!isBuild && snareStep) {
    noisePan(0.15, 0.16, 0, 0.16);
    voice(180 * T, 0.12, "triangle", 0.12, 0, 0, 0.1);
  }
  // サビのバックビートにステレオ・ハンドクラップを重ねる(特殊アクセント)。
  if (isChorus && snareStep) {
    noisePan(0.05, 0.12, -0.4, 0.2); // 左クラップ
    noisePan(0.05, 0.1, 0.4, 0.2); // 右クラップ
    noisePan(0.04, 0.06, 0, 0.25); // センターの残響成分
  }
  // A2 ビルドアップ: 後半2小節でスネアロール + 上昇スイープ(しょわ〜、リバーブで奥行き)。
  if (isBuild) {
    const build = secPos / 7; // 0→1
    if (secPos >= 6) {
      noisePan(0.04, 0.05 + build * 0.22, 0, 0.2 + build * 0.3); // 16分ロール
      slideTone(400 * T, 1600 * T, 0.08, "sawtooth", 0.04 + build * 0.05); // riser
    } else if (kickStep) {
      noise(0.03, 0.05 + build * 0.06);
    }
  }

  // ---- ② ベース(オクターブ奏法) ---- センター・芯はドライに。
  const bassVol = isChorus ? 0.22 : isVerse ? 0.16 : 0.18;
  const bf = (inBar % 2 === 0 ? chord.root : chord.root * 2) * T;
  tone(bf, 0.13, "sawtooth", bassVol);
  tone(bf, 0.02, "square", bassVol * 0.6); // ポコッとしたアタック

  // ---- ③ バッキング(デチューンsaw和音) ---- 2声を左右に開いて横幅+軽リバーブ。
  if (!isVerse || inBar % 2 === 0) {
    const duck = isChorus && kickStep; // サビはキックで完全に抜く(ポンプ感)
    if (!duck) {
      const base = isChorus ? 0.07 : isBuild ? 0.04 + (secPos / 7) * 0.04 : 0.045;
      const bv = base * (kickStep ? 0.5 : 1);
      for (let i = 0; i < 3; i++) {
        const f = chord.arp[i] * T;
        voice(f, 0.1, "sawtooth", bv, 0, -0.55, 0.12); // 左
        voice(f * 1.005, 0.1, "sawtooth", bv, 0, 0.55, 0.12); // 右(デチューン)
      }
    }
  }

  // ---- ④ キラキラ(超高速アルペジオ) ---- 4音を左右にパンしてピンポン・エコー。
  if (isChorus) {
    for (let i = 0; i < 4; i++) {
      const f = chord.arp[i] * 2 * T;
      const when = (i / 4) * stepSec;
      const pan = -0.7 + i * 0.47; // L→R へ流す
      voice(f, 0.05, "square", 0.05, when, pan, 0.18);
      voice(f, 0.05, "square", 0.025, when + 0.02, -pan, 0.3); // 反対側へエコー
    }
  }

  // ---- 特殊アクセント A: サビ各小節頭の「キラキラ上昇フレーズ」(ステレオ掃引) ----
  if (isChorus && inBar === 0) {
    const run = [chord.arp[0], chord.arp[1], chord.arp[2], chord.arp[0] * 2, chord.arp[1] * 2, chord.arp[2] * 2];
    for (let i = 0; i < run.length; i++) {
      const when = (i / run.length) * stepSec * 1.5; // 1.5ステップに渡って駆け上がる
      const pan = -0.85 + (i / (run.length - 1)) * 1.7; // L→R
      voice(run[i] * T, 0.12, "square", 0.05, when, pan, 0.4);
    }
  }

  // ---- 特殊アクセント B: サビ突入(セクション頭)のワイドなシンセ・ブラスstab ----
  if (isChorus && secPos === 0 && inBar === 0) {
    for (let i = 0; i < 3; i++) {
      const f = chord.arp[i] * T;
      voice(f, 0.22, "sawtooth", 0.08, 0, -0.6, 0.2);
      voice(f * 1.007, 0.22, "sawtooth", 0.08, 0, 0.6, 0.2);
    }
  }

  // ---- 特殊アクセント C: サビ/ビルド中の高域シマー・パッド(空気感) ----
  if ((isChorus || (isBuild && secPos >= 4)) && inBar === 0) {
    voice(chord.root * 4 * T, 1.7, "triangle", 0.022, 0, -0.65, 0.35);
    voice(chord.root * 4 * 1.01 * T, 1.7, "triangle", 0.022, 0, 0.65, 0.35);
  }

  // ---- ⑤ 金コン(カウベル) セクション切替直前に「ピーン！」(左右+残響) ----
  if (secPos === 7 && inBar === 15) {
    voice(800 * T, 0.4, "sine", 0.16, 0, -0.5, 0.45);
    voice(1230 * T, 0.4, "sine", 0.12, 0, 0.5, 0.45);
  }

  // ---- 主旋律(ボーカル): ステレオ・ダブリング + ポルタメント + 残響で前に出す ----
  const leadOn = isChorus || (isBuild && secPos >= 4);
  if (leadOn) {
    const phraseStep = (bar % 4) * BAR + inBar;
    const note = IDOL_LEAD[phraseStep];
    if (note) {
      const lv = isChorus ? 0.13 : 0.085;
      // 主声(やや左) + わずかにデチューンした副声(やや右)で厚みと幅。
      slideVoice(note * 0.985 * T, note * T, 0.26, "square", lv, 0, 0.04, -0.22, 0.3);
      slideVoice(note * 0.985 * 1.006 * T, note * 1.006 * T, 0.26, "square", lv * 0.6, 0.012, 0.04, 0.22, 0.35);
      // 海リカラー: 1oct上のサイン重ねで“海風”の倍音(エアリー)。
      if (sea) voice(note * 2 * T, 0.28, "sine", lv * 0.3, 0.01, 0.15, 0.45);
    }
  }

  // ================= 海っぽいリカラー（同じ Idol 曲に海の音色を足す） =================
  // sea=false の通常 idol(ダイスラッシュAT)には一切影響しない加算レイヤー。
  if (sea) {
    // ① 波のウォッシュ: セクション頭で「ザァ…」と寄せる残響ノイズ(L/R)。
    if (inBar === 0) {
      const swell = isChorus ? 0.05 : 0.035;
      noisePan(0.6, swell, -0.35, 0.5);
      noisePan(0.6, swell, 0.35, 0.5);
    }
    // ②引き波: サビ前の最終小節で細かく引いていく波。
    if (secPos === 7 && inBar >= 12) {
      noisePan(0.18, 0.03, inBar % 2 ? 0.4 : -0.4, 0.45);
    }
    // ③ マリンベル(スティールパン風): 和音の頂点をL/Rへピンと響かせる＝南国/海の煌めき。
    if ((isChorus || isVerse) && inBar % 2 === 0) {
      const idx = (inBar / 2) % 4;
      const f = chord.arp[idx] * 2 * T;
      const pan = (inBar / 2) % 2 === 0 ? -0.5 : 0.5;
      voice(f, 0.45, "triangle", isChorus ? 0.06 : 0.04, 0, pan, 0.45);
      voice(f, 0.45, "sine", isChorus ? 0.03 : 0.02, 0.03, -pan, 0.5); // 逆サイドへ反響
    }
    // ④ 水面のきらめき: 常時うっすら高域シマー(セクション頭でロングに伸ばす)。
    if (inBar === 0) {
      voice(chord.root * 6 * T, 1.6, "sine", 0.018, 0, -0.7, 0.5);
      voice(chord.root * 6 * 1.01 * T, 1.6, "sine", 0.018, 0, 0.7, 0.5);
    }
  }
}

// Whether the player WANTS music on (independent of the timer, which we pause
// while the tab is hidden so the synth stops generating nodes in the background).
let bgmPlaying = false;
let visHooked = false;

function startTimer(): void {
  if (bgmTimer != null) return;
  bgmTimer = setInterval(bgmTick, themeStepMs(bgmTheme));
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

/** @internal test only — render `steps` of a theme through the synth path. */
export function __tickThemeForTest(theme: BgmTheme, steps: number): void {
  const prev = bgmTheme;
  bgmTheme = theme;
  bgmStep = 0;
  muted = false;
  for (let i = 0; i < steps; i++) bgmTick();
  bgmTheme = prev;
}

// ===== Jukebox catalog (図鑑の音楽鑑賞) =====
// ループ再生で鑑賞するBGM一覧。各ワールド(章)はそれぞれ固有のオリジナル曲。
export interface MusicTrack {
  id: string;
  name: string;
  desc: string;
  theme: BgmTheme;
  /** Pitch transpose. 1 = 原曲キー。 */
  transpose?: number;
}

/** One track per chapter (w1…w11), each a distinct location-themed composition. */
const WORLD_KEYS: WorldKey[] = ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "w9", "w10", "w11"];
const WORLD_TRACKS: MusicTrack[] = WORLD_KEYS.map((key, i) => {
  const m = WORLD_MUSIC[key];
  const range = i < 10 ? `${i * 100 + 1}–${i * 100 + 100}階` : "1001階〜";
  return { id: key, name: `${m.name} (${range})`, desc: m.desc, theme: key };
});

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "dungeon", name: "迷宮 / 拠点", desc: "メニューで流れる A-minor のダンジョンループ", theme: "dungeon" },
  ...WORLD_TRACKS,
  { id: "final", name: "機神デウス＝エクス＝マキナ (1000階)", desc: "メインテーマが荘厳に再臨する長尺の最終決戦曲。盛り上がり→静寂→再構築の大きな起伏", theme: "final" },
  { id: "boss", name: "大ボス戦", desc: "速く緊迫した大ボス階のテーマ", theme: "boss" },
  { id: "casino", name: "カジノ", desc: "落ち着いた煌びやかなラウンジ", theme: "casino" },
  { id: "forge", name: "鍛冶屋", desc: "重厚な D-ドリアン。金床のクランク", theme: "forge" },
  { id: "idol", name: "ダイスラッシュ (AT)", desc: "王道進行のアイドルポップ(BIG中)", theme: "idol" },
  { id: "seaIdol", name: "甘ダイス連チャン 〜潮騒アイドル〜", desc: "同じアイドルポップを海っぽくリカラー(波/マリンベル/水面の煌めき)。甘ダイス確変中に流れる", theme: "seaIdol" },
  {
    id: "credits",
    name: "スタッフロール 〜光へ走る〜",
    desc: "明るくほろ苦い D メジャーのクレジット曲。IV→V→vi で駆け上がる",
    theme: "credits",
  },
];
