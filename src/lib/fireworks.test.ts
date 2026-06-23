import { describe, expect, it } from "vitest";
import {
  claimableMilestones,
  fireworksMedal,
  isJuly,
  resolveShot,
  runFireworks,
  SUMMER_MILESTONES,
} from "./fireworks";

describe("fireworks", () => {
  it("isJuly は7月のみ true", () => {
    expect(isJuly(new Date(2026, 6, 1))).toBe(true); // 7月
    expect(isJuly(new Date(2026, 5, 30))).toBe(false); // 6月
    expect(isJuly(new Date(2026, 7, 1))).toBe(false); // 8月
  });

  it("3以下はコンボ無し・素点（出目×10）", () => {
    expect(resolveShot(3, 0)).toEqual({ value: 3, points: 30, combo: 0 });
    expect(resolveShot(2, 5)).toEqual({ value: 2, points: 20, combo: 0 }); // コンボ途切れ
  });

  it("4以上は連続でコンボ倍率が上がる（+0.5/段）", () => {
    const a = resolveShot(4, 0); // combo1 → ×1.5
    expect(a.combo).toBe(1);
    expect(a.points).toBe(Math.round(4 * 10 * 1.5)); // 60
    const b = resolveShot(5, 1); // combo2 → ×2.0
    expect(b.combo).toBe(2);
    expect(b.points).toBe(Math.round(5 * 10 * 2.0)); // 100
  });

  it("出目6は大輪 +50", () => {
    const o = resolveShot(6, 0); // combo1 ×1.5 → 90 +50
    expect(o.points).toBe(Math.round(6 * 10 * 1.5) + 50);
  });

  it("runFireworks は内訳と合計を返す", () => {
    const { shots, total } = runFireworks([6, 6, 6, 1, 4]);
    expect(shots).toHaveLength(5);
    expect(total).toBe(shots.reduce((s, o) => s + o.points, 0));
    // 出目1でコンボがリセットされる。
    expect(shots[3].combo).toBe(0);
    expect(shots[4].combo).toBe(1);
  });

  it("メダルはスコア帯で変わる", () => {
    expect(fireworksMedal(0)).toBe("🎆");
    expect(fireworksMedal(1000)).toBe("🥉");
    expect(fireworksMedal(3000)).toBe("🥈");
    expect(fireworksMedal(8000)).toBe("🥇");
    expect(fireworksMedal(15000)).toBe("🌈");
  });

  it("マイルストーンは自己ベスト以上かつ未受領のみ返る", () => {
    expect(claimableMilestones(0, []).map((m) => m.id)).toEqual(["join"]);
    expect(claimableMilestones(3500, ["join"]).map((m) => m.id)).toEqual(["s3000"]);
    expect(claimableMilestones(20000, ["join", "s3000", "s8000", "s15000"])).toEqual([]);
    expect(SUMMER_MILESTONES.every((m) => m.reward.amount > 0)).toBe(true);
  });
});
