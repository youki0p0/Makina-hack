"use client";

import Link from "next/link";
import { useEffect } from "react";
import ActionButtons from "@/components/ActionButtons";
import BattleLog from "@/components/BattleLog";
import DiceDisplay from "@/components/DiceDisplay";
import EnemyCard from "@/components/EnemyCard";
import PlayerStatus from "@/components/PlayerStatus";
import { rarityStyle } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";

export default function BattleScreen() {
  const battleState = useGameStore((s) => s.battleState);
  const currentEnemy = useGameStore((s) => s.currentEnemy);
  const startBattle = useGameStore((s) => s.startBattle);

  // Auto-start a battle when entering with no enemy.
  useEffect(() => {
    if (battleState === "idle" || !currentEnemy) {
      if (battleState !== "won" && battleState !== "lost") {
        startBattle();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-dvh flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
        >
          ← タイトル
        </Link>
        <Link
          href="/inventory"
          className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
        >
          🎒 装備
        </Link>
      </div>

      <EnemyCard />

      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <DiceDisplay />
      </div>

      <BattleLog />

      <div className="mt-auto flex flex-col gap-3">
        <PlayerStatus />
        <ActionButtons />
      </div>

      {(battleState === "won" || battleState === "lost") && <ResultOverlay />}
    </div>
  );
}

function ResultOverlay() {
  const battleState = useGameStore((s) => s.battleState);
  const result = useGameStore((s) => s.lastResult);
  const floor = useGameStore((s) => s.currentFloor);
  const startBattle = useGameStore((s) => s.startBattle);

  if (!result) return null;
  const victory = battleState === "won";

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-sm animate-pop rounded-2xl border border-white/15 bg-[#15131f] p-5 text-center">
        <h2
          className={`text-2xl font-extrabold ${
            victory ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {victory ? "勝利！" : "敗北…"}
        </h2>

        {victory ? (
          <div className="mt-3 space-y-1 text-sm text-gray-200">
            <p>EXP +{result.expGained}</p>
            <p>ゴールド +{result.goldGained}</p>
            {result.leveledUp && <p className="text-yellow-300">レベルアップ！</p>}
            {result.drop ? (
              <div
                className={`mt-3 rounded-lg border p-2 ${rarityStyle[result.drop.rarity].border} ${rarityStyle[result.drop.rarity].bg}`}
              >
                <p className={`font-bold ${rarityStyle[result.drop.rarity].text}`}>
                  🎁 {result.drop.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-300">{result.drop.description}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">ドロップなし</p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-1 text-sm text-gray-200">
            <p>ゴールド -{result.goldLost}</p>
            <p className="text-xs text-gray-400">ダンジョンの最初に戻された。</p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={startBattle}
            className="h-14 rounded-2xl bg-emerald-600 text-lg font-bold text-white active:scale-95"
          >
            {victory ? `${floor}階へ進む →` : "再挑戦する"}
          </button>
          <Link
            href="/inventory"
            className="h-12 rounded-2xl bg-white/10 pt-3 text-center font-bold active:scale-95"
          >
            🎒 装備を整える
          </Link>
        </div>
      </div>
    </div>
  );
}
