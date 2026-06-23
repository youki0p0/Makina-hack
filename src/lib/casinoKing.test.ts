import { describe, expect, it } from "vitest";
import {
  kingSpinWithPity,
  KING_BET,
  KING_JACKPOT,
  KING_JACKPOT_HI,
  KING_SMALL_PAY,
  KING_SMALL_CEILING,
} from "@/lib/casinoKing";
import { computeSetEffects, availableSetKeys, SETS } from "@/data/sets";
import { genSetItem } from "@/data/items";
import { EQUIP_SLOTS } from "@/lib/battle";
import type { EquipmentSlot, EquippedItems } from "@/types/game";

function emptyEquipped(): EquippedItems {
  return EQUIP_SLOTS.reduce((o, s) => ({ ...o, [s]: null }), {} as EquippedItems);
}

describe("カジノ王のスロット（小当たり→挑戦→一撃）", () => {
  it("RTP≈0.7。一撃は小当たり払い＋10万コイン＋ハイコイン", () => {
    let inB = 0;
    let out = 0;
    let hi = 0;
    let jp = 0;
    let pity = 0;
    const N = 4_000_000;
    for (let i = 0; i < N; i++) {
      inB += KING_BET;
      const { result, nextPity } = kingSpinWithPity(pity);
      pity = nextPity;
      out += result.coins;
      hi += result.hi;
      if (result.outcome === "jackpot") {
        jp++;
        expect(result.coins).toBe(KING_SMALL_PAY + KING_JACKPOT);
        expect(result.hi).toBe(KING_JACKPOT_HI);
        expect(result.challenge).toBe(true);
      }
    }
    const rtp = out / inB;
    expect(rtp).toBeGreaterThan(0.6);
    expect(rtp).toBeLessThan(0.85); // ≈0.7
    expect(jp).toBeGreaterThan(0); // まれに一撃
    expect(hi).toBeGreaterThan(0); // 一撃でハイコイン
  });

  it("天井: 小当たりなしで KING_SMALL_CEILING 回まわすと、その回で小当たり確定", () => {
    const alwaysMiss = () => 0.999; // 自然小当たり(1/200)も挑戦勝利(1/10)も引かない
    let pity = 0;
    let spins = 0;
    let firstHit = -1;
    while (spins < KING_SMALL_CEILING) {
      const { result, nextPity } = kingSpinWithPity(pity, alwaysMiss);
      spins++;
      pity = nextPity;
      if (result.outcome !== "miss") {
        firstHit = spins;
        expect(result.outcome).toBe("smallLose"); // 天井小当たり→挑戦は敗北
        expect(result.coins).toBe(KING_SMALL_PAY);
        break;
      }
    }
    expect(firstHit).toBe(KING_SMALL_CEILING); // ちょうど200回転目で小当たり
  });

  it("挑戦勝利で一撃、天井カウンタは0に戻る", () => {
    const alwaysHit = () => 0; // 小当たり成立(0<1/200)＆挑戦勝利(0<1/10)
    const { result, nextPity } = kingSpinWithPity(123, alwaysHit);
    expect(result.outcome).toBe("jackpot");
    expect(nextPity).toBe(0);
  });
});

describe("伝説賭博セット", () => {
  it("通常ドロップ/交換には出ない(kingOnly)が、6部位で全効果が発動", () => {
    expect(SETS.find((s) => s.key === "legendgambler")?.kingOnly).toBe(true);
    expect(availableSetKeys(5000)).not.toContain("legendgambler");
    const eq = emptyEquipped();
    for (const slot of EQUIP_SLOTS as EquipmentSlot[]) eq[slot] = genSetItem("legendgambler", slot, 100);
    const eff = computeSetEffects(eq);
    // 2pc: リロール6確定＋30%で与ダメージ2倍。
    expect(eff.rerollSix).toBe(true);
    expect(eff.doubleDmgChance).toBeCloseTo(0.3);
    // 4pc: 回避45%。
    expect(eff.dodgeChance).toBeGreaterThan(0.4);
    // 6pc: ドロップ率2倍＋レアドロップ比率増加。
    expect(eff.dropRateMult).toBeCloseTo(2);
    expect(eff.rareDropBonus).toBeGreaterThan(0);
    // 6pc 隠し効果: 強化ドロップ(★最大+1・変動ステ最大級)。UI非表示だが効果は有効。
    expect(eff.dropUpgradeChance).toBeGreaterThan(0);
  });
});
