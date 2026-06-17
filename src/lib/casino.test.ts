import { describe, expect, it } from "vitest";
import {
  fateCost,
  FATE_WIN_CHANCE,
  drawSlotOutcome,
  slotPayout,
  slotReels,
  pickReach,
  rollRush,
  SLOT_REACHES,
  SLOT_SYMBOL,
  type SlotOutcome,
} from "@/lib/casino";

describe("運命の大博打 (fate gamble)", () => {
  it("keeps a deliberately tiny win chance (低期待値)", () => {
    expect(FATE_WIN_CHANCE).toBeGreaterThan(0);
    expect(FATE_WIN_CHANCE).toBeLessThanOrEqual(0.1);
  });

  it("fateCost has a floor and scales with the player's best tier", () => {
    expect(fateCost(0)).toBe(3000); // floor for fresh saves
    expect(fateCost(10)).toBe(3000); // still under the floor
    expect(fateCost(60)).toBe(60 * 80); // late-game gold sink
    expect(fateCost(100)).toBeGreaterThan(fateCost(60));
  });
});

describe("slot machine (パチスロ4号機フレーバー)", () => {
  it("drawSlotOutcome always returns a valid outcome", () => {
    const valid: SlotOutcome[] = ["big", "reg", "replay", "watermelon", "cherry", "bell", "miss"];
    for (let i = 0; i < 2000; i++) {
      expect(valid).toContain(drawSlotOutcome());
    }
  });

  it("reels match the outcome's winning line", () => {
    expect(slotReels("big", false)).toEqual([7, 7, 7]);
    expect(slotReels("reg", false)).toEqual([SLOT_SYMBOL.bar, SLOT_SYMBOL.bar, SLOT_SYMBOL.bar]);
    expect(slotReels("replay", false)).toEqual([1, 1, 1]);
    expect(slotReels("bell", false)).toEqual([2, 2, 2]);
    expect(slotReels("watermelon", false)).toEqual([5, 5, 5]);
    expect(slotReels("cherry", false)[0]).toBe(SLOT_SYMBOL.cherry); // 左リールにチェリー
  });

  it("a miss never shows an accidental triple, and a reach near-misses on 7", () => {
    for (let i = 0; i < 500; i++) {
      const [a, b, c] = slotReels("miss", false);
      expect(a === b && b === c).toBe(false);
    }
    const reach = slotReels("miss", true);
    expect(reach[0]).toBe(7);
    expect(reach[1]).toBe(7);
    expect(reach[2]).not.toBe(7);
  });

  it("payouts rank bonuses over small roles; replay pays 0 (free spin instead)", () => {
    expect(slotPayout("replay")).toBe(0);
    expect(slotPayout("big")).toBe(0); // BIG pays via ダイスラッシュ(AT)
    expect(slotPayout("reg")).toBeGreaterThan(slotPayout("bell"));
    expect(slotPayout("watermelon")).toBeGreaterThan(slotPayout("cherry"));
  });

  it("ダイスラッシュ(AT) always pays at least one set and can loop", () => {
    let maxSets = 0;
    for (let i = 0; i < 400; i++) {
      const r = rollRush();
      expect(r.sets).toBeGreaterThanOrEqual(1);
      expect(r.coins).toBeGreaterThanOrEqual(120);
      maxSets = Math.max(maxSets, r.sets);
    }
    expect(maxSets).toBeGreaterThan(1); // continuation happens
  });

  it("losing reaches never use the hottest (premium-tier) productions", () => {
    for (let i = 0; i < 300; i++) {
      expect(pickReach(false).tier).toBeLessThanOrEqual(3);
    }
    // there are ~10 named reach productions
    expect(SLOT_REACHES.length).toBeGreaterThanOrEqual(10);
  });
});
