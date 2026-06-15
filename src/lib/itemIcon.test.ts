import { describe, expect, it } from "vitest";
import { getEnemyIconDataUrl, getGlyphIconDataUrl, getItemIconDataUrl, hashSeed } from "@/lib/itemIcon";

describe("procedural icons", () => {
  it("hashSeed is deterministic and varies by input", () => {
    expect(hashSeed("gen_weapon_5")).toBe(hashSeed("gen_weapon_5"));
    expect(hashSeed("gen_weapon_5")).not.toBe(hashSeed("gen_weapon_6"));
  });

  it("is SSR-safe (no canvas → empty string, never throws)", () => {
    expect(
      getItemIconDataUrl({ slot: "weapon", rarity: "common", modifierStars: 0, seed: 1 }),
    ).toBe("");
    expect(
      getEnemyIconDataUrl({ templateId: "slime", isBoss: false, modTier: 0, seed: 1 }),
    ).toBe("");
    expect(getGlyphIconDataUrl("attack")).toBe("");
    expect(getGlyphIconDataUrl("gold")).toBe("");
  });
});
