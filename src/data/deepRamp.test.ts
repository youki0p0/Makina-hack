import { describe, expect, it } from "vitest";
import { applyEnemyModifier } from "@/data/modifiers";
import type { Enemy } from "@/types/game";

function base(): Enemy {
  return { name: "x", attack: 100, defense: 0, hp: 1000, maxHp: 1000, dropRate: 0.3 } as Enemy;
}
const atk = (tier: number) => applyEnemyModifier(base(), tier).attack;

describe("深層の敵ランプ再加速（2万階以上を段階的に難化）", () => {
  it("10,000階(tier200)までは従来どおり（再加速なし）", () => {
    // tier200 の ramp = 0.13 + (20-8)*0.02 = 0.37 → mult = 1 + 0.37*200 = 75
    expect(atk(200)).toBe(Math.round(100 * (1 + 0.37 * 200)));
  });

  it("1000階以下(tier20)は完全に不変", () => {
    expect(atk(20)).toBe(Math.round(100 * (1 + 0.37 * 20)));
  });

  it("20,000階は線形外挿の倍以上＝超線形に難化", () => {
    const linearAt400 = 100 * (1 + 0.37 * 400); // 旧（頭打ち線形）の想定値
    expect(atk(400)).toBeGreaterThan(linearAt400 * 1.8);
  });

  it("深層ほど比率が伸びる（tier400/200 > tier200/100＝加速している）", () => {
    const r1 = atk(200) / atk(100);
    const r2 = atk(400) / atk(200);
    expect(r2).toBeGreaterThan(r1);
  });

  it("単調増加", () => {
    let prev = 0;
    for (let t = 100; t <= 800; t += 50) {
      const a = atk(t);
      expect(a).toBeGreaterThan(prev);
      prev = a;
    }
  });
});
