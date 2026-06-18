// @vitest-environment jsdom
import { afterAll, expect, test } from "vitest";
import { MUSIC_TRACKS, __tickThemeForTest } from "@/lib/audio";

let oscCount = 0;
class FakeParam { value = 0; setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
class FakeNode { gain = new FakeParam(); frequency = new FakeParam(); pan = new FakeParam(); type = "square"; buffer: unknown = null;
  connect() { return this; } disconnect() {} start() {} stop() {} }
class FakeCtx {
  currentTime = 0; sampleRate = 44100; state = "running"; destination = new FakeNode();
  createGain() { return new FakeNode(); }
  createOscillator() { oscCount++; return new FakeNode(); }
  createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
  createBufferSource() { return new FakeNode(); }
  createConvolver() { return new FakeNode(); }
  createStereoPanner() { return new FakeNode(); }
  resume() {}
}
// @ts-expect-error test shim
window.AudioContext = FakeCtx;

afterAll(() => { /* noop */ });

test("every jukebox theme renders a full loop without error and makes sound", () => {
  const STEPS = 16 * 64; // cover the longest theme loop (final = 48 bars) with margin
  for (const t of MUSIC_TRACKS) {
    oscCount = 0;
    expect(() => __tickThemeForTest(t.theme, STEPS)).not.toThrow();
    expect(oscCount, `theme ${t.id} produced no oscillators`).toBeGreaterThan(20);
  }
});
