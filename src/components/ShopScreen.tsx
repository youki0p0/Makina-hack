"use client";

import Link from "next/link";
import PlayerStatus from "@/components/PlayerStatus";
import PixelGlyph from "@/components/PixelGlyph";
import { canEquip } from "@/data/classes";
import { fmt } from "@/lib/ui";
import { rarityLabel, rarityStyle, slotLabel } from "@/lib/ui";
import { getWorld, getWorldBackground } from "@/data/worlds";
import { useGameStore } from "@/store/gameStore";
import type { ClassId, Equipment, EquippedItems } from "@/types/game";

/** Colored stat delta vs the equipped item (緑=up / 赤=down / 灰=±0), matching
 *  the inventory detail modal's coloring. */
function StatDelta({ label, value }: { label: string; value: number }) {
  const color = value > 0 ? "text-emerald-300" : value < 0 ? "text-red-300" : "text-gray-500";
  return (
    <span className={color}>
      {label}
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

/** A buy-decision helper line for a shop equipment: 装備不可 or stat deltas vs equipped. */
function ShopCompare({
  item,
  equipped,
  classId,
}: {
  item: Equipment;
  equipped: EquippedItems;
  classId: ClassId;
}) {
  if (!canEquip(item, classId)) {
    return (
      <p className="mt-0.5 text-[10px] font-bold text-red-400">⚠ 装備不可（このジョブでは装備できない）</p>
    );
  }
  const cur = equipped[item.slot];
  if (!cur) {
    return <p className="mt-0.5 text-[10px] text-emerald-300">空きスロット（装備で全ステアップ）</p>;
  }
  return (
    <p className="mt-0.5 flex flex-wrap gap-x-2 text-[10px]">
      <span className="text-gray-400">装備中と比較:</span>
      <StatDelta label="攻" value={item.attack - cur.attack} />
      <StatDelta label="防" value={item.defense - cur.defense} />
      <StatDelta label="HP" value={item.maxHp - cur.maxHp} />
      {item.rerollModifier - cur.rerollModifier !== 0 && (
        <StatDelta label="リロール" value={item.rerollModifier - cur.rerollModifier} />
      )}
    </p>
  );
}

export default function ShopScreen() {
  const floor = useGameStore((s) => s.currentFloor);
  const stock = useGameStore((s) => s.shopStock);
  const gold = useGameStore((s) => s.player.gold);
  const equipped = useGameStore((s) => s.equipped);
  const classId = useGameStore((s) => s.classId);
  const buy = useGameStore((s) => s.buyShopItem);
  const buyAll = useGameStore((s) => s.buyAffordableShop);
  const leave = useGameStore((s) => s.leaveShop);
  const tapToBuy = useGameStore((s) => s.tapToBuy);
  const hasAffordable = stock.some((e) => !e.sold && gold >= e.price);
  const world = getWorld(floor);

  return (
    <div
      className="flex h-[100dvh] flex-col gap-2 overflow-hidden px-3"
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
        background: getWorldBackground(world),
        // No `background-attachment: fixed` — it's a mobile repaint killer (see BattleScreen).
      }}
    >
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← タイトル
        </Link>
        <span className="flex items-center gap-1 text-xs text-amber-300"><PixelGlyph kind="gold" size={14} /> {fmt(gold)}</span>
      </div>

      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2 text-center">
        <h1 className="flex items-center justify-center gap-1 font-bold text-amber-200"><PixelGlyph kind="shop" size={18} /> {floor}階 — ショップ</h1>
        <p className="text-[10px] text-gray-400">ゴールドで装備や消費アイテムを購入できる。</p>
      </div>

      {/* Scrollable stock list so the bottom actions stay pinned. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {stock.map((entry) => {
          const name =
            entry.kind === "equipment" ? entry.equipment!.name : entry.consumable!.name;
          const rarity =
            entry.kind === "equipment" ? entry.equipment!.rarity : entry.consumable!.rarity;
          const desc =
            entry.kind === "equipment"
              ? `${slotLabel[entry.equipment!.slot]}・${entry.equipment!.description}`
              : entry.consumable!.description;
          const affordable = gold >= entry.price && !entry.sold;
          const style = rarityStyle[rarity];
          // One-tap mode: the whole card is the buy button.
          if (tapToBuy) {
            return (
              <button
                key={entry.key}
                onClick={() => buy(entry.key)}
                disabled={!affordable}
                className={`w-full rounded-xl border p-2 text-left active:scale-[0.98] disabled:opacity-40 ${style.border} ${style.bg} ${entry.sold ? "opacity-40" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <p className={`font-bold ${style.text}`}>
                    {name} <span className="text-[10px] text-gray-400">{rarityLabel[rarity]}</span>
                  </p>
                  <span className="ml-2 flex shrink-0 items-center gap-0.5 text-xs font-bold text-emerald-300">
                    {entry.sold ? "売切" : <><PixelGlyph kind="gold" size={12} />{fmt(entry.price)}</>}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-gray-300">{desc}</p>
                {entry.kind === "equipment" && (
                  <ShopCompare item={entry.equipment!} equipped={equipped} classId={classId} />
                )}
              </button>
            );
          }
          return (
            <div
              key={entry.key}
              className={`rounded-xl border p-2 ${style.border} ${style.bg} ${entry.sold ? "opacity-40" : ""}`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-bold ${style.text}`}>
                  {name}{" "}
                  <span className="text-[10px] text-gray-400">{rarityLabel[rarity]}</span>
                </p>
                <button
                  onClick={() => buy(entry.key)}
                  disabled={!affordable}
                  className="ml-2 flex shrink-0 items-center gap-0.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white active:scale-95 disabled:opacity-40"
                >
                  {entry.sold ? "売切" : <><PixelGlyph kind="gold" size={12} />{fmt(entry.price)}</>}
                </button>
              </div>
              <p className="mt-0.5 text-[10px] text-gray-300">{desc}</p>
              {entry.kind === "equipment" && (
                <ShopCompare item={entry.equipment!} equipped={equipped} classId={classId} />
              )}
            </div>
          );
        })}
      </div>

      {/* Pinned action area, padded above the browser/system bar. */}
      <div
        className="flex flex-col gap-2"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <PlayerStatus />
        <div className="flex gap-2">
          <button
            onClick={buyAll}
            disabled={!hasAffordable}
            className="h-16 flex-1 rounded-2xl bg-amber-600 text-base font-extrabold text-white shadow-lg active:scale-95 disabled:opacity-40"
          >
            全部買う
          </button>
          <button
            onClick={leave}
            className="h-16 flex-[1.4] rounded-2xl bg-emerald-600 text-xl font-extrabold text-white shadow-lg active:scale-95"
          >
            先へ進む →
          </button>
        </div>
      </div>
    </div>
  );
}
