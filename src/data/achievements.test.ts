import { describe, expect, test } from "vitest";
import {
  defaultProgress,
  newlyEarnedAchievements,
  normalizeProgress,
} from "@/data/achievements";

describe("achievement unlock notifications", () => {
  test("fresh progress notifies nothing", () => {
    expect(newlyEarnedAchievements(defaultProgress())).toEqual([]);
  });

  test("a newly satisfied achievement is reported until recorded as notified", () => {
    const p = { ...defaultProgress(), kills: 10 };
    const earned = newlyEarnedAchievements(p);
    expect(earned).toContain("kills10");
    const p2 = { ...p, notifiedAchievements: earned };
    expect(newlyEarnedAchievements(p2)).not.toContain("kills10");
  });

  test("old saves (no field) backfill already-earned → no retroactive spam", () => {
    const norm = normalizeProgress({ kills: 50, bossKills: 1, maxFloor: 10 });
    expect(norm.notifiedAchievements).toContain("kills10");
    expect(norm.notifiedAchievements).toContain("boss1");
    expect(newlyEarnedAchievements(norm)).toEqual([]);
  });

  test("a saved notifiedAchievements list is preserved as-is", () => {
    const norm = normalizeProgress({ notifiedAchievements: ["floor5"] });
    expect(norm.notifiedAchievements).toEqual(["floor5"]);
  });
});
