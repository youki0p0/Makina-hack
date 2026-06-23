"use client";

import { useEffect, useMemo, useState } from "react";
import { canEquip } from "@/data/classes";
import { SCRAP_VALUE } from "@/lib/loot";
import { itemKey, rarityLabel, rarityRank, rarityStyle, slotLabel } from "@/lib/ui";
import { QUALITIES } from "@/data/quality";
import { getSetDef } from "@/data/sets";
import ItemIcon from "@/components/ItemIcon";
import PixelGlyph from "@/components/PixelGlyph";
import RarityPips from "@/components/inventory/RarityPips";
import EquipmentDetailModal from "@/components/inventory/EquipmentDetailModal";
import { useGameStore } from "@/store/gameStore";
import type { Equipment, EquipmentSlot, Rarity } from "@/types/game";


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
  { id: "emblem", label: "紋章" },
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
  const [setKeyFilter, setSetKeyFilter] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("rarity");
  // 一括分解の確認はアプリ内ダイアログで行う（PWA/モバイルで window.confirm が
  // ネイティブダイアログを出せずフリーズ/表示崩れする不具合の回避）。
  const [bulkConfirm, setBulkConfirm] = useState<{ msg: string; run: () => void } | null>(null);

  const selectedItem = selected !== null ? inventory[selected] : null;

  // Distinct sets the player currently owns (for the set filter dropdown).
  const ownedSets = useMemo(
    () =>
      Array.from(
        new Set(inventory.map((it) => it.setId).filter((s): s is string => Boolean(s))),
      ).sort(),
    [inventory],
  );

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
  // Memoized so re-renders (opening the detail modal, auto-battle ticks, etc.)
  // don't re-sort the whole (up to 300-item) inventory every time.
  const rows = useMemo(
    () =>
      inventory
        .map((item, index) => ({ item, index }))
        .filter((r) => filter === "all" || r.item.slot === filter)
        .filter((r) => setKeyFilter === "all" || r.item.setId === setKeyFilter)
        .sort((a, b) => {
          const aFav = favorites.includes(itemKey(a.item));
          const bFav = favorites.includes(itemKey(b.item));
          if (aFav !== bFav) return aFav ? -1 : 1;
          if (sort === "name") return a.item.name.localeCompare(b.item.name, "ja");
          return sortValue(b.item, sort) - sortValue(a.item, sort);
        }),
    [inventory, filter, setKeyFilter, sort, favorites],
  );

  // 深層では所持品が上限(300件)まで増え、各行がcanvas生成のアイコンを持つため、全件を一度に
  // 描画/再描画すると重い。表示件数を絞り「もっと見る」で増やして主スレッド負荷を抑える。
  const PAGE = 50;
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => {
    setVisible(PAGE);
  }, [filter, setKeyFilter, sort]);

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

      {ownedSets.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">セット:</span>
          <select
            value={setKeyFilter}
            onChange={(e) => setSetKeyFilter(e.target.value)}
            className="h-8 flex-1 rounded-lg border border-white/15 bg-black/40 px-2 text-[11px] font-bold text-gray-100"
          >
            <option value="all">全セット</option>
            {ownedSets.map((key) => (
              <option key={key} value={key}>
                {getSetDef(key)?.name ?? key}セット
              </option>
            ))}
          </select>
        </div>
      )}

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
                (it) =>
                  !it.noSell &&
                  !favorites.includes(itemKey(it)) &&
                  rarityRank[it.rarity] <= rarityRank[b.rarity],
              );
              if (targets.length === 0) return;
              const gain = targets.reduce((sum, it) => sum + SCRAP_VALUE[it.rarity], 0);
              setBulkConfirm({
                msg: `${b.label} の ${targets.length}個 を分解して 素材+${gain}（★・ロックは保護）`,
                run: () => scrapBulk(b.rarity),
              });
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
            (it) => it.rarity === "legendary" && !it.noSell && !favorites.includes(itemKey(it)),
          );
          if (targets.length === 0) return;
          setBulkConfirm({
            msg: `未装備・未ロックのレジェンド ${targets.length}個 を一括分解して 素材+${targets.length * PER}`,
            run: () => sellLegendaries(),
          });
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
          {rows.slice(0, visible).map(({ item, index }) => {
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
          {rows.length > visible && (
            <button
              onClick={() => setVisible((v) => v + PAGE)}
              className="h-10 w-full rounded-xl bg-white/10 text-xs font-bold text-gray-200 active:scale-95"
            >
              もっと見る（残り {rows.length - visible} 件）
            </button>
          )}
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

      {/* 一括分解の確認（アプリ内ダイアログ＝モバイル/PWAで確実に動く） */}
      {bulkConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setBulkConfirm(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-white/15 bg-gray-900 p-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm leading-relaxed text-gray-100">{bulkConfirm.msg}</p>
            <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-gray-500">
              <PixelGlyph kind="lock" size={11} /> ロック・装備中は対象外
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setBulkConfirm(null)}
                className="h-10 rounded-xl bg-white/10 text-sm font-bold text-gray-200 active:scale-95"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  bulkConfirm.run();
                  setBulkConfirm(null);
                  setSelected(null);
                }}
                className="h-10 rounded-xl bg-amber-600 text-sm font-extrabold text-white active:scale-95"
              >
                分解する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

