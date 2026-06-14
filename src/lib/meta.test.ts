import { describe, expect, it } from "vitest";
import { artifactBonus, artifactUpgradeCost, computeRebirthGain } from "@/data/artifacts";
import { CLASSES, isClassUnlocked } from "@/data/classes";
import { getDifficulty } from "@/data/difficulty";
import { defaultProgress } from "@/data/achievements";
import { getDailyBonus } from "@/lib/daily";
import { ENEMY_TEMPLATES, generateEnemy } from "@/data/enemies";

describe("artifacts", () => {
  it("bonus scales with level", () => {
    const b = artifactBonus({ might: 3, guard: 0, vitality: 2, fortune: 0 });
    expect(b.attack).toBe(3); // might +1/lv
    expect(b.maxHp).toBe(8); // vitality +4/lv * 2
  });

  it("upgrade cost increases with level", () => {
    expect(artifactUpgradeCost("might", 1)).toBeGreaterThan(artifactUpgradeCost("might", 0));
  });

  it("rebirth gain grows with floor and level", () => {
    expect(computeRebirthGain(10, 5)).toBeGreaterThan(computeRebirthGain(1, 1));
  });
});

describe("class unlocks", () => {
  it("base classes are always unlocked", () => {
    const p = defaultProgress();
    expect(isClassUnlocked("adventurer", p)).toBe(true);
    expect(isClassUnlocked("warrior", p)).toBe(true);
  });

  it("advanced classes are locked at zero progress", () => {
    const p = defaultProgress();
    expect(isClassUnlocked("paladin", p)).toBe(false);
  });

  it("there are no duplicate class ids", () => {
    const ids = new Set(CLASSES.map((c) => c.id));
    expect(ids.size).toBe(CLASSES.length);
  });
});

describe("difficulty", () => {
  it("harder difficulties scale enemies and rewards up", () => {
    expect(getDifficulty("hell").enemyMult).toBeGreaterThan(getDifficulty("normal").enemyMult);
    expect(getDifficulty("hard").rewardMult).toBeGreaterThan(getDifficulty("normal").rewardMult);
  });
});

describe("daily bonus", () => {
  it("is deterministic for the same seed", () => {
    expect(getDailyBonus("2026-06-14").id).toBe(getDailyBonus("2026-06-14").id);
  });
});

describe("enemies", () => {
  it("has 50 distinct normal templates", () => {
    expect(ENEMY_TEMPLATES.length).toBe(50);
    const ids = new Set(ENEMY_TEMPLATES.map((e) => e.id));
    expect(ids.size).toBe(50);
  });

  it("generates a boss on every 5th floor with gimmick fields", () => {
    const boss = generateEnemy(5);
    expect(boss.isBoss).toBe(true);
    expect(boss.enraged).toBe(false);
    expect(boss.weakenTurns).toBe(0);
  });
});
