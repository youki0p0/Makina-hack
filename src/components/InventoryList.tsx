"use client";

import { useState } from "react";
import { SCRAP_VALUE } from "@/lib/loot";
import { itemKey, rarityLabel, rarityRank, rarityStyle, slotLabel } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";
import type { Equipment, EquipmentSlot, Rarity } from "@/types/game";

const BULK_OPTIONS: { rarity: Rarity; label: string }[] = [
  { rarity: "common", label: "≤コモン" },
  { rarity: "rare", label: "≤レア" },
  { rarity: "epic", label: "≤エピック" },
];

type Filter = "all" | EquipmentSlot;
type Sort = "rarity" | "attack" | "defense" | "name";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "weapon", label: "武器" },
  { id: "armor", label: "防具" },
  { id: "accessory", label: "装飾" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "rarity", label: "レア度" },
  { id: "attack", label: "攻撃" },
  { id: "defense", label: "防御" },
  { id: "name", label: "名前" },
];

function sortValue(item: Equipment, sort: Sort): number {
  switch (sort) {
    case "attack":
      return item.attack;
    case "defense":
      return item.defense;
    case "rarity":
      return rarityRank[item.rarity] * 1000 + item.attack + item.defense;
    default:
      return 0;
  }
}

export default function InventoryList() {
  const inventory = useGameStore((s) => s.inventory);
  const equipped = useGameStore((s) => s.equipped);
  const favorites = useGameStore((s) => s.favorites);
  const equipItem = useGameStore((s) => s.equipItem);
  const scrapItem = useGameStore((s) => s.scrapItem);
  const scrapBulk = useGameStore((s) => s.scrapBulk);
  const toggleFavorite = useGameStore((s) => s.toggleFavorite);
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("rarity");

  const selectedItem = selected !== null ? inventory[selected] : null;

  // Keep original indices for equip/scrap while filtering+sorting for display.
  const rows = inventory
    .map((item, index) => ({ item, index }))
    .filter((r) => filter === "all" || r.item.slot === filter)
    .sort((a, b) => {
      const aFav = favorites.includes(itemKey(a.item));
      const bFav = favorites.includes(itemKey(b.item));
      if (aFav !== bFav) return aFav ? -1 : 1;
      if (sort === "name") return a.item.name.localeCompare(b.item.name, "ja");
      return sortValue(b.item, sort) - sortValue(a.item, sort);
    });

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-gray-300">所持品 ({inventory.length})</h2>

      <div className="flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`h-8 flex-1 rounded-lg text-[11px] font-bold active:scale-95 ${
              filter === f.id ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500">並び:</span>
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={`h-7 flex-1 rounded-lg text-[11px] font-bold active:scale-95 ${
              sort === s.id ? "bg-sky-600 text-white" : "bg-white/10 text-gray-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500">一括分解:</span>
        {BULK_OPTIONS.map((b) => (
          <button
            key={b.rarity}
            onClick={() => {
              const targets = inventory.filter(
                (it) => !favorites.includes(itemKey(it)) && rarityRank[it.rarity] <= rarityRank[b.rarity],
              );
              if (targets.length === 0) return;
              const gain = targets.reduce((sum, it) => sum + SCRAP_VALUE[it.rarity], 0);
              if (confirm(`${b.label} の ${targets.length}個 を分解して素材+${gain}（★は保護）`)) {
                scrapBulk(b.rarity);
              }
            }}
            className="h-7 flex-1 rounded-lg bg-amber-700/70 text-[11px] font-bold text-white active:scale-95"
          >
            {b.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-500">★ を付けた装備は分解されません（ロック）。</p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-center text-sm text-gray-500">
          {inventory.length === 0 ? "まだ何も持っていない。敵を倒して装備を集めよう。" : "この分類のアイテムはない。"}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(({ item, index }) => {
            const fav = favorites.includes(itemKey(item));
            return (
              <div
                key={`${item.id}-${index}`}
                className={`flex items-center gap-2 rounded-xl border p-2 ${rarityStyle[item.rarity].border} ${rarityStyle[item.rarity].bg}`}
              >
                <button
                  onClick={() => toggleFavorite(itemKey(item))}
                  className={`shrink-0 text-lg active:scale-90 ${fav ? "text-amber-300" : "text-gray-600"}`}
                  aria-label="お気に入り"
                >
                  {fav ? "★" : "☆"}
                </button>
                <button onClick={() => setSelected(index)} className="flex min-w-0 flex-1 items-center justify-between text-left active:scale-[0.98]">
                  <div className="min-w-0">
                    <p className={`truncate font-bold ${rarityStyle[item.rarity].text}`}>{item.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {slotLabel[item.slot]} ・ {rarityLabel[item.rarity]}
                    </p>
                  </div>
                  <span className="ml-2 shrink-0 text-xs text-gray-400">詳細 ›</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedItem && selected !== null && (
        <EquipmentDetailModal
          item={selectedItem}
          equippedItem={equipped[selectedItem.slot]}
          favorite={favorites.includes(itemKey(selectedItem))}
          onToggleFavorite={() => toggleFavorite(itemKey(selectedItem))}
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

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-gray-500"> (±0)</span>;
  return (
    <span className={value > 0 ? "text-emerald-300" : "text-red-300"}>
      {" "}
      ({value > 0 ? "+" : ""}
      {value})
    </span>
  );
}

function EquipmentDetailModal({
  item,
  equippedItem,
  favorite,
  onToggleFavorite,
  onEquip,
  onScrap,
  onClose,
}: {
  item: Equipment;
  equippedItem: Equipment | null;
  favorite: boolean;
  onToggleFavorite: () => void;
  onEquip: () => void;
  onScrap: () => void;
  onClose: () => void;
}) {
  const style = rarityStyle[item.rarity];
  const isEquipped = equippedItem !== null && itemKey(equippedItem) === itemKey(item);
  const cmp = equippedItem;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className={`w-full max-w-sm animate-pop rounded-2xl border bg-[#15131f] p-4 ${style.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-extrabold ${style.text}`}>
            {item.name}
          </h3>
          <button onClick={onToggleFavorite} className={`text-xl ${favorite ? "text-amber-300" : "text-gray-600"}`}>
            {favorite ? "★" : "☆"}
          </button>
        </div>
        <span className="text-[10px] text-gray-400">
          {slotLabel[item.slot]} ・ {rarityLabel[item.rarity]}
        </span>

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

        {/* Comparison vs the currently equipped item in this slot. */}
        {!isEquipped && (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
            <p className="text-[10px] font-bold text-gray-300">
              装備中との比較（{slotLabel[item.slot]}）
            </p>
            {cmp ? (
              <>
                <p className="mt-0.5 text-[10px] text-gray-400">現在: {cmp.name}</p>
                <div className="mt-1 space-y-0.5 text-xs text-gray-200">
                  <p>攻撃 {item.attack}<Delta value={item.attack - cmp.attack} /></p>
                  <p>防御 {item.defense}<Delta value={item.defense - cmp.defense} /></p>
                  <p>HP {item.maxHp}<Delta value={item.maxHp - cmp.maxHp} /></p>
                  <p>リロール {item.rerollModifier}<Delta value={item.rerollModifier - cmp.rerollModifier} /></p>
                </div>
              </>
            ) : (
              <p className="mt-0.5 text-[10px] text-emerald-300">このスロットは未装備（装備で全効果が追加）</p>
            )}
          </div>
        )}
        {isEquipped && <p className="mt-3 text-center text-xs text-emerald-300">装備中</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-xl bg-white/10 font-bold active:scale-95">
            閉じる
          </button>
          <button
            onClick={onScrap}
            disabled={favorite}
            className="h-12 flex-1 rounded-xl bg-amber-700/80 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
          >
            {favorite ? "🔒 ロック中" : `分解 +${SCRAP_VALUE[item.rarity]}`}
          </button>
          <button onClick={onEquip} className="h-12 flex-1 rounded-xl bg-emerald-600 font-bold text-white active:scale-95">
            装備する
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label }: { label: string }) {
  return <span className="rounded-md bg-white/10 px-2 py-1 text-gray-200">{label}</span>;
}
