import { describe, expect, it } from "vitest";
import { kingSpin, KING_BET, KING_JACKPOT, KING_JACKPOT_HI } from "@/lib/casinoKing";
import { computeSetEffects, availableSetKeys, SETS } from "@/data/sets";
import { genSetItem } from "@/data/items";
import { EQUIP_SLOTS } from "@/lib/battle";
import type { EquipmentSlot, EquippedItems } from "@/types/game";

function emptyEquipped(): EquippedItems {
  return EQUIP_SLOTS.reduce((o, s) => ({ ...o, [s]: null }), {} as EquippedItems);
}

describe("カジノ王の一撃台", () => {
  it("RTP≈0.7（少し負け越す投資台）で、一撃はKING_JACKPOT＋ハイコイン", () => {
    let inB = 0,
      out = 0,
      hi = 0,
      jp = 0;
    const N = 4_000_000;
    for (let i = 0; i < N; i++) {
      inB += KING_BET;
      const r = kingSpin();
      out += r.coins;
      hi += r.hi;
      if (r.kind === "jackpot") {
        jp++;
        expect(r.coins).toBe(KING_JACKPOT);
        expect(r.hi).toBe(KING_JACKPOT_HI);
      }
    }
    const rtp = out / inB;
    expect(rtp).toBeGreaterThan(0.6);
    expect(rtp).toBeLessThan(0.85); // ≈0.7
    expect(jp).toBeGreaterThan(0); // まれに一撃が出る
    expect(hi).toBeGreaterThan(0); // 一撃でハイコイン獲得
  });
});

describe("伝説賭博セット", () => {
  it("通常ドロップ/交換には出ない(kingOnly)が、6部位で全効果が発動", () => {
    expect(SETS.find((s) => s.key === "legendgambler")?.kingOnly).toBe(true);
    // 深い階でも availableSetKeys に legendgambler は含まれない。
    expect(availableSetKeys(5000)).not.toContain("legendgambler");
    // 6部位そろえると 回避/リロール6確定/ドロップ超向上 が立つ。
    const eq = emptyEquipped();
    for (const slot of EQUIP_SLOTS as EquipmentSlot[]) eq[slot] = genSetItem("legendgambler", slot, 100);
    const eff = computeSetEffects(eq);
    expect(eff.dodgeChance).toBeGreaterThan(0.3);
    expect(eff.rerollSix).toBe(true);
    expect(eff.dropTierBonus).toBeGreaterThanOrEqual(10);
  });
});
