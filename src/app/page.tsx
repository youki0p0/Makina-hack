"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

export default function TitlePage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const newGame = useGameStore((s) => s.newGame);
  const floor = useGameStore((s) => s.currentFloor);
  const player = useGameStore((s) => s.player);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const hasProgress = hydrated && (floor > 1 || player.level > 1);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <h1 className="text-4xl font-black tracking-tight">
          🎲 ダイス
          <br />
          ダンジョン
        </h1>
        <p className="mt-3 text-sm text-gray-400">
          装備で出目が書き換わる
          <br />
          コマンド式ハクスラRPG
        </p>
      </div>

      {!hydrated ? (
        <p className="text-gray-500">読み込み中…</p>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Link
            href="/battle"
            className="h-16 rounded-2xl bg-emerald-600 pt-4 text-xl font-extrabold text-white shadow-lg active:scale-95"
          >
            {hasProgress ? `▶ つづきから (${floor}階)` : "▶ はじめる"}
          </Link>

          <Link
            href="/inventory"
            className="h-12 rounded-2xl bg-white/10 pt-3 font-bold active:scale-95"
          >
            🎒 装備を見る
          </Link>

          <Link
            href="/class"
            className="h-12 rounded-2xl bg-white/10 pt-3 font-bold active:scale-95"
          >
            ⚔️ 転職
          </Link>

          <Link
            href="/artifacts"
            className="h-12 rounded-2xl bg-indigo-600/80 pt-3 font-bold active:scale-95"
          >
            🔮 アーティファクト / 転生
          </Link>

          {hasProgress && (
            <button
              onClick={() => {
                if (confirm("最初からやり直しますか？ 進行状況は消えます。")) {
                  newGame();
                }
              }}
              className="mt-2 text-xs text-gray-500 underline active:scale-95"
            >
              最初からやり直す
            </button>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-600">
        操作は「リロール」と「決定」だけ。
      </p>
    </main>
  );
}
