"use client";

import { EQUIP_SLOTS } from "@/lib/battle";
import { rarityStyle, slotLabel } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";
import type { EquippedItems } from "@/types/game";

export default function EquipmentPanel() {
  const equipped = useGameStore((s) => s.equipped);
  const unequip = useGameStore((s) => s.unequipItem);

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-gray-300">装備中</h2>
      <div className="space-y-2">
        {EQUIP_SLOTS.map((slot) => {
          const item = equipped[slot as keyof EquippedItems];
          return (
            <div
              key={slot}
              className={`flex items-center justify-between rounded-xl border p-2 ${
                item ? rarityStyle[item.rarity].border : "border-white/10"
              } ${item ? rarityStyle[item.rarity].bg : "bg-black/20"}`}
            >
              <div className="min-w-0">
                <span className="text-[10px] text-gray-400">{slotLabel[slot]}</span>
                {item ? (
                  <p className={`truncate font-bold ${rarityStyle[item.rarity].text}`}>
                    {item.name}
                  </p>
                ) : (
                  <p className="text-gray-500">なし</p>
                )}
              </div>
              {item && (
                <button
                  onClick={() => unequip(slot as keyof EquippedItems)}
                  className="ml-2 shrink-0 rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
                >
                  外す
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
