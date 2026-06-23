import { describe, expect, it } from "vitest";
import { DICE_FACES, faceById, spinDailyDice, type DiceFaceId } from "./dailyDice";

describe("dailyDice", () => {
  it("各面は出目1..6ぶんの報酬を持つ", () => {
    for (const f of DICE_FACES) {
      expect(f.rewards).toHaveLength(6);
      for (const r of f.rewards) expect(r.amount).toBeGreaterThan(0);
    }
  });

  it("faceById は未知idで null", () => {
    expect(faceById("atk")?.id).toBe("atk");
    expect(faceById("nope")).toBeNull();
  });

  it("同じ日・同じ面なら出目と報酬が固定（リロール不可）", () => {
    const a = spinDailyDice("luck", "2026-06-23");
    const b = spinDailyDice("luck", "2026-06-23");
    expect(a).toEqual(b);
    expect(a.value).toBeGreaterThanOrEqual(1);
    expect(a.value).toBeLessThanOrEqual(6);
  });

  it("出目に対応する報酬がテーブルと一致する", () => {
    const seed = "2026-07-01";
    for (const id of ["atk", "def", "luck"] as DiceFaceId[]) {
      const { value, reward } = spinDailyDice(id, seed);
      expect(reward).toEqual(faceById(id)!.rewards[value - 1]);
    }
  });

  it("面を変えると出目が変わりうる（シードに面idを混ぜている）", () => {
    const seed = "2026-06-23";
    const values = new Set(
      (["atk", "def", "luck"] as DiceFaceId[]).map((id) => spinDailyDice(id, seed).value),
    );
    // 3面すべて同じ出目になることはまずない（面idでシードがずれるため）。
    expect(values.size).toBeGreaterThan(1);
  });

  it("各面の出目6は大当たり：コイン1000 / 刻印1 / 魂1（等価設計）", () => {
    expect(faceById("atk")!.rewards[5]).toEqual({ kind: "coins", amount: 1000 });
    expect(faceById("def")!.rewards[5]).toEqual({ kind: "sigil", amount: 1 });
    expect(faceById("luck")!.rewards[5]).toEqual({ kind: "souls", amount: 1 });
  });

  it("💠刻印は経済保護のため『守りの出目6』1枠のみ（ばら撒かない）", () => {
    const sigilSlots = DICE_FACES.flatMap((f) => f.rewards).filter((r) => r.kind === "sigil");
    expect(sigilSlots).toHaveLength(1);
    expect(sigilSlots[0]).toEqual({ kind: "sigil", amount: 1 });
  });

  it("出目6はその面の大当たり（テーブル末尾）", () => {
    // 出目6が出る日を探して、報酬が末尾と一致することを確認。
    let found = false;
    for (let d = 1; d <= 60 && !found; d++) {
      const seed = `2026-08-${d}`;
      const { value, reward } = spinDailyDice("luck", seed);
      if (value === 6) {
        expect(reward).toEqual(faceById("luck")!.rewards[5]);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
