"use client";

import { useState } from "react";
import { GACHA_COST, PREMIUM_COST, TARGETED_COST } from "@/lib/loot";
import { rarityLabel, rarityStyle, slotLabel } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";
import type { EquipmentSlot } from "@/types/game";

const SLOTS: EquipmentSlot[] = ["weapon", "armor", "accessory"];

export default function GachaPanel() {
  const points = useGameStore((s) => s.gachaPoints);
  const pull = useGameStore((s) => s.pullGacha);
  const pullPremium = useGameStore((s) => s.pullPremium);
  const pullTargeted = useGameStore((s) => s.pullTargeted);
  const lastPull = useGameStore((s) => s.lastPull);
  const clearLastPull = useGameStore((s) => s.clearLastPull);
  const [slot, setSlot] = useState<EquipmentSlot>("weapon");

  return (
    <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-purple-200">🎰 装備ガチャ</h2>
        <span className="text-xs text-purple-200">素材 {points}</span>
      </div>
      <p className="mt-1 text-[10px] text-gray-400">
        不要装備を分解して素材に。限定装備も排出。
      </p>

      <button
        onClick={pull}
        disabled={points < GACHA_COST}
        className="mt-2 h-11 w-full rounded-xl bg-purple-600 font-bold text-white active:scale-95 disabled:opacity-40"
      >
        通常ガチャ（素材 {GACHA_COST}）
      </button>

      <button
        onClick={pullPremium}
        disabled={points < PREMIUM_COST}
        className="mt-2 h-11 w-full rounded-xl bg-amber-600 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
      >
        ✨ プレミアム（素材 {PREMIUM_COST}・高レア率UP）
      </button>

      <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
        <p className="text-[10px] text-gray-400">スロット指定ガチャ（高レア率UP）</p>
        <div className="mt-1 flex gap-1">
          {SLOTS.map((s) => (
            <button
              key={s}
              onClick={() => setSlot(s)}
              className={`h-8 flex-1 rounded-lg text-[11px] font-bold active:scale-95 ${
                slot === s ? "bg-amber-600 text-white" : "bg-white/10 text-gray-300"
              }`}
            >
              {slotLabel[s]}
            </button>
          ))}
        </div>
        <button
          onClick={() => pullTargeted(slot)}
          disabled={points < TARGETED_COST}
          className="mt-2 h-11 w-full rounded-xl bg-rose-600 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
        >
          🎯 {slotLabel[slot]}指定ガチャ（素材 {TARGETED_COST}）
        </button>
      </div>

      {lastPull && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-6"
          onClick={clearLastPull}
        >
          <div
            className={`w-full max-w-xs animate-pop rounded-2xl border bg-[#15131f] p-5 text-center ${rarityStyle[lastPull.rarity].border}`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-gray-400">ガチャ結果</p>
            <p className={`mt-1 text-xl font-extrabold ${rarityStyle[lastPull.rarity].text}`}>
              {lastPull.name}
            </p>
            <p className="text-[10px] text-gray-400">
              {slotLabel[lastPull.slot]} ・ {rarityLabel[lastPull.rarity]}
            </p>
            <p className="mt-2 text-xs text-gray-300">{lastPull.description}</p>
            <button
              onClick={clearLastPull}
              className="mt-4 h-11 w-full rounded-xl bg-emerald-600 font-bold text-white active:scale-95"
            >
              受け取る
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
