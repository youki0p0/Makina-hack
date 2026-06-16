"use client";

import { useState } from "react";
import ItemIcon from "@/components/ItemIcon";
import PixelGlyph from "@/components/PixelGlyph";
import { EQUIP_SLOTS } from "@/lib/battle";
import {
  FORGE_MAX,
  forgeCost,
  forgeSuccessChance,
  starInjectCost,
} from "@/data/forge";
import { getItemInstance } from "@/data/items";
import { modTierForFloor } from "@/data/modifiers";
import { itemKey, rarityStyle, slotLabel } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";
import type { Equipment, EquipmentSlot } from "@/types/game";

type Target = { loc: "inv" | EquipmentSlot; index: number };

export default function ForgePanel() {
  const equipped = useGameStore((s) => s.equipped);
  const inventory = useGameStore((s) => s.inventory);
  const points = useGameStore((s) => s.gachaPoints);
  const highest = useGameStore((s) => s.progress.highestFloorReached);
  const forgeItem = useGameStore((s) => s.forgeItem);
  const forgeCombine = useGameStore((s) => s.forgeCombine);
  const forgeInjectStar = useGameStore((s) => s.forgeInjectStar);
  const lastForge = useGameStore((s) => s.lastForge);
  const clearLastForge = useGameStore((s) => s.clearLastForge);
  const [sel, setSel] = useState<Target | null>(null);

  const item: Equipment | null =
    sel == null ? null : sel.loc === "inv" ? inventory[sel.index] ?? null : equipped[sel.loc] ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1 text-sm font-bold text-amber-200">
          <PixelGlyph kind="attack" size={16} /> 鍛冶屋
        </h2>
        <span className="flex items-center gap-1 text-xs text-purple-200">
          <PixelGlyph kind="material" size={13} /> {points}
        </span>
      </div>
      <p className="text-[10px] text-gray-500">
        素材で装備を強化。確率で +2/+3 の大成功。失敗してもレベルは下がらない（守護でさらに安全）。
      </p>

      {item ? (
        <ForgeDetail
          item={item}
          sel={sel as Target}
          points={points}
          highest={highest}
          onForge={(protect) => forgeItem((sel as Target).loc, (sel as Target).index, protect)}
          onCombine={() => forgeCombine((sel as Target).loc, (sel as Target).index)}
          onStar={() => forgeInjectStar((sel as Target).loc, (sel as Target).index)}
          onBack={() => setSel(null)}
        />
      ) : (
        <ForgeList equipped={equipped} inventory={inventory} onPick={setSel} />
      )}

      {lastForge && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-6"
          onClick={clearLastForge}
        >
          <div className="w-full max-w-xs animate-pop rounded-2xl border border-amber-500/50 bg-[#15131f] p-5 text-center">
            <p
              className={`text-2xl font-black ${
                lastForge.kind === "perfect"
                  ? "legendary-glow"
                  : lastForge.kind === "great"
                    ? "text-amber-300"
                    : lastForge.kind === "fail"
                      ? "text-gray-400"
                      : "text-emerald-300"
              }`}
            >
              {lastForge.kind === "perfect"
                ? "PERFECT!! +3"
                : lastForge.kind === "great"
                  ? "GREAT! +2"
                  : lastForge.kind === "fail"
                    ? "失敗… (据え置き)"
                    : "成功 +1"}
            </p>
            <p className="mt-1 text-sm text-gray-300">
              +{lastForge.from} → +{lastForge.to}
            </p>
            <button
              onClick={clearLastForge}
              className="mt-4 h-11 w-full rounded-xl bg-amber-600 font-bold text-white active:scale-95"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ item, label, onClick }: { item: Equipment; label: string; onClick: () => void }) {
  const s = rarityStyle[item.rarity];
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl border p-2 text-left active:scale-[0.98] ${s.border} ${s.bg}`}
    >
      <ItemIcon item={item} size={32} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-bold ${item.rarity === "legendary" ? "legendary-glow" : s.text}`}>
          {item.name}
        </p>
        <p className="text-[10px] text-gray-400">
          {label} ・ 攻{item.attack} 防{item.defense} HP{item.maxHp}
        </p>
      </div>
      <span className="text-xs text-gray-400">›</span>
    </button>
  );
}

function ForgeList({
  equipped,
  inventory,
  onPick,
}: {
  equipped: Record<string, Equipment | null>;
  inventory: Equipment[];
  onPick: (t: Target) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-gray-400">装備中</p>
      {EQUIP_SLOTS.map((slot) =>
        equipped[slot] ? (
          <Row
            key={slot}
            item={equipped[slot] as Equipment}
            label={`装備中 ${slotLabel[slot]}`}
            onClick={() => onPick({ loc: slot, index: 0 })}
          />
        ) : null,
      )}
      <p className="pt-2 text-[10px] font-bold text-gray-400">所持品 ({inventory.length})</p>
      {inventory.map((it, i) => (
        <Row key={`${itemKey(it)}-${i}`} item={it} label={slotLabel[it.slot]} onClick={() => onPick({ loc: "inv", index: i })} />
      ))}
    </div>
  );
}

function ForgeDetail({
  item,
  points,
  highest,
  onForge,
  onCombine,
  onStar,
  onBack,
}: {
  item: Equipment;
  sel: Target;
  points: number;
  highest: number;
  onForge: (protect: boolean) => void;
  onCombine: () => void;
  onStar: () => void;
  onBack: () => void;
}) {
  const level = item.forgeLevel ?? 0;
  const streak = item.forgeStreak ?? 0;
  const maxed = level >= FORGE_MAX || item.noModifier;
  const cost = forgeCost(level);
  const protectCost = Math.round(cost * 1.5);
  const succ = Math.round(forgeSuccessChance(level, streak, false) * 100);
  // Preview +1 stats by rebuilding from the base id.
  const next = getItemInstance(item.id, item.affixId, item.modTier, item.quality, level + 1) ?? item;
  const modTier = item.modTier ?? 0;
  const starCap = modTierForFloor(highest) + 2;
  const starCost = starInjectCost(modTier);

  const stat = (label: string, cur: number, nx: number) =>
    cur === 0 && nx === 0 ? null : (
      <p key={label}>
        {label} {cur}
        {!maxed && nx !== cur && <span className="text-emerald-300"> → {nx}</span>}
      </p>
    );

  return (
    <div className="space-y-2">
      <button onClick={onBack} className="text-xs text-gray-400 active:scale-95">
        ‹ 一覧へ
      </button>
      <div className={`rounded-xl border p-3 ${rarityStyle[item.rarity].border} ${rarityStyle[item.rarity].bg}`}>
        <div className="flex items-center gap-2">
          <ItemIcon item={item} size={48} />
          <div className="min-w-0">
            <p className={`truncate font-bold ${item.rarity === "legendary" ? "legendary-glow" : rarityStyle[item.rarity].text}`}>
              {item.name}
            </p>
            <p className="text-[10px] text-gray-400">
              鍛冶 +{level}/{FORGE_MAX} ・ ★{modTier}
              {streak > 0 && <span className="ml-1 text-amber-300">ピティ+{streak * 5}%</span>}
            </p>
          </div>
        </div>
        <div className="mt-2 space-y-0.5 text-xs text-gray-200">
          {stat("攻撃", item.attack, next.attack)}
          {stat("防御", item.defense, next.defense)}
          {stat("HP", item.maxHp, next.maxHp)}
        </div>
      </div>

      {item.noModifier ? (
        <p className="text-center text-xs text-gray-500">この装備は強化できません。</p>
      ) : (
        <>
          {!maxed && (
            <p className="text-[10px] text-gray-400">
              成功率 {succ}%（成功時 25%+で GREAT +2 / 8% で PERFECT +3）
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onForge(false)}
              disabled={maxed || points < cost}
              className="flex h-12 items-center justify-center gap-1 rounded-xl bg-amber-600 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
            >
              <PixelGlyph kind="material" size={13} /> 鍛える {cost}
            </button>
            <button
              onClick={() => onForge(true)}
              disabled={maxed || points < protectCost}
              className="flex h-12 items-center justify-center gap-1 rounded-xl bg-sky-700 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
            >
              <PixelGlyph kind="lock" size={13} /> 守護 {protectCost}
            </button>
            <button
              onClick={onCombine}
              disabled={maxed}
              className="flex h-12 items-center justify-center gap-1 rounded-xl bg-fuchsia-700 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
            >
              <PixelGlyph kind="bag" size={13} /> 合成(同部位を餌)
            </button>
            <button
              onClick={onStar}
              disabled={modTier >= starCap || points < starCost}
              className="flex h-12 items-center justify-center gap-1 rounded-xl bg-indigo-700 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
            >
              <PixelGlyph kind="star" size={13} /> ★注入 {starCost}
            </button>
          </div>
          <p className="text-[10px] text-gray-500">
            合成: 同じ部位の最も弱い未ロック装備を1つ消費して強化（同名は+2）。★注入の上限は最高到達階+2段。
          </p>
        </>
      )}
    </div>
  );
}
