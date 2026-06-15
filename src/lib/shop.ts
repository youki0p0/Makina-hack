import { rollAffixedCopy } from "@/data/affixes";
import { CONSUMABLES } from "@/data/consumables";
import { ITEMS, rollGenDrop } from "@/data/items";
import type { Consumable, Equipment, Rarity } from "@/types/game";

export interface ShopEntry {
  /** Unique within a stock, for React keys and buy targeting. */
  key: string;
  kind: "equipment" | "consumable";
  equipment?: Equipment;
  consumable?: Consumable;
  price: number;
  sold: boolean;
}

const EQUIP_PRICE: Record<Rarity, number> = {
  common: 15,
  rare: 40,
  epic: 90,
  cursed: 70,
  legendary: 180,
};

const CONS_PRICE: Record<Rarity, number> = {
  common: 10,
  rare: 25,
  epic: 55,
  cursed: 40,
  legendary: 80,
};

/** Shops appear on every 4th floor, except boss floors (every 10th). */
export function isShopFloor(floor: number): boolean {
  return floor % 4 === 0 && floor % 10 !== 0;
}

// Shop never sells gacha- or casino-exclusive gear (curated, floor-gated).
const SHOP_CURATED = ITEMS.filter((i) => !i.gachaOnly && !i.casinoOnly && !i.unique);

function pickRandom<T>(arr: readonly T[], count: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

/** One shop equipment: ~50% a curated (effect/set) item, else procedural gear. */
function pickShopEquipment(floor: number): Equipment {
  const curated = SHOP_CURATED.filter((i) => (i.minFloor ?? 1) <= floor);
  if (curated.length > 0 && Math.random() < 0.5) {
    return rollAffixedCopy({ ...pickRandom(curated, 1)[0] });
  }
  return rollAffixedCopy(rollGenDrop(floor));
}

/** Build a fresh shop stock for the given floor: 3 equipment + 2 consumables. */
export function generateShopStock(floor: number): ShopEntry[] {
  const equipment = Array.from({ length: 3 }, (_, i) => {
    const rolled = pickShopEquipment(floor);
    return {
      key: `eq-${i}-${rolled.id}`,
      kind: "equipment" as const,
      equipment: rolled,
      // Affixed items cost a bit more.
      price: EQUIP_PRICE[rolled.rarity] + floor * 3 + (rolled.affixId ? 20 : 0),
      sold: false,
    };
  });
  const consumables = pickRandom(CONSUMABLES, 2).map((c, i) => ({
    key: `co-${i}-${c.id}`,
    kind: "consumable" as const,
    consumable: { ...c },
    price: CONS_PRICE[c.rarity] + floor,
    sold: false,
  }));
  return [...equipment, ...consumables];
}
