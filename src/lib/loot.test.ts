import { describe, expect, it } from "vitest";
import { getAffixById } from "@/data/affixes";
import { getItemById, getItemInstance, ITEMS } from "@/data/items";
import { pullGachaItem, rollLoot, SCRAP_VALUE } from "@/lib/loot";
import { applyAffix } from "@/data/affixes";

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
