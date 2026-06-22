import { describe, expect, it } from "vitest";
import { applyEnemyModifier } from "@/data/modifiers";
import type { Enemy } from "@/types/game";

function mkEnemy(): Enemy {
  return {
    id: "t",
    templateId: "t",
    name: "敵",
    emoji: "👾",
    maxHp: 100000,
    hp: 100000,
    attack: 100000,
    defense: 0,
    exp: 0,
    gold: 0,
    dropRate: 0.1,
    isBoss: false,
    statuses: [],
    stunTurns: 0,
    ability: null,
    bonusDefense: 0,
    bonusDefenseTurns: 0,
    weakenAmount: 0,
    weakenTurns: 0,
    enraged: false,
    charging: false,
    chargeCounter: 0,
    modTier: 0,
  };
}

/** Resolved HP multiplier for a given enemy ★ tier. */
function mult(tier: number): number {
  return applyEnemyModifier(mkEnemy(), tier).maxHp / 100000;
}

describe("applyEnemyModifier ramp cap (登れる無限の敵カーブ)", () => {
  it("leaves tiers ≤20 (floor ≤1000) on the original ramp", () => {
    // tier20: 1 + (0.13 + (20-8)*0.02)*20 = 1 + 0.37*20 = 8.4
    expect(mult(20)).toBeCloseTo(8.4, 5);
    // tier8 boundary unchanged: 1 + 0.13*8 = 2.04
    expect(mult(8)).toBeCloseTo(2.04, 5);
  });

  it("grows linearly (not quadratically) beyond tier 20", () => {
    // ramp frozen at 0.37 → mult = 1 + 0.37*tier, constant per-tier increment.
    const d1 = mult(40) - mult(30);
    const d2 = mult(30) - mult(20);
    expect(d1).toBeCloseTo(d2, 5);
    expect(mult(52)).toBeCloseTo(1 + 0.37 * 52, 5); // floor 2600 → ×20.24 (was ×53.5)
  });

  it("is continuous at the tier-20 cap", () => {
    expect(mult(21) - mult(20)).toBeCloseTo(0.37, 5);
  });
});
