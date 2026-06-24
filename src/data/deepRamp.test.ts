import { describe, expect, it } from "vitest";
import { applyEnemyModifier } from "@/data/modifiers";
import type { Enemy } from "@/types/game";

function base(): Enemy {
  return { name: "x", attack: 100, defense: 0, hp: 1000, maxHp: 1000, dropRate: 0.3 } as Enemy;
}
const atk = (tier: number) => applyEnemyModifier(base(), tier).attack;

describe("深層の敵ランプ（3,000階の新コンテンツ帯から急峻に難化）", () => {
  it("3,000階以下(tier60)は完全に不変", () => {
    // tier<=60 は max(0, tier-60)=0 で再加速なし。ramp=0.37 → mult=1+0.37*tier
    expect(atk(60)).toBe(Math.round(100 * (1 + 0.37 * 60))); // 3,000階
    expect(atk(40)).toBe(Math.round(100 * (1 + 0.37 * 40))); // 2,000階
    expect(atk(20)).toBe(Math.round(100 * (1 + 0.37 * 20))); // 1,000階
  });

  it("5,000階(tier100) ≒ 旧50,000階級（約2.4万倍）", () => {
    // tier100: ramp = 0.37 + (100-60)*6 = 240.37 → mult = 1 + 240.37*100 = 24,038
    expect(atk(100)).toBe(Math.round(100 * (1 + (0.37 + 40 * 6) * 100)));
    expect(atk(100) / 100).toBeGreaterThan(20000);
  });

  it("3,000→4,000→5,000 で急加速（超線形）", () => {
    const r1 = atk(80) / atk(60); // 3000→4000
    const r2 = atk(100) / atk(80); // 4000→5000
    expect(atk(80)).toBeGreaterThan(atk(60));
    expect(r1).toBeGreaterThan(5); // 1000階で一気に重くなる
    expect(r2).toBeGreaterThan(1);
  });

  it("単調増加", () => {
    let prev = 0;
    for (let t = 20; t <= 200; t += 20) {
      const a = atk(t);
      expect(a).toBeGreaterThan(prev);
      prev = a;
    }
  });
});
