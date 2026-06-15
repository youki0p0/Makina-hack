import { describe, expect, it } from "vitest";
import { computeSetEffects, setPieceId, SETS } from "@/data/sets";
import { applyQuality, rollQuality } from "@/data/quality";
import { getItemById, getItemInstance, makeMakina, MAKINA_ID } from "@/data/items";
import { EQUIP_SLOTS } from "@/lib/battle";
import type { EquipmentSlot, EquippedItems, SetId } from "@/types/game";

function emptyEquipped(): EquippedItems {
  return {
    weapon: null,
    helm: null,
    armor: null,
    gloves: null,
    boots: null,
    accessory: null,
  };
}

/** Equip the first `n` slots with pieces of the given set. */
function equipSet(setId: SetId, n: number): EquippedItems {
  const eq = emptyEquipped();
  const slots = EQUIP_SLOTS.slice(0, n) as EquipmentSlot[];
  for (const slot of slots) {
    eq[slot] = getItemById(setPieceId(setId, slot));
  }
  return eq;
}

describe("set bonuses", () => {
  it("gambler unlocks reroll / 1→2 / six-double at 2/4/6", () => {
    expect(computeSetEffects(equipSet("gambler", 2)).statBonus.reroll).toBe(1);
    expect(computeSetEffects(equipSet("gambler", 4)).diceModifiers.length).toBeGreaterThan(0);
    expect(computeSetEffects(equipSet("gambler", 6)).sixDouble).toBe(true);
  });

  it("vampire lifesteal scales 10% → 30%", () => {
    expect(computeSetEffects(equipSet("vampire", 2)).lifestealAllPct).toBeCloseTo(0.1);
    expect(computeSetEffects(equipSet("vampire", 4)).lifestealHighFacePct).toBeCloseTo(0.15);
    expect(computeSetEffects(equipSet("vampire", 6)).lifestealAllPct).toBeCloseTo(0.3);
  });

  it("executioner grants extra hit + execute", () => {
    expect(computeSetEffects(equipSet("executioner", 4)).extraHit).toBe(true);
    expect(computeSetEffects(equipSet("executioner", 6)).executePct).toBeCloseTo(0.15);
  });

  it("oracle heals on reroll and rolls two dice at 6pc", () => {
    expect(computeSetEffects(equipSet("oracle", 2)).healOnReroll).toBeGreaterThan(0);
    expect(computeSetEffects(equipSet("oracle", 6)).rollTwoDice).toBe(true);
  });

  it("a single piece grants nothing", () => {
    expect(computeSetEffects(equipSet("gambler", 1)).activeTiers).toHaveLength(0);
  });

  it("every set has six equippable pieces", () => {
    for (const set of SETS) {
      for (const slot of EQUIP_SLOTS) {
        expect(getItemById(setPieceId(set.id, slot))?.setId).toBe(set.id);
      }
    }
  });
});

describe("quality", () => {
  it("ancient/mythic scale stats and prefix the name", () => {
    const base = getItemById("gen_weapon_50")!; // legendary tier
    const ancient = applyQuality(base, "ancient");
    expect(ancient.attack).toBe(Math.round(base.attack * 1.3));
    expect(ancient.name).toContain("古代の");
    expect(applyQuality(base, "mythic").attack).toBe(Math.round(base.attack * 1.6));
  });

  it("only legendaries can roll a quality", () => {
    const common = getItemById("gen_weapon_1")!;
    expect(rollQuality(common)).toBeUndefined();
  });

  it("rehydrates quality through getItemInstance", () => {
    const inst = getItemInstance("gen_weapon_50", undefined, 0, "ancient")!;
    expect(inst.quality).toBe("ancient");
  });
});

describe("神機マキナ", () => {
  it("is unique, unsellable, and turns every face into a normal attack", () => {
    const m = makeMakina();
    expect(m.id).toBe(MAKINA_ID);
    expect(m.unique).toBe(true);
    expect(m.noSell).toBe(true);
    expect(m.quality).toBe("unique");
    const faces = m.diceModifiers[0].faces;
    expect(faces).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("never re-rolls affix/modifier even if asked", () => {
    const inst = getItemInstance(MAKINA_ID, "sharp", 5, "ancient")!;
    expect(inst.quality).toBe("unique");
    expect(inst.modTier ?? 0).toBe(0);
  });
});
