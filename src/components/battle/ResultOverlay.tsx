"use client";

import Link from "next/link";
import { useEffect } from "react";
import { sfx } from "@/lib/audio";
import { fmt, rarityStyle } from "@/lib/ui";
import ItemIcon from "@/components/ItemIcon";
import PixelGlyph from "@/components/PixelGlyph";
import { useGameStore } from "@/store/gameStore";

export default function ResultOverlay() {
  const battleState = useGameStore((s) => s.battleState);
  const result = useGameStore((s) => s.lastResult);
  const floor = useGameStore((s) => s.currentFloor);
  const enterCurrentFloor = useGameStore((s) => s.enterCurrentFloor);
  const startBattle = useGameStore((s) => s.startBattle);

  const won = battleState === "won";
  useEffect(() => {
    if (battleState === "won") sfx("win");
    else if (battleState === "lost") sfx("lose");
  }, [battleState]);

  if (!result) return null;
  const victory = won;

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
            <p>EXP +{fmt(result.expGained)}</p>
            <p>ゴールド +{fmt(result.goldGained)}</p>
            {result.streakBonusPct > 0 && (
              <p className="flex items-center justify-center gap-1 text-orange-300">
                <PixelGlyph kind="fire" size={14} /> {result.winStreak}連勝 ボーナス +{result.streakBonusPct}%
              </p>
            )}
            {result.leveledUp && <p className="text-yellow-300">レベルアップ！</p>}
            {result.drop ? (
              <div
                className={`mt-3 flex items-center gap-2 rounded-lg border p-2 text-left ${rarityStyle[result.drop.rarity].border} ${rarityStyle[result.drop.rarity].bg}`}
              >
                <ItemIcon item={result.drop} size={48} />
                <div className="min-w-0 flex-1">
                  <p className={`flex items-center gap-1 font-bold ${rarityStyle[result.drop.rarity].text}`}>
                    <PixelGlyph kind="drop" size={14} /> {result.drop.name}
                    {result.dropCount && result.dropCount > 1 && (
                      <span className="ml-1 text-[10px] text-gray-300">ほか +{result.dropCount - 1}個</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-300">{result.drop.description}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">ドロップなし</p>
            )}
            {result.consumable && (
              <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2">
                <p className="flex items-center gap-1 font-bold text-emerald-300">
                  <PixelGlyph kind="heal" size={14} /> {result.consumable.name} を使用
                </p>
                <p className="mt-0.5 text-xs text-gray-300">
                  {result.consumable.kind === "heal"
                    ? `HP +${result.healed}`
                    : result.consumable.description}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-1 text-sm text-gray-200">
            <p>ゴールド -{fmt(result.goldLost)}</p>
            <p className="text-xs text-gray-400">
              {floor > 1 ? `セーブポイント ${floor}階 から再開。` : "ダンジョンの最初に戻された。"}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={victory ? enterCurrentFloor : startBattle}
            className="h-14 rounded-2xl bg-emerald-600 text-lg font-bold text-white active:scale-95"
          >
            {victory ? `${floor}階へ進む →` : "再挑戦する"}
          </button>
          <Link
            href="/inventory"
            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-center font-bold active:scale-95"
          >
            <PixelGlyph kind="bag" size={18} /> 装備を整える
          </Link>
          {!victory && (
            <>
              <Link
                href="/class"
                className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-center font-bold active:scale-95"
              >
                <PixelGlyph kind="attack" size={18} /> 転職する
              </Link>
              <Link
                href="/"
                className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-center font-bold active:scale-95"
              >
                <PixelGlyph kind="home" size={18} /> ホームに戻る
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
