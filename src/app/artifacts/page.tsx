"use client";

import Link from "next/link";
import { useEffect } from "react";
import ArtifactPanel from "@/components/ArtifactPanel";
import PlayerStatus from "@/components/PlayerStatus";
import { useGameStore } from "@/store/gameStore";

export default function ArtifactsPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const floor = useGameStore((s) => s.currentFloor);
  const gain = useGameStore((s) => s.rebirthGain());
  const rebirth = useGameStore((s) => s.rebirth);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-gray-500">
        読み込み中…
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← タイトル
        </Link>
        <Link
          href="/battle"
          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white active:scale-95"
        >
          戦闘へ →
        </Link>
      </div>

      <PlayerStatus />
      <ArtifactPanel />

      <div className="mt-auto rounded-xl border border-rose-500/40 bg-rose-500/10 p-3">
        <h2 className="text-sm font-bold text-rose-200">転生</h2>
        <p className="mt-1 text-[10px] text-gray-400">
          進行をリセットして最初からやり直す。レベル・装備・ゴールドは失うが、
          魂を獲得しアーティファクトは引き継がれる。周回するほど強くなる。
        </p>
        <button
          onClick={() => {
            if (
              confirm(
                `転生しますか？\n現在の進行(${floor}階)を失う代わりに 魂 +${gain} を獲得します。`,
              )
            ) {
              rebirth();
            }
          }}
          className="mt-2 h-12 w-full rounded-xl bg-rose-600 font-bold text-white active:scale-95"
        >
          転生する（魂 +{gain}）
        </button>
      </div>
    </main>
  );
}
