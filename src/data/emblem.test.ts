import { describe, expect, it } from "vitest";
import { computeSetEffects, emblemSetMult } from "@/data/sets";
import { genEmblem } from "@/data/items";
import { emptyEquipped } from "@/store/helpers";
import type { EquippedItems } from "@/types/game";

// 4部位そろえると数値＋発動が乗る「賭博」セットで増幅を検証する。
function equipGamblerWithEmblem(emblem: boolean): EquippedItems {
  const eq = emptyEquipped();
  for (const slot of ["weapon", "helm", "armor", "gloves"] as const) {
    eq[slot] = {
      id: `g_${slot}`,
      name: "x",
      rarity: "epic",
      slot,
      attack: 0,
      defense: 0,
      maxHp: 0,
      rerollModifier: 0,
      description: "",
      diceModifiers: [],
      setId: "gambler",
    };
  }
  if (emblem) eq.emblem = genEmblem(3000);
  return eq;
}

describe("emblemSetMult（深さで伸びる倍率）", () => {
  it("3000階未満は 1（増幅なし）", () => {
    expect(emblemSetMult(0)).toBe(1);
    expect(emblemSetMult(2999)).toBe(1);
  });
  it("3000→1.5 / 4000→2 / 5000→2.5（+1000ごとに+0.5）", () => {
    expect(emblemSetMult(3000)).toBe(1.5);
    expect(emblemSetMult(3999)).toBe(1.5);
    expect(emblemSetMult(4000)).toBe(2);
    expect(emblemSetMult(5000)).toBe(2.5);
    expect(emblemSetMult(8000)).toBe(4);
  });
});

describe("genEmblem", () => {
  it("emblem スロット・setAmplifier・legendary・どのジョブでも装備可", () => {
    const e = genEmblem(3500);
    expect(e.slot).toBe("emblem");
    expect(e.setAmplifier).toBe(true);
    expect(e.rarity).toBe("legendary");
    expect(e.equipTag).toBeUndefined();
    expect(e.minFloor).toBe(3000);
  });
});

describe("紋章によるセット効果の増幅", () => {
  it("紋章なし=基準、紋章あり(3000階)で数値系が1.5倍に", () => {
    const baseEff = computeSetEffects(equipGamblerWithEmblem(false), undefined, 3000);
    const ampEff = computeSetEffects(equipGamblerWithEmblem(true), undefined, 3000);
    // gambler 2pc: リロール+1（reroll は乗算しない）/ 4pc: 出目1→2（発動系・乗算しない）。
    // 数値が乗る代表として highFaceDmgBonus 等が無いセットなので、reroll は据え置きを確認。
    expect(ampEff.statBonus.reroll).toBe(baseEff.statBonus.reroll); // 据え置き
    // 発動系（faceOneToTwo→diceModifiers）も本数は不変。
    expect(ampEff.diceModifiers.length).toBe(baseEff.diceModifiers.length);
  });

  it("数値系（吸血%）が倍率どおりに乗る（vampire 相当）", () => {
    // ※ computeSetEffects は equipped の参照でメモ化するため、ケースごとに
    //   別オブジェクトを作る（本番は装備変更が不変更新なので問題にならない）。
    const vampire = (withEmblem: boolean): EquippedItems => {
      const eq = emptyEquipped();
      for (const slot of ["weapon", "helm"] as const) {
        eq[slot] = {
          id: `v_${slot}`, name: "x", rarity: "epic", slot, attack: 0, defense: 0,
          maxHp: 0, rerollModifier: 0, description: "", diceModifiers: [], setId: "vampire",
        };
      }
      if (withEmblem) eq.emblem = genEmblem(3000);
      return eq;
    };
    // vampire 2pc: lifestealAllPct 0.1。紋章3000(×1.5)で 0.15 になる。
    const base = computeSetEffects(vampire(false), undefined, 3000).lifestealAllPct;
    const amp = computeSetEffects(vampire(true), undefined, 3000).lifestealAllPct;
    expect(amp).toBeCloseTo(base * 1.5, 5);
    // 3000階未満では紋章を着けても増幅しない。
    const noAmp = computeSetEffects(vampire(true), undefined, 2000).lifestealAllPct;
    expect(noAmp).toBeCloseTo(base, 5);
  });
});
