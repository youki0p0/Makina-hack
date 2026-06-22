import { describe, expect, it } from "vitest";
import { ABYSS_MODIFIERS, abyssModifierFor, applyAbyss } from "@/data/abyss";
import type { Enemy } from "@/types/game";

function mkEnemy(): Enemy {
  return {
    id: "t", templateId: "t", name: "敵", emoji: "👾",
    maxHp: 1000, hp: 1000, attack: 100, defense: 10, exp: 0, gold: 0,
    dropRate: 0.1, isBoss: false, statuses: [], stunTurns: 0, ability: null,
    bonusDefense: 0, bonusDefenseTurns: 0, weakenAmount: 0, weakenTurns: 0,
    enraged: false, charging: false, chargeCounter: 0, modTier: 0,
    lifestealImmune: false, multiHitResist: false, statusResist: false, executeImmune: false,
  };
}

describe("abyssModifierFor (帯ごとの理)", () => {
  it("is null at and below floor 1000 (本編は不変)", () => {
    expect(abyssModifierFor(1)).toBeNull();
    expect(abyssModifierFor(1000)).toBeNull();
  });
  it("maps 100-floor bands deterministically and cycles", () => {
    expect(abyssModifierFor(1001)).toBe(ABYSS_MODIFIERS[0]);
    expect(abyssModifierFor(1100)).toBe(ABYSS_MODIFIERS[0]);
    expect(abyssModifierFor(1101)).toBe(ABYSS_MODIFIERS[1]);
    // 6 modifiers → one full cycle every 600 floors.
    expect(abyssModifierFor(1001 + 600)).toBe(ABYSS_MODIFIERS[0]);
  });
});

describe("applyAbyss", () => {
  it("leaves floors ≤1000 untouched", () => {
    const e = mkEnemy();
    expect(applyAbyss(e, 1000)).toBe(e);
  });
  it("sets the band's trait flag (e.g. 多頭の層 → multiHitResist)", () => {
    expect(applyAbyss(mkEnemy(), 1001).multiHitResist).toBe(true);
  });
  it("immortal band makes normal enemies execute-immune", () => {
    // band index 3 = 不滅の層 → floor 1301..1400
    expect(abyssModifierFor(1301).id).toBe("immortal");
    expect(applyAbyss(mkEnemy(), 1301).executeImmune).toBe(true);
  });
  it("applies stat multipliers (剛力 ×1.25 atk / 鉄壁 ×1.4 hp)", () => {
    expect(abyssModifierFor(1401).id).toBe("might");
    expect(applyAbyss(mkEnemy(), 1401).attack).toBe(125);
    expect(abyssModifierFor(1501).id).toBe("fortress");
    const f = applyAbyss(mkEnemy(), 1501);
    expect(f.maxHp).toBe(1400);
    expect(f.hp).toBe(1400);
  });
});
