import { describe, expect, it } from "vitest";
import { resolvePlayerAction } from "@/lib/battle";
import type { ComputedStats, DiceFace, Enemy } from "@/types/game";

const stats: ComputedStats = {
  attack: 100,
  defense: 10,
  maxHp: 100,
  reroll: 0,
} as ComputedStats;

function enemyWithAttack(attack: number): Enemy {
  return { name: "敵", attack, defense: 0, hp: 999999, maxHp: 999999 } as Enemy;
}

function faceWithEffect(effect: Partial<DiceFace["effect"]>): DiceFace {
  return {
    value: 4,
    name: "呪詛",
    kind: "normal",
    effect: {
      damageMultiplier: 1,
      guard: 0,
      heal: 0,
      lifestealPct: 0,
      extraHits: 0,
      isMiss: false,
      ...effect,
    },
  } as DiceFace;
}

describe("weakenPct（割合弱体は深層でスケールする）", () => {
  it("弱体量 = 付与時の敵攻撃 × weakenPct", () => {
    const face = faceWithEffect({ weakenPct: 0.35 });
    expect(resolvePlayerAction(face, stats, enemyWithAttack(100)).weaken).toBe(35);
    // 深層で敵攻撃が大きいほど弱体も大きくなる（固定値と違い誤差にならない）。
    expect(resolvePlayerAction(face, stats, enemyWithAttack(10000)).weaken).toBe(3500);
  });

  it("固定 weaken と weakenPct は高い方を採用", () => {
    const face = faceWithEffect({ weaken: 8, weakenPct: 0.35 });
    expect(resolvePlayerAction(face, stats, enemyWithAttack(10)).weaken).toBe(8); // 10*0.35=3.5<8
    expect(resolvePlayerAction(face, stats, enemyWithAttack(1000)).weaken).toBe(350); // >8
  });

  it("どちらも無ければ弱体なし", () => {
    expect(resolvePlayerAction(faceWithEffect({}), stats, enemyWithAttack(500)).weaken).toBe(0);
  });
});
