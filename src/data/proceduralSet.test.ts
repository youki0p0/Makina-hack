import { describe, expect, it } from "vitest";
import { proceduralSetDef } from "@/data/sets";

describe("手続き生成セットのバランス（上の下帯に統一）", () => {
  it("常に 2/4/6 部位の3段構成", () => {
    for (let n = 0; n < 60; n++) {
      const def = proceduralSetDef(n);
      expect(def.bonuses.map((b) => b.pieces)).toEqual([2, 4, 6]);
    }
  });

  it("flat攻撃/HPは使わず割合(attackPct/maxHpPct)で深層スケール", () => {
    for (let n = 0; n < 60; n++) {
      for (const b of proceduralSetDef(n).bonuses) {
        expect(b.attack ?? 0).toBe(0); // flat攻撃は廃止
        expect(b.maxHp ?? 0).toBe(0); // flat HPは廃止
      }
    }
  });

  it("6部位は必ずビルド定義級の大効果（小効果が6部位に来ない）", () => {
    const bigKeys = [
      "rollTwoDice",
      "sixDouble",
      "lifestealAllPct",
      "executePct",
      "sixDmgBonus",
    ] as const;
    for (let n = 0; n < 60; n++) {
      const six = proceduralSetDef(n).bonuses.find((b) => b.pieces === 6)!;
      expect(bigKeys.some((k) => (six as Record<string, unknown>)[k])).toBe(true);
    }
  });
});
