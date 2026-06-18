import { describe, expect, it } from "vitest";
import {
  fateCost,
  FATE_WIN_CHANCE,
  drawSlotOutcome,
  slotPayout,
  slotReels,
  pickReach,
  atSpinPayout,
  atRensho,
  AT_GAMES,
  SLOT_REACHES,
  SLOT_SYMBOL,
  machineSettings,
  settingMult,
  ceilingSpins,
  MACHINE_COUNT,
  SLOT_LUCK,
  coinBuyCost,
  coinBuyMax,
  COIN_VALUE,
  type SlotOutcome,
} from "@/lib/casino";

describe("運命の大博打 (fate gamble)", () => {
  it("keeps a deliberately tiny win chance (低期待値)", () => {
    expect(FATE_WIN_CHANCE).toBeGreaterThan(0);
    expect(FATE_WIN_CHANCE).toBeLessThanOrEqual(0.1);
  });

  it("fateCost has a floor and scales with the player's best tier", () => {
    expect(fateCost(0)).toBe(3000); // floor for fresh saves
    expect(fateCost(10)).toBe(3000); // still under the floor
    expect(fateCost(60)).toBe(60 * 80); // late-game gold sink
    expect(fateCost(100)).toBeGreaterThan(fateCost(60));
  });
});

describe("slot machine (パチスロ4号機フレーバー)", () => {
  it("drawSlotOutcome always returns a valid outcome", () => {
    const valid: SlotOutcome[] = ["big", "reg", "replay", "watermelon", "cherry", "bell", "miss"];
    for (let i = 0; i < 2000; i++) {
      expect(valid).toContain(drawSlotOutcome());
    }
  });

  it("reels match the outcome's winning line", () => {
    expect(slotReels("big", false)).toEqual([7, 7, 7]);
    expect(slotReels("reg", false)).toEqual([SLOT_SYMBOL.bar, SLOT_SYMBOL.bar, SLOT_SYMBOL.bar]);
    expect(slotReels("replay", false)).toEqual([1, 1, 1]);
    expect(slotReels("bell", false)).toEqual([2, 2, 2]);
    expect(slotReels("watermelon", false)).toEqual([5, 5, 5]);
    expect(slotReels("cherry", false)[0]).toBe(SLOT_SYMBOL.cherry); // 左リールにチェリー
  });

  it("a miss never shows an accidental triple, and a reach near-misses on 7", () => {
    for (let i = 0; i < 500; i++) {
      const [a, b, c] = slotReels("miss", false);
      expect(a === b && b === c).toBe(false);
    }
    const reach = slotReels("miss", true);
    expect(reach[0]).toBe(7);
    expect(reach[1]).toBe(7);
    expect(reach[2]).not.toBe(7);
  });

  it("payouts rank bonuses over small roles; replay pays 0 (free spin instead)", () => {
    expect(slotPayout("replay")).toBe(0);
    expect(slotPayout("big")).toBe(0); // BIG pays via ダイスラッシュ(AT)
    expect(slotPayout("reg")).toBeGreaterThan(slotPayout("bell"));
    expect(slotPayout("watermelon")).toBeGreaterThan(slotPayout("cherry"));
  });

  it("ダイスラッシュ(AT) grants a long run and pays modestly per game", () => {
    expect(AT_GAMES).toBeGreaterThanOrEqual(80); // ~100回転のATタイム
    let total = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const p = atSpinPayout();
      expect(p).toBeGreaterThanOrEqual(1);
      total += p;
    }
    const avg = total / N;
    expect(avg).toBeGreaterThan(2); // 平均は控えめ(出玉が無限に増えない)
    expect(avg).toBeLessThan(6);
  });

  it("AT上乗せ(atRensho): 期待値<1で収束しつつ、稀に特大(700G級)が出る", () => {
    let hits = 0;
    let total = 0;
    let big = 0;
    const N = 200000;
    for (let i = 0; i < N; i++) {
      const a = atRensho();
      if (a > 0) {
        hits++;
        expect(a).toBeGreaterThanOrEqual(5);
      }
      if (a >= 350) big++; // 特大上乗せ
      total += a;
    }
    // 1ゲームあたりの期待上乗せ < 1 でないとATが発散して「終わらない」。
    expect(total / N).toBeLessThan(1);
    expect(hits).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(0); // 運がいいと特大上乗せ(+350〜600G)が降る
  });

  it("設定差: 4台の隠し設定(1-6)が6時間バケットで変わる", () => {
    const a = machineSettings(100);
    const b = machineSettings(101);
    expect(a).toHaveLength(MACHINE_COUNT);
    for (const s of a) {
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(6);
    }
    // 同じバケットなら決定論的、別バケットでは(ほぼ)変わる。
    expect(machineSettings(100)).toEqual(a);
    expect(a.join() === b.join()).toBe(false);
  });

  it("カジノコインの買値は所持枚数が多いほど割高(買いづらく)", () => {
    // 0枚のときは基本レート、保有が増えるほど単価が上がる。
    expect(coinBuyCost(50, 0)).toBe(50 * COIN_VALUE);
    expect(coinBuyCost(50, 400)).toBeGreaterThan(coinBuyCost(50, 0));
    // 換金(COIN_VALUE)より買値の単価が常に高い→裁定取引にならない。
    expect(coinBuyCost(100, 100) / 100).toBeGreaterThanOrEqual(COIN_VALUE);
  });

  it("全購入(coinBuyMax)は所持ゴールドで買える最大枚数を返す(超過しない)", () => {
    expect(coinBuyMax(0, 0)).toBe(0);
    const n = coinBuyMax(100000, 0);
    expect(n).toBeGreaterThan(0);
    expect(coinBuyCost(n, 0)).toBeLessThanOrEqual(100000); // 予算超過しない
    expect(coinBuyCost(n + 1, 0)).toBeGreaterThan(100000); // これ以上は買えない
    // 所持が多いほど割高 → 同じゴールドで買える枚数は減る。
    expect(coinBuyMax(100000, 1000)).toBeLessThan(coinBuyMax(100000, 0));
  });

  it("当たりを約1.3倍出やすくする係数(SLOT_LUCK)", () => {
    expect(SLOT_LUCK).toBeCloseTo(1.3, 2);
    // ベース確率に1.3倍が乗るので、当たり率はおよそ 1/185 程度に上がる。
    let bonus = 0;
    const N = 60000;
    for (let i = 0; i < N; i++) {
      const o = drawSlotOutcome(1);
      if (o === "big" || o === "reg") bonus++;
    }
    const rate = N / bonus;
    expect(rate).toBeLessThan(240); // 1.3倍前(約1/144合算)より明確に出やすい
  });

  it("高設定ほど機械割が良く天井が浅い", () => {
    expect(settingMult(6)).toBeGreaterThan(settingMult(1));
    expect(ceilingSpins(6)).toBeLessThan(ceilingSpins(1));
  });

  it("ボーナス倍率を上げるとBIG/REGが出やすくなる(連チャンゾーン/設定差)", () => {
    const count = (mult: number) => {
      let n = 0;
      for (let i = 0; i < 6000; i++) {
        const o = drawSlotOutcome(mult);
        if (o === "big" || o === "reg") n++;
      }
      return n;
    };
    expect(count(6)).toBeGreaterThan(count(1));
  });

  it("losing reaches never use guaranteed (tier5) productions", () => {
    for (let i = 0; i < 300; i++) {
      const r = pickReach(false);
      expect(r.guaranteed).not.toBe(true);
      expect(r.tier).toBeLessThanOrEqual(4); // gase can reach カットイン(t4) but no further
    }
    // there are ~10 named reach productions
    expect(SLOT_REACHES.length).toBeGreaterThanOrEqual(10);
  });
});
