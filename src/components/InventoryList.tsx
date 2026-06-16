"use client";

import { useState } from "react";
import { canEquip, CLASSES } from "@/data/classes";
import { SCRAP_VALUE } from "@/lib/loot";
import { itemKey, rarityLabel, rarityPipString, rarityRank, rarityStyle, slotLabel } from "@/lib/ui";
import { QUALITIES } from "@/data/quality";
import { getSetDef } from "@/data/sets";
import ItemIcon from "@/components/ItemIcon";
import PixelGlyph from "@/components/PixelGlyph";
import GlyphText from "@/components/GlyphText";
import { useGameStore } from "@/store/gameStore";
import type { Equipment, EquipmentSlot, Rarity } from "@/types/game";

/**
 * Rarity pips (✦) shown separately from the name. Legendary gets a rainbow glow
 * (#13). The ★ modifier tier already rides on the item name, so it isn't
 * duplicated here.
 */
function RarityPips({ item }: { item: Equipment }) {
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

const TAG_LABEL: Record<string, string> = { light: "軽", heavy: "重", magic: "魔" };

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
  { id: "helm", label: "兜" },
  { id: "armor", label: "鎧" },
  { id: "gloves", label: "篭手" },
  { id: "boots", label: "靴" },
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
  const equipBest = useGameStore((s) => s.equipBest);
  const scrapItem = useGameStore((s) => s.scrapItem);
  const scrapBulk = useGameStore((s) => s.scrapBulk);
  const sellLegendaries = useGameStore((s) => s.sellLegendaries);
  const toggleFavorite = useGameStore((s) => s.toggleFavorite);
  const classId = useGameStore((s) => s.classId);
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("rarity");

  const selectedItem = selected !== null ? inventory[selected] : null;

  // "Stronger than what's equipped in this slot" → show a ▲ to speed decisions.
  const itemScore = (it: Equipment) =>
    it.attack * 2 + it.defense * 1.5 + it.maxHp * 0.4 + it.rerollModifier * 25 + (it.modTier ?? 0) * 5;
  const isUpgrade = (it: Equipment) => {
    if (!canEquip(it, classId)) return false;
    const cur = equipped[it.slot];
    if (cur && itemKey(cur) === itemKey(it)) return false;
    return !cur || itemScore(it) > itemScore(cur);
  };

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
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-300">所持品 ({inventory.length})</h2>
        <button
          onClick={() => equipBest()}
          className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1 text-[11px] font-bold text-white active:scale-95"
        >
          <PixelGlyph kind="attack" size={13} /> 最強装備
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`h-8 rounded-lg text-[11px] font-bold active:scale-95 ${
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
      <button
        onClick={() => {
          const PER = 24;
          const targets = inventory.filter(
            (it) =>
              it.rarity === "legendary" && !favorites.includes(itemKey(it)),
          );
          if (targets.length === 0) return;
          if (
            confirm(
              `未装備・未ロックのレジェンド ${targets.length}個 を一括分解して 素材+${targets.length * PER}`,
            )
          ) {
            sellLegendaries();
          }
        }}
        className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-amber-600/80 text-[11px] font-bold text-white active:scale-95"
      >
        <PixelGlyph kind="material" size={14} /> 未装備レジェンドを一括分解（素材・ロック除外）
      </button>
      <p className="flex items-center gap-1 text-[10px] text-gray-500">
        <PixelGlyph kind="lock" size={12} /> ロックした装備は分解の対象外です。
      </p>

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
                  className="shrink-0 active:scale-90"
                  aria-label="ロック"
                >
                  <PixelGlyph kind={fav ? "lock" : "unlock"} size={18} />
                </button>
                <button onClick={() => setSelected(index)} className="flex min-w-0 flex-1 items-center gap-2 text-left active:scale-[0.98]">
                  <ItemIcon item={item} size={32} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate font-bold ${
                        item.rarity === "legendary" ? "legendary-glow" : rarityStyle[item.rarity].text
                      }`}
                    >
                      <RarityPips item={item} />{" "}
                      {isUpgrade(item) && <span className="text-emerald-400" title="装備中より強い">▲</span>}
                      {item.name}
                      {item.equipTag && (
                        <span className="ml-1 text-[9px] text-gray-400">[{TAG_LABEL[item.equipTag]}]</span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {slotLabel[item.slot]} ・ {rarityLabel[item.rarity]}
                      {item.quality && (
                        <span className="ml-1 text-cyan-300">{QUALITIES[item.quality].label}</span>
                      )}
                      {item.setId && (
                        <span className="ml-1 text-fuchsia-300">[{getSetDef(item.setId)?.name}]</span>
                      )}
                      {!canEquip(item, classId) && <span className="ml-1 text-red-400">装備不可</span>}
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
          equippable={canEquip(selectedItem, classId)}
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
  equippable,
  onToggleFavorite,
  onEquip,
  onScrap,
  onClose,
}: {
  item: Equipment;
  equippedItem: Equipment | null;
  favorite: boolean;
  equippable: boolean;
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
        <div className="flex items-center gap-2">
          <ItemIcon item={item} size={64} />
          <h3 className={`min-w-0 flex-1 text-lg font-extrabold ${item.rarity === "legendary" ? "legendary-glow" : style.text}`}>
            {item.name}
          </h3>
          <button onClick={onToggleFavorite} className="active:scale-90" aria-label="ロック">
            <PixelGlyph kind={favorite ? "lock" : "unlock"} size={22} />
          </button>
        </div>
        <span className="text-[10px] text-gray-400">
          <RarityPips item={item} /> {slotLabel[item.slot]} ・ {rarityLabel[item.rarity]}
          {item.quality ? ` ・ ${QUALITIES[item.quality].label}` : ""}
          {item.modTier ? ` ・ ★${item.modTier}` : ""}
        </span>

        <p className="mt-1 text-[10px] text-gray-400">
          {(() => {
            const ok = CLASSES.filter((c) => canEquip(item, c.id));
            if (ok.length >= CLASSES.length) return "装備可能: 全職業";
            return `装備可能: ${ok.map((c) => c.name).join(" / ")}`;
          })()}
        </p>

        <p className="mt-2 text-sm text-gray-200">{item.description}</p>

        {item.setId && getSetDef(item.setId) && (
          <div className="mt-3 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 p-2">
            <p className="text-[10px] font-bold text-fuchsia-300">
              <GlyphText text={getSetDef(item.setId)!.icon} size={12} /> {getSetDef(item.setId)!.name}セット
            </p>
            <ul className="mt-1 space-y-0.5 text-[10px] text-fuchsia-100">
              {getSetDef(item.setId)!.bonuses.map((b) => (
                <li key={b.pieces}>・{b.pieces}部位: {b.desc}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {item.attack !== 0 && <Stat label={`攻撃 +${item.attack}`} />}
          {item.defense !== 0 && <Stat label={`防御 +${item.defense}`} />}
          {item.maxHp !== 0 && <Stat label={`HP +${item.maxHp}`} />}
          {item.rerollModifier !== 0 && (
            <Stat label={`リロール ${item.rerollModifier > 0 ? "+" : ""}${item.rerollModifier}`} />
          )}
          {item.poisonResist ? <Stat label={`毒耐性 ${Math.round(item.poisonResist * 100)}%`} /> : null}
          {item.stunResist ? <Stat label={`麻痺耐性 ${Math.round(item.stunResist * 100)}%`} /> : null}
          {item.volatile && <Stat label="不安定(振れ幅大)" />}
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
            className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-amber-700/80 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
          >
            {favorite ? (
              <><PixelGlyph kind="lock" size={14} /> ロック中</>
            ) : (
              <><PixelGlyph kind="material" size={14} /> 分解 +{SCRAP_VALUE[item.rarity]}</>
            )}
          </button>
          <button
            onClick={onEquip}
            disabled={!equippable}
            className="h-12 flex-1 rounded-xl bg-emerald-600 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
          >
            {equippable ? "装備する" : "職業不適合"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label }: { label: string }) {
  return <span className="rounded-md bg-white/10 px-2 py-1 text-gray-200">{label}</span>;
}
