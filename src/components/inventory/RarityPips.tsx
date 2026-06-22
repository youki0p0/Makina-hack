"use client";

import { rarityPipString, rarityStyle } from "@/lib/ui";
import type { Equipment } from "@/types/game";

/**
 * Rarity pips (✦) shown separately from the name. Legendary gets a rainbow glow
 * (#13). The ★ modifier tier already rides on the item name, so it isn't
 * duplicated here.
 */
export default function RarityPips({ item }: { item: Equipment }) {
  const legendary = item.rarity === "legendary";
  return (
    <span
      className={`align-middle ${legendary ? "legendary-glow" : rarityStyle[item.rarity].text}`}
    >
      {legendary ? "🌈" : ""}
      {rarityPipString(item.rarity)}
    </span>
  );
}
