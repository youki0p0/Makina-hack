"use client";

import { useGameStore } from "@/store/gameStore";

export default function EnemyCard() {
  const enemy = useGameStore((s) => s.currentEnemy);
  const floor = useGameStore((s) => s.currentFloor);

  if (!enemy) return null;

  const hpPct = Math.max(0, Math.round((enemy.hp / enemy.maxHp) * 100));

  return (
    <div
      className={`rounded-xl border p-4 text-center ${
        enemy.isBoss ? "border-red-600/70 bg-red-950/30" : "border-white/10 bg-black/30"
      }`}
    >
      <div className="text-xs text-gray-400">{floor}階</div>
      <div className="my-1 text-5xl leading-none">{enemy.emoji}</div>
      <div className="font-bold">
        {enemy.isBoss && <span className="mr-1 text-red-400">BOSS</span>}
        {enemy.name}
      </div>

      <div className="mt-2">
        <div className="flex justify-between text-xs text-gray-300">
          <span>HP</span>
          <span>
            {Math.max(0, enemy.hp)} / {enemy.maxHp}
          </span>
        </div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-400 transition-all"
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400">
        ⚔️ {enemy.attack} ／ 🛡️ {enemy.defense}
      </div>
    </div>
  );
}
