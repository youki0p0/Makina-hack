"use client";

import Link from "next/link";
import { useEffect } from "react";
import ArtifactPanel from "@/components/ArtifactPanel";
import PlayerStatus from "@/components/PlayerStatus";
import { milestoneSouls, nextMilestoneFloor } from "@/data/milestones";
import PixelGlyph from "@/components/PixelGlyph";
import { useGameStore } from "@/store/gameStore";

export default function ArtifactsPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const highest = useGameStore((s) => s.progress.highestFloorReached);
  const nextFloor = nextMilestoneFloor(highest);

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

      <div className="flex items-center gap-1 rounded-xl border border-violet-500/40 bg-violet-500/10 p-3 text-[11px] text-violet-200">
        <PixelGlyph kind="soul" size={14} /> 魂は<strong>最高到達階の更新</strong>でのみ獲得（死亡・周回では増えない）。
        次の獲得は <strong>{nextFloor}階</strong> 到達で +{milestoneSouls(nextFloor)}。
      </div>

      <ArtifactPanel />
    </main>
  );
}
