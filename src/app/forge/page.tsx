"use client";

import Link from "next/link";
import { useEffect } from "react";
import ForgePanel from "@/components/ForgePanel";
import PixelGlyph from "@/components/PixelGlyph";
import PlayerStatus from "@/components/PlayerStatus";
import { FINAL_FLOOR } from "@/data/worlds";
import { FORGE_MAX_CLEARED } from "@/data/forge";
import { useGameStore } from "@/store/gameStore";

export default function ForgePage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const progress = useGameStore((s) => s.progress);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 1000階踏破で強化上限が解放。鍛冶屋を開いたら「New」を消す（確認済みに）。
  const cleared1000 = hydrated && (progress.highestFloorReached >= FINAL_FLOOR || progress.endingSeen);
  useEffect(() => {
    if (cleared1000) window.localStorage.setItem("forgeUnlockSeen", "1");
  }, [cleared1000]);

  if (!hydrated) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-gray-500">読み込み中…</main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
        <Link
          href="/inventory"
          className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
        >
          <PixelGlyph kind="bag" size={14} /> 装備
        </Link>
      </div>
      <PlayerStatus />
      {cleared1000 && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-center text-xs font-bold text-amber-200">
          🎉 1000階踏破特典：武器強化の<span className="text-amber-100">上限が解除されました</span>（+{FORGE_MAX_CLEARED}まで・以降コストは微増）
        </div>
      )}
      <ForgePanel />
    </main>
  );
}
