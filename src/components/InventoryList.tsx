"use client";

import { useState } from "react";
import { SCRAP_VALUE } from "@/lib/loot";
import { rarityLabel, rarityStyle, slotLabel } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";
import type { Equipment } from "@/types/game";

export default function InventoryList() {
  const inventory = useGameStore((s) => s.inventory);
  const equipItem = useGameStore((s) => s.equipItem);
  const scrapItem = useGameStore((s) => s.scrapItem);
  const [selected, setSelected] = useState<number | null>(null);

  const selectedItem = selected !== null ? inventory[selected] : null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-gray-300">
        所持品 ({inventory.length})
      </h2>

      {inventory.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-center text-sm text-gray-500">
          まだ何も持っていない。
          <br />
          敵を倒して装備を集めよう。
        </p>
      ) : (
        <div className="space-y-2">
          {inventory.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              onClick={() => setSelected(index)}
              className={`flex w-full items-center justify-between rounded-xl border p-2 text-left active:scale-[0.98] ${rarityStyle[item.rarity].border} ${rarityStyle[item.rarity].bg}`}
            >
              <div className="min-w-0">
                <p className={`truncate font-bold ${rarityStyle[item.rarity].text}`}>
                  {item.name}
                </p>
                <p className="text-[10px] text-gray-400">
                  {slotLabel[item.slot]} ・ {rarityLabel[item.rarity]}
                </p>
              </div>
              <span className="ml-2 shrink-0 text-xs text-gray-400">詳細 ›</span>
            </button>
          ))}
        </div>
      )}

      {selectedItem && selected !== null && (
        <EquipmentDetailModal
          item={selectedItem}
          onEquip={() => {
            equipItem(selected);
            setSelected(null);
          }}
          onScrap={() => {
            scrapItem(selected);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function EquipmentDetailModal({
  item,
  onEquip,
  onScrap,
  onClose,
}: {
  item: Equipment;
  onEquip: () => void;
  onScrap: () => void;
  onClose: () => void;
}) {
  const style = rarityStyle[item.rarity];
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm animate-pop rounded-2xl border bg-[#15131f] p-4 ${style.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-extrabold ${style.text}`}>{item.name}</h3>
          <span className="text-[10px] text-gray-400">
            {slotLabel[item.slot]} ・ {rarityLabel[item.rarity]}
          </span>
        </div>

        <p className="mt-2 text-sm text-gray-200">{item.description}</p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {item.attack !== 0 && <Stat label={`攻撃 +${item.attack}`} />}
          {item.defense !== 0 && <Stat label={`防御 +${item.defense}`} />}
          {item.maxHp !== 0 && <Stat label={`HP +${item.maxHp}`} />}
          {item.rerollModifier !== 0 && (
            <Stat label={`リロール ${item.rerollModifier > 0 ? "+" : ""}${item.rerollModifier}`} />
          )}
        </div>

        {item.diceModifiers.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
            <p className="text-[10px] font-bold text-amber-300">✦ 出目の変化</p>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-100">
              {item.diceModifiers.map((mod, i) => (
                <li key={i}>・{mod.description}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="h-12 flex-1 rounded-xl bg-white/10 font-bold active:scale-95"
          >
            閉じる
          </button>
          <button
            onClick={onScrap}
            className="h-12 flex-1 rounded-xl bg-amber-700/80 text-sm font-bold text-white active:scale-95"
          >
            分解 +{SCRAP_VALUE[item.rarity]}
          </button>
          <button
            onClick={onEquip}
            className="h-12 flex-1 rounded-xl bg-emerald-600 font-bold text-white active:scale-95"
          >
            装備する
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-white/10 px-2 py-1 text-gray-200">{label}</span>
  );
}
