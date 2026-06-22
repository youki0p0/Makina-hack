import { describe, expect, it } from "vitest";
import {
  bonusUses,
  canAfford,
  dailyLevelFloor,
  maxDailyLevel,
  maxDailyUses,
  maxRushUses,
  normalizeMaterials,
  rushBossFloor,
  spend,
  starMaterialCost,
  weekdayTheme,
  WEEKDAY_THEMES,
} from "@/data/dungeon";

describe("dungeon usage limits", () => {
  it("daily=3 / rush=5 by default, +1 per milestone reached", () => {
    expect(bonusUses(0)).toBe(0);
    expect(maxDailyUses(0)).toBe(3);
    expect(maxRushUses(0)).toBe(5);
    expect(maxDailyUses(1000)).toBe(4); // 1000クリア +1
    expect(maxDailyUses(1500)).toBe(5);
    expect(maxDailyUses(2500)).toBe(7); // 全節目 +4
    expect(maxRushUses(2500)).toBe(9);
  });
});

describe("daily dungeon levels", () => {
  it("level cap follows highest floor (min 1), Lv1≒100階", () => {
    expect(maxDailyLevel(0)).toBe(1);
    expect(maxDailyLevel(50)).toBe(1);
    expect(maxDailyLevel(250)).toBe(2);
    expect(maxDailyLevel(2600)).toBe(26);
    expect(dailyLevelFloor(1)).toBe(100);
    expect(dailyLevelFloor(5)).toBe(500);
  });
});

describe("boss rush floors", () => {
  it("escalates over 5 steps, multiples of 50, min 50", () => {
    const fs = Array.from({ length: 5 }, (_, i) => rushBossFloor(1000, i));
    expect(fs.every((f) => f % 50 === 0 && f >= 50)).toBe(true);
    expect(fs[0]).toBeLessThan(fs[4]); // 逓増
    expect(rushBossFloor(0, 0)).toBe(50); // 序盤でも最低50
  });
});

describe("star-up material recipe", () => {
  it("scales with modTier and always needs 1 sigil", () => {
    expect(starMaterialCost(0)).toEqual({ shard: 6, core: 2, sigil: 1 });
    const hi = starMaterialCost(10);
    expect(hi.sigil).toBe(1);
    expect(hi.shard).toBeGreaterThan(6);
  });
  it("canAfford / spend behave", () => {
    const have = { shard: 10, core: 3, sigil: 1 };
    const cost = starMaterialCost(0);
    expect(canAfford(have, cost)).toBe(true);
    expect(canAfford({ shard: 0, core: 0, sigil: 0 }, cost)).toBe(false);
    expect(spend(have, cost)).toEqual({ shard: 4, core: 1, sigil: 0 });
  });
});

describe("materials normalize + weekday theme", () => {
  it("normalizes partial/missing material maps", () => {
    expect(normalizeMaterials(undefined)).toEqual({ shard: 0, core: 0, sigil: 0 });
    expect(normalizeMaterials({ shard: 5 })).toEqual({ shard: 5, core: 0, sigil: 0 });
    expect(normalizeMaterials({ shard: -3, core: 2.7 })).toEqual({ shard: 0, core: 2, sigil: 0 });
  });
  it("weekday theme covers all 7 days", () => {
    expect(WEEKDAY_THEMES).toHaveLength(7);
    expect(weekdayTheme(new Date("2026-06-21"))).toBe(WEEKDAY_THEMES[0]); // 日曜
  });
});
