import type { Consumable } from "@/types/game";

/**
 * Master registry of consumables. These are NOT stored in inventory —
 * they are auto-used the instant they drop (see rollConsumable + finishVictory).
 */
export const CONSUMABLES: readonly Consumable[] = [
  {
    id: "herb",
    name: "薬草",
    rarity: "common",
    kind: "heal",
    value: 20,
    battles: 0,
    description: "HPを20回復。",
  },
  {
    id: "hi_potion",
    name: "上薬",
    rarity: "rare",
    kind: "heal",
    value: 45,
    battles: 0,
    description: "HPを45回復。",
  },
  {
    id: "power_brew",
    name: "力の薬",
    rarity: "rare",
    kind: "attack",
    value: 4,
    battles: 2,
    description: "2戦の間 攻撃+4。",
  },
  {
    id: "iron_brew",
    name: "守りの薬",
    rarity: "rare",
    kind: "defense",
    value: 4,
    battles: 2,
    description: "2戦の間 防御+4。",
  },
  {
    id: "clover",
    name: "幸運の四つ葉",
    rarity: "epic",
    kind: "reroll",
    value: 1,
    battles: 2,
    description: "2戦の間 リロール+1。",
  },
  {
    id: "loaded_die",
    name: "イカサマの賽",
    rarity: "epic",
    kind: "luck",
    value: 3,
    battles: 1,
    description: "次の1戦、出目が必ず3以上になる。",
  },
];

const MAP: Map<string, Consumable> = new Map(CONSUMABLES.map((c) => [c.id, c]));

export function getConsumableById(id: string): Consumable | null {
  const c = MAP.get(id);
  return c ? { ...c } : null;
}

/** Emoji per consumable kind for UI. */
export const consumableIcon: Record<string, string> = {
  heal: "🧪",
  attack: "⚔️",
  defense: "🛡️",
  reroll: "🎲",
  luck: "🍀",
};
