import { describe, expect, it } from "vitest";
import {
  ENDLESS_WORLD,
  getWorld,
  isEndless,
  isWorldBossFloor,
} from "@/data/worlds";
import {
  applyModifier,
  modMultiplier,
  modTierForFloor,
  rollDropModTier,
  starLabel,
} from "@/data/modifiers";
import {
  crossedMilestones,
  milestoneSouls,
  newlyEarnedFloorAchievements,
  nextMilestoneFloor,
} from "@/data/milestones";
import { getDifficulty, normalizeDifficulty } from "@/data/difficulty";
import { getItemById } from "@/data/items";

describe("worlds", () => {
  it("maps floors to the right chapter", () => {
    expect(getWorld(1).chapter).toBe(1);
    expect(getWorld(100).chapter).toBe(1);
    expect(getWorld(150).chapter).toBe(2);
    expect(getWorld(1000).chapter).toBe(10);
  });

  it("enters the Endless Abyss past floor 1000", () => {
    expect(isEndless(1000)).toBe(false);
    expect(isEndless(1001)).toBe(true);
    expect(getWorld(1500)).toBe(ENDLESS_WORLD);
  });

  it("identifies 100th-floor world bosses only up to 1000", () => {
    expect(isWorldBossFloor(100)).toBe(true);
    expect(isWorldBossFloor(1000)).toBe(true);
    expect(isWorldBossFloor(50)).toBe(false);
    expect(isWorldBossFloor(1100)).toBe(false);
  });
});

describe("modifiers", () => {
  it("adds a ★ tier every 50 floors, forever", () => {
    expect(modTierForFloor(49)).toBe(0);
    expect(modTierForFloor(50)).toBe(1);
    expect(modTierForFloor(120)).toBe(2);
    expect(modTierForFloor(5000)).toBe(100);
  });

  it("is additive: +20% per star", () => {
    expect(modMultiplier(0)).toBeCloseTo(1);
    expect(modMultiplier(1)).toBeCloseTo(1.2);
    expect(modMultiplier(3)).toBeCloseTo(1.6);
  });

  it("applyModifier scales stats and tags the name", () => {
    const base = getItemById("iron_sword")!;
    const out = applyModifier(base, 2);
    expect(out.modTier).toBe(2);
    expect(out.attack).toBe(Math.round(base.attack * 1.4));
    expect(out.name).toContain("★★");
  });

  it("shows pips up to 5 then a compact number from ★6", () => {
    expect(starLabel(0)).toBe("");
    expect(starLabel(3)).toBe("★★★");
    expect(starLabel(5)).toBe("★★★★★");
    expect(starLabel(6)).toBe("★6");
    expect(starLabel(42)).toBe("★42");
  });

  it("rollDropModTier never goes negative", () => {
    for (let i = 0; i < 200; i++) {
      expect(rollDropModTier(10, 0)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("milestones", () => {
  it("awards souls only at 100-floor marks", () => {
    expect(milestoneSouls(99)).toBe(0);
    expect(milestoneSouls(100)).toBe(1);
    expect(milestoneSouls(900)).toBe(9);
    expect(milestoneSouls(1000)).toBe(15);
    expect(milestoneSouls(1100)).toBe(12);
  });

  it("computes freshly crossed milestones", () => {
    expect(crossedMilestones(99, 250)).toEqual([100, 200]);
    expect(crossedMilestones(100, 100)).toEqual([]);
    expect(nextMilestoneFloor(150)).toBe(200);
  });

  it("returns unclaimed floor achievements", () => {
    const earned = newlyEarnedFloorAchievements(100, []);
    expect(earned.map((a) => a.id)).toContain("floor100");
    expect(newlyEarnedFloorAchievements(100, ["floor10", "floor50", "floor100"])).toHaveLength(0);
  });
});

describe("difficulty scaling", () => {
  it("higher difficulties drop more and roll rarer", () => {
    expect(getDifficulty("normal").dropMax).toBe(1);
    expect(getDifficulty("expert").dropMax).toBe(4);
    expect(getDifficulty("expert").rareBonus).toBeGreaterThan(getDifficulty("hard").rareBonus);
  });

  it("normalizes the new expert tier", () => {
    expect(normalizeDifficulty("expert")).toBe("expert");
    expect(normalizeDifficulty("bogus")).toBe("normal");
  });
});
