"use client";

import Link from "next/link";
import { useEffect } from "react";
import { isFeatureUnlocked, FEATURE_UNLOCKS } from "@/data/unlocks";
import { useGameStore } from "@/store/gameStore";

export default function TitlePage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const newGame = useGameStore((s) => s.newGame);
  const floor = useGameStore((s) => s.currentFloor);
  const player = useGameStore((s) => s.player);
  const progress = useGameStore((s) => s.progress);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const seenHelp = useGameStore((s) => s.seenHelp);
  const markHelpSeen = useGameStore((s) => s.markHelpSeen);

  const hasProgress = hydrated && (floor > 1 || player.level > 1);
  const artifactsUnlocked = isFeatureUnlocked("artifacts", progress);
  const casinoUnlocked = isFeatureUnlocked("casino", progress);
  const showFirstRun = hydrated && !seenHelp;

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

          {artifactsUnlocked ? (
            <Link
              href="/artifacts"
              className="h-12 rounded-2xl bg-indigo-600/80 pt-3 font-bold active:scale-95"
            >
              🔮 アーティファクト / 転生
            </Link>
          ) : (
            <div className="h-12 rounded-2xl bg-white/5 pt-3 text-center text-sm text-gray-500">
              🔒 アーティファクト（{FEATURE_UNLOCKS.artifacts.hint}）
            </div>
          )}

          {casinoUnlocked ? (
            <Link
              href="/casino"
              className="h-12 rounded-2xl bg-fuchsia-600/80 pt-3 font-bold active:scale-95"
            >
              🎰 カジノ
            </Link>
          ) : (
            <div className="h-12 rounded-2xl bg-white/5 pt-3 text-center text-sm text-gray-500">
              🔒 カジノ（{FEATURE_UNLOCKS.casino.hint}）
            </div>
          )}

          <Link
            href="/collection"
            className="h-12 rounded-2xl bg-white/10 pt-3 font-bold active:scale-95"
          >
            📚 実績 / 図鑑
          </Link>

          <Link
            href="/help"
            className="h-12 rounded-2xl bg-white/10 pt-3 font-bold active:scale-95"
          >
            ❓ 遊び方
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

      {showFirstRun && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-xs animate-pop rounded-2xl border border-white/15 bg-[#15131f] p-5 text-center">
            <div className="text-3xl">🎲</div>
            <h2 className="mt-1 text-lg font-extrabold">ようこそ！</h2>
            <p className="mt-2 text-xs text-gray-300">
              ターンごとに振られるダイスを、<br />
              「リロール」で振り直し「決定」で発動。<br />
              <span className="text-amber-300">装備や職業で出目の効果が変わる</span>のが肝です。
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/help"
                onClick={markHelpSeen}
                className="h-12 rounded-xl bg-emerald-600 pt-3 font-bold text-white active:scale-95"
              >
                遊び方を見る
              </Link>
              <button
                onClick={markHelpSeen}
                className="h-10 rounded-xl bg-white/10 font-bold active:scale-95"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
