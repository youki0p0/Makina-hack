import { describe, expect, it } from "vitest";
import { computeSetEffects, getSetDef, proceduralSetDef, SETS } from "@/data/sets";
import { applyQuality, rollQuality } from "@/data/quality";
import {
  genSetItem,
  getItemById,
  getItemInstance,
  makeMakina,
  MAKINA_ID,
  setPieceId,
} from "@/data/items";
import { EQUIP_SLOTS } from "@/lib/battle";
import type { EquipmentSlot, EquippedItems } from "@/types/game";

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

describe("proceduralSetDef never hangs (casino freeze regression)", () => {
  it("returns 3 distinct primitives for every index", () => {
    // The old pick-loop used a step that could be 0 or PRIMS.length/2 for some
    // n, cycling forever and freezing the casino exchange at deep floors.
    // Guard against any regression by exercising a wide range of indices.
    for (let n = 0; n < 600; n++) {
      const def = proceduralSetDef(n);
      expect(def.bonuses).toHaveLength(3);
      expect(def.bonuses.map((b) => b.pieces)).toEqual([2, 4, 6]);
      expect(def.procedural).toBe(true);
      // The three primitives backing the tiers must be distinct.
      const sigs = def.bonuses.map((b) => JSON.stringify({ ...b, pieces: 0, desc: "" }));
      expect(new Set(sigs).size).toBe(3);
    }
  });

  it("getSetDef resolves deep procedural keys quickly", () => {
    for (const n of [8, 21, 34, 47, 268]) {
      expect(getSetDef(`gset${n}`)).not.toBeNull();
    }
  });
});

/** Equip the first `n` slots with pieces of the given set. */
function equipSet(key: string, n: number): EquippedItems {
  const eq = emptyEquipped();
  const slots = EQUIP_SLOTS.slice(0, n) as EquipmentSlot[];
  for (const slot of slots) {
    eq[slot] = genSetItem(key, slot, 30);
  }
  return eq;
}

describe("signature resonance (固有共鳴)", () => {
  // One signature item per slot so we can dial the count exactly.
  const SIG_BY_SLOT: Record<EquipmentSlot, string> = {
    weapon: "vampiric_sword",
    helm: "sentinel_helm",
    armor: "heavy_armor",
    gloves: "duelist_gloves",
    boots: "windstep_boots",
    accessory: "gambler_ring",
  };

  function equipSignature(n: number): EquippedItems {
    const eq = emptyEquipped();
    const slots = EQUIP_SLOTS.slice(0, n) as EquipmentSlot[];
    for (const slot of slots) {
      const item = getItemById(SIG_BY_SLOT[slot])!;
      expect(item.signature).toBe(true);
      eq[slot] = item;
    }
    return eq;
  }

  it("grants no resonance with fewer than 2 signature pieces", () => {
    const eff = computeSetEffects(equipSignature(1));
    expect(eff.attackPct).toBe(0);
    expect(eff.maxHpPct).toBe(0);
  });

  it("2 pieces grant +12% attack / +12% maxHp", () => {
    const eff = computeSetEffects(equipSignature(2));
    expect(eff.attackPct).toBeCloseTo(0.12);
    expect(eff.maxHpPct).toBeCloseTo(0.12);
  });

  it("4 pieces grant +25% attack, extraHit, +1 reroll", () => {
    const eff = computeSetEffects(equipSignature(4));
    expect(eff.attackPct).toBeCloseTo(0.25);
    expect(eff.maxHpPct).toBeCloseTo(0.12);
    expect(eff.extraHit).toBe(true);
    expect(eff.statBonus.reroll).toBe(1);
  });

  it("6 pieces grant +45% attack / +30% maxHp and a no-miss capstone", () => {
    const eff = computeSetEffects(equipSignature(6));
    expect(eff.attackPct).toBeCloseTo(0.45);
    expect(eff.maxHpPct).toBeCloseTo(0.3);
    // Capstone pushes a no-miss dice modifier covering all faces.
    const noMiss = eff.diceModifiers.find((m) => m.faces.length === 6 && m.effect.isMiss === false);
    expect(noMiss).toBeDefined();
  });
});

describe("single-set focus capstone", () => {
  it("6 pieces of one named set grant +15% attack", () => {
    const eff = computeSetEffects(equipSet("vampire", 6));
    expect(eff.attackPct).toBeCloseTo(0.15);
  });
});

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

  it("has 20 named sets including the new variations", () => {
    const keys = SETS.map((s) => s.key);
    expect(SETS.length).toBe(20);
    expect(keys).toEqual(
      expect.arrayContaining([
        "guardian", "storm", "inferno", "revenant", "trickster",
        "fortress", "assassin", "crusader", "windrunner", "gravekeeper",
        "arcanist", "doomherald", "titanguard", "merchant", "warmonger",
        "legendgambler",
      ]),
    );
    // 伝説賭博はカジノ王の景品＝通常ドロップ/交換には出ない。
    expect(SETS.find((s) => s.key === "legendgambler")?.kingOnly).toBe(true);
    // all set keys are unique
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("guardian gives defense/HP at 2pc and lifesteal at 6pc", () => {
    const two = computeSetEffects(equipSet("guardian", 2));
    expect(two.statBonus.maxHp).toBeGreaterThan(0);
    expect(two.statBonus.defense).toBeGreaterThan(0);
    expect(computeSetEffects(equipSet("guardian", 6)).lifestealAllPct).toBeGreaterThan(0);
  });

  it("every named set has six equippable pieces, reconstructable by id", () => {
    // 紋章(emblem)はセット部位ではない（増幅専用スロット）ので除外。
    for (const set of SETS) {
      for (const slot of EQUIP_SLOTS.filter((s) => s !== "emblem")) {
        const id = setPieceId(set.key, slot, 30);
        expect(getItemById(id)?.setId).toBe(set.key);
      }
    }
  });

  it("generates infinite procedural sets that still grant effects", () => {
    const def0 = proceduralSetDef(0);
    const def99 = proceduralSetDef(99);
    expect(def0.key).toBe("gset0");
    expect(getSetDef("gset99")?.name).toBe(def99.name);
    // A deep procedural set still confers something at 6 pieces.
    const eff = computeSetEffects(equipSet("gset5", 6));
    expect(eff.activeTiers[0]?.pieces).toBe(6);
  });

  it("set pieces are tiered (scale with depth)", () => {
    const low = genSetItem("gambler", "weapon", 10);
    const high = genSetItem("gambler", "weapon", 200);
    expect(high.attack).toBeGreaterThan(low.attack);
  });
});

describe("set × job synergies", () => {
  it("rogue + gambler(4pc) unlocks the chained-bet synergy", () => {
    const eq = equipSet("gambler", 4);
    const withoutJob = computeSetEffects(eq);
    const withRogue = computeSetEffects(eq, "rogue");
    expect(withoutJob.synergies).toHaveLength(0);
    expect(withRogue.synergies.length).toBeGreaterThan(0);
    expect(withRogue.extraHit).toBe(true);
  });

  it("a non-matching job gets no synergy", () => {
    expect(computeSetEffects(equipSet("gambler", 4), "mage").synergies).toHaveLength(0);
  });

  it("mage + oracle(4pc) boosts the six-damage bonus", () => {
    const base = computeSetEffects(equipSet("oracle", 4)).sixDmgBonus;
    const synced = computeSetEffects(equipSet("oracle", 4), "mage").sixDmgBonus;
    expect(synced).toBeGreaterThan(base);
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
