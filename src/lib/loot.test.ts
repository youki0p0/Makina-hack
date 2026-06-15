import { describe, expect, it } from "vitest";
import { getAffixById } from "@/data/affixes";
import {
  genItem,
  getItemById,
  getItemInstance,
  ITEMS,
  parseGenId,
  SLOT_LIST,
} from "@/data/items";
import { pullGachaItem, pullPremiumItem, pullTargetedItem, rollLoot, SCRAP_VALUE } from "@/lib/loot";
import { generateShopStock } from "@/lib/shop";
import { applyAffix, rollAffixedCopy } from "@/data/affixes";

describe("item registry (curated) + procedural gear", () => {
  it("keeps a curated registry of signature & set items", () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(40);
    // Curated gear is finite — it never grows with slots or floors.
    expect(ITEMS.some((i) => i.setId)).toBe(true);
  });

  it("generates plain gear procedurally for every slot, reconstructable by id", () => {
    for (const slot of SLOT_LIST) {
      const item = genItem(slot, 25);
      expect(item.slot).toBe(slot);
      const parsed = parseGenId(item.id)!;
      expect(parsed.slot).toBe(slot);
      expect(getItemById(item.id)?.attack).toBe(item.attack);
    }
  });

  it("supports deep tiers without storing them", () => {
    // No registry entry exists, yet a floor-1000-era item reconstructs fine.
    const deep = genItem("weapon", 60);
    expect(getItemById(deep.id)?.id).toBe(deep.id);
  });
});

describe("shop", () => {
  it("never stocks casino-exclusive gear", () => {
    for (let floor = 1; floor <= 60; floor += 7) {
      for (let i = 0; i < 20; i++) {
        for (const entry of generateShopStock(floor)) {
          if (entry.kind === "equipment") {
            expect(entry.equipment!.casinoOnly).not.toBe(true);
          }
        }
      }
    }
  });

  it("only stocks gear unlocked by the floor", () => {
    for (const entry of generateShopStock(3)) {
      if (entry.kind === "equipment") {
        expect(entry.equipment!.minFloor ?? 1).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe("pullGachaItem", () => {
  it("never returns a casino-exclusive item", () => {
    for (let i = 0; i < 300; i++) {
      const item = pullGachaItem();
      expect(item.casinoOnly).not.toBe(true);
    }
  });
});

describe("rollLoot", () => {
  it("only drops droppable (non-gacha, non-casino) items", () => {
    const enemy = { isBoss: true, dropRate: 1 } as never;
    for (let i = 0; i < 200; i++) {
      const drop = rollLoot(enemy, 10);
      expect(drop).not.toBeNull();
      expect(drop!.gachaOnly).not.toBe(true);
      expect(drop!.casinoOnly).not.toBe(true);
      expect(drop!.minFloor ?? 1).toBeLessThanOrEqual(10);
    }
  });
});

describe("premium & targeted gacha", () => {
  it("premium pull never returns a casino-exclusive item", () => {
    for (let i = 0; i < 200; i++) {
      expect(pullPremiumItem().casinoOnly).not.toBe(true);
    }
  });

  it("targeted pull always returns the chosen slot", () => {
    for (const slot of ["weapon", "armor", "accessory"] as const) {
      for (let i = 0; i < 60; i++) {
        expect(pullTargetedItem(slot).slot).toBe(slot);
      }
    }
  });
});

describe("SCRAP_VALUE", () => {
  it("rewards rarer items more", () => {
    expect(SCRAP_VALUE.legendary).toBeGreaterThan(SCRAP_VALUE.common);
    expect(SCRAP_VALUE.epic).toBeGreaterThan(SCRAP_VALUE.rare);
  });
});

describe("affixes + item instances", () => {
  it("applyAffix bakes bonuses and records affixId", () => {
    const base = getItemById("iron_sword")!;
    const affix = getAffixById("sharp")!;
    const out = applyAffix(base, affix);
    expect(out.attack).toBe(base.attack + affix.attack);
    expect(out.affixId).toBe("sharp");
    expect(out.name).toContain(base.name);
  });

  it("getItemInstance reconstructs an affixed item from ids", () => {
    const inst = getItemInstance("iron_sword", "sharp")!;
    const base = getItemById("iron_sword")!;
    expect(inst.attack).toBe(base.attack + getAffixById("sharp")!.attack);
  });

  it("every item has a unique id", () => {
    const ids = new Set(ITEMS.map((i) => i.id));
    expect(ids.size).toBe(ITEMS.length);
  });
});

describe("resistance gear", () => {
  it("exists with resistance and a volatile flag", () => {
    const charm = getItemById("antidote_charm")!;
    expect(charm.poisonResist).toBeGreaterThan(0);
    expect(charm.volatile).toBe(true);
    const ring = getItemById("ward_ring")!;
    expect(ring.stunResist).toBeGreaterThan(0);
  });

  it("volatile items can roll greater (wide-swing) affixes", () => {
    const base = getItemById("antidote_charm")!;
    let sawGreater = false;
    for (let i = 0; i < 400; i++) {
      const r = rollAffixedCopy({ ...base });
      if (r.affixId?.startsWith("greater")) sawGreater = true;
    }
    expect(sawGreater).toBe(true);
  });
});
