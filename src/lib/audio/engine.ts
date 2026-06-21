// ===== Web Audio synthesis engine =====
// Owns the AudioContext, master gain, mute state and the low-level synth
// primitives (tone/noise/slide/voice…). No asset files: every sound is
// generated procedurally. SFX and BGM build on these primitives.

const MUTE_KEY = "dice-hackslash-muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
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

/** Raw mute flag for internal reads (no lazy localStorage init). */
export function getMuted(): boolean {
  return muted;
}

/** Set the in-memory mute flag only (used by test ticking). */
export function setMutedFlag(m: boolean): void {
  muted = m;
}

/** Set + persist the mute flag (used by the public setMuted). */
export function writeMute(m: boolean): void {
  muted = m;
  initialized = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  }
}

/** Resume the audio context (must be called from a user gesture). */
export function initAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
  isMuted();
}

export { getCtx };

export function tone(
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

export function noise(dur: number, vol = 0.3): void {
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
export function slideTone(
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
export function voice(
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
export function slideVoice(
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
export function noisePan(dur: number, vol: number, pan = 0, reverb = 0): void {
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
