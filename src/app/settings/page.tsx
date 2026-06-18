"use client";

import Link from "next/link";
import { useEffect } from "react";
import SoundToggle from "@/components/SoundToggle";
import { DIFFICULTY_LIST } from "@/data/difficulty";
import { useGameStore } from "@/store/gameStore";

export default function SettingsPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const floor = useGameStore((s) => s.currentFloor);
  const player = useGameStore((s) => s.player);
  const newGame = useGameStore((s) => s.newGame);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const handedness = useGameStore((s) => s.handedness);
  const setHandedness = useGameStore((s) => s.setHandedness);
  const tapToBuy = useGameStore((s) => s.tapToBuy);
  const setTapToBuy = useGameStore((s) => s.setTapToBuy);

  const hasProgress = hydrated && (floor > 1 || player.level > 1);

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
        <SoundToggle />
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
        <h1 className="font-bold">⚙️ 設定</h1>
        <p className="mt-1 text-xs text-gray-300">遊びやすさを好みに合わせて。</p>
      </div>

      {!hydrated ? (
        <p className="text-center text-gray-500">読み込み中…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* 難易度 */}
          <section>
            <p className="mb-1 text-xs font-bold text-gray-300">難易度</p>
            <p className="mb-1 text-[10px] text-gray-500">高いほどドロップ数・高レア率UP</p>
            <div className="grid grid-cols-2 gap-1">
              {DIFFICULTY_LIST.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={`h-9 rounded-lg text-[11px] font-bold active:scale-95 ${
                    difficulty === d.id ? "bg-rose-600 text-white" : "bg-white/10 text-gray-300"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </section>

          {/* 利き手 */}
          <section>
            <p className="mb-1 text-xs font-bold text-gray-300">利き手（決定ボタンの位置）</p>
            <div className="flex gap-1">
              {([
                ["left", "👈 左手"],
                ["right", "右手 👉"],
              ] as const).map(([h, label]) => (
                <button
                  key={h}
                  onClick={() => setHandedness(h)}
                  className={`h-9 flex-1 rounded-lg text-[11px] font-bold active:scale-95 ${
                    handedness === h ? "bg-sky-600 text-white" : "bg-white/10 text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* ショップ購入 */}
          <section>
            <p className="mb-1 text-xs font-bold text-gray-300">ショップ購入</p>
            <div className="flex gap-1">
              {([
                [false, "ボタンで購入"],
                [true, "タップで購入"],
              ] as const).map(([v, label]) => (
                <button
                  key={String(v)}
                  onClick={() => setTapToBuy(v)}
                  className={`h-9 flex-1 rounded-lg text-[11px] font-bold active:scale-95 ${
                    tapToBuy === v ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* データ */}
          <section>
            <p className="mb-1 text-xs font-bold text-gray-300">データ</p>
            <Link
              href="/data"
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white/10 text-sm font-bold active:scale-95"
            >
              💾 データ引き継ぎ
            </Link>
            {hasProgress && (
              <button
                onClick={() => {
                  if (confirm("最初からやり直しますか？ 進行状況は消えます。")) {
                    newGame();
                  }
                }}
                className="mt-2 w-full text-xs text-gray-500 underline active:scale-95"
              >
                最初からやり直す
              </button>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
