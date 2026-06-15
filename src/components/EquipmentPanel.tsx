"use client";

import { EQUIP_SLOTS } from "@/lib/battle";
import { computeSetEffects, getSetDef } from "@/data/sets";
import { rarityStyle, slotLabel } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";
import type { EquippedItems } from "@/types/game";

export default function EquipmentPanel() {
  const equipped = useGameStore((s) => s.equipped);
  const unequip = useGameStore((s) => s.unequipItem);
  const setEff = computeSetEffects(equipped);

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-gray-300">装備中</h2>

      {setEff.activeTiers.length > 0 && (
        <div className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 p-2">
          <p className="text-[10px] font-bold text-fuchsia-200">発動中のセット効果</p>
          <ul className="mt-1 space-y-1 text-[10px] text-fuchsia-100">
            {setEff.activeTiers.map((t) => {
              const def = getSetDef(t.key);
              return (
                <li key={t.key}>
                  {t.icon} {t.name} ({t.pieces}部位)
                  <ul className="ml-3 text-gray-300">
                    {def?.bonuses
                      .filter((b) => t.pieces >= b.pieces)
                      .map((b) => (
                        <li key={b.pieces}>・{b.pieces}部位: {b.desc}</li>
                      ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}
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
