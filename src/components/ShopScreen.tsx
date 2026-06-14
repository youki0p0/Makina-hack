"use client";

import Link from "next/link";
import PlayerStatus from "@/components/PlayerStatus";
import { rarityLabel, rarityStyle, slotLabel } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";

export default function ShopScreen() {
  const floor = useGameStore((s) => s.currentFloor);
  const stock = useGameStore((s) => s.shopStock);
  const gold = useGameStore((s) => s.player.gold);
  const buy = useGameStore((s) => s.buyShopItem);
  const leave = useGameStore((s) => s.leaveShop);

  return (
    <div
      className="flex h-[100dvh] flex-col gap-2 overflow-hidden px-3"
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
      }}
    >
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← タイトル
        </Link>
        <span className="text-xs text-amber-300">💰 {gold}</span>
      </div>

      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2 text-center">
        <h1 className="font-bold text-amber-200">🏪 {floor}階 — ショップ</h1>
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
                  className="ml-2 shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white active:scale-95 disabled:opacity-40"
                >
                  {entry.sold ? "売切" : `💰${entry.price}`}
                </button>
              </div>
              <p className="mt-0.5 text-[10px] text-gray-300">{desc}</p>
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
        <button
          onClick={leave}
          className="h-16 rounded-2xl bg-emerald-600 text-xl font-extrabold text-white shadow-lg active:scale-95"
        >
          先へ進む →
        </button>
      </div>
    </div>
  );
}
