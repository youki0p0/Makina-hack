"use client";

import { useGameStore } from "@/store/gameStore";

export default function PlayerStatus() {
  const player = useGameStore((s) => s.player);
  const stats = useGameStore((s) => s.stats());

  const hpPct = Math.max(0, Math.round((player.hp / stats.maxHp) * 100));

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold">勇者 Lv{player.level}</span>
        <span className="text-amber-300">💰 {player.gold}</span>
      </div>

      <div className="mt-2">
        <div className="flex justify-between text-xs text-gray-300">
          <span>HP</span>
          <span>
            {Math.max(0, player.hp)} / {stats.maxHp}
          </span>
        </div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      <div className="mt-2 flex justify-between text-xs text-gray-300">
        <span>⚔️ 攻 {stats.attack}</span>
        <span>🛡️ 防 {stats.defense}</span>
        <span>🎲 振直 {stats.rerolls}</span>
      </div>

      <div className="mt-1">
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>EXP</span>
          <span>
            {player.exp} / {player.expToNext}
          </span>
        </div>
        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-sky-400 transition-all"
            style={{ width: `${Math.min(100, Math.round((player.exp / player.expToNext) * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
