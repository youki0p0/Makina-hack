import { describe, expect, it } from "vitest";
import { capEmblems, MAX_EMBLEMS } from "@/store/helpers";
import { genEmblem } from "@/data/items";
import type { Equipment } from "@/types/game";

describe("紋章ストック（装備とは別枠・最大30）", () => {
  it("MAX_EMBLEMS は 30", () => {
    expect(MAX_EMBLEMS).toBe(30);
  });

  it("30以内はそのまま、超過分は弱い方から自動分解", () => {
    const under: Equipment[] = Array.from({ length: 30 }, () => genEmblem(3000));
    expect(capEmblems(under, []).kept).toHaveLength(30);
    expect(capEmblems(under, []).material).toBe(0);

    const over: Equipment[] = Array.from({ length: 35 }, () => genEmblem(3000));
    const res = capEmblems(over, []);
    expect(res.kept).toHaveLength(30);
    expect(res.material).toBeGreaterThan(0); // 5個ぶんの素材
  });

  it("ロック(noSell/お気に入り)は分解されない", () => {
    const items: Equipment[] = Array.from({ length: 35 }, (_, i) => ({
      ...genEmblem(3000),
      id: `emblem_test_${i}`,
      noSell: i < 32, // 32個はロック
    }));
    const res = capEmblems(items, []);
    // ロック32個は全て残る（上限30を超えてでも保護される）。
    expect(res.kept.filter((e) => e.noSell)).toHaveLength(32);
  });
});
