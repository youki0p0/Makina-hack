import { describe, expect, it } from "vitest";
import { hashSeed } from "./hashSeed";

describe("hashSeed", () => {
  it("同じ入力なら常に同じ値（決定論）", () => {
    expect(hashSeed("2026-06-23")).toBe(hashSeed("2026-06-23"));
  });

  it("入力が違えば（ほぼ）違う値", () => {
    expect(hashSeed("2026-06-23")).not.toBe(hashSeed("2026-06-24"));
    expect(hashSeed("a#atk")).not.toBe(hashSeed("a#def"));
  });

  it("32bit 符号なし整数を返す", () => {
    for (const s of ["", "x", "2026-06-23", "seed#luck"]) {
      const h = hashSeed(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("FNV-1a の既知値（空文字＝オフセット基底）", () => {
    expect(hashSeed("")).toBe(2166136261);
  });
});
