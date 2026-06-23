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
  rushRewardMult,
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

  it("never spawns the 1000F final boss (難度フロアは常に1000階未満)", () => {
    for (const hf of [950, 1000, 1050, 1500, 2000, 5000, 9999]) {
      for (let step = 0; step < 5; step++) {
        expect(rushBossFloor(hf, step)).toBeLessThan(1000);
      }
    }
  });

  it("報酬倍率は深く潜るほど増える（上げ損防止）", () => {
    expect(rushRewardMult(1000)).toBe(4);
    expect(rushRewardMult(2000)).toBeGreaterThan(rushRewardMult(1000));
    expect(rushRewardMult(5000)).toBeGreaterThan(rushRewardMult(2000));
  });
});

describe("star-up material recipe", () => {
  it("is 🔹1/🔶1 + 💠(1 + floor(★/10))", () => {
    expect(starMaterialCost(0)).toEqual({ shard: 1, core: 1, sigil: 1 });
    expect(starMaterialCost(9)).toEqual({ shard: 1, core: 1, sigil: 1 });
    expect(starMaterialCost(10)).toEqual({ shard: 1, core: 1, sigil: 2 });
    expect(starMaterialCost(25)).toEqual({ shard: 1, core: 1, sigil: 3 });
  });
  it("canAfford / spend behave", () => {
    const have = { shard: 10, core: 3, sigil: 2 };
    const cost = starMaterialCost(0); // {1,1,1}
    expect(canAfford(have, cost)).toBe(true);
    expect(canAfford({ shard: 0, core: 0, sigil: 0 }, cost)).toBe(false);
    expect(spend(have, cost)).toEqual({ shard: 9, core: 2, sigil: 1 });
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
