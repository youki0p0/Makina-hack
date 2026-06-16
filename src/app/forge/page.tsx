"use client";

import Link from "next/link";
import { useEffect } from "react";
import ForgePanel from "@/components/ForgePanel";
import PlayerStatus from "@/components/PlayerStatus";
import { useGameStore } from "@/store/gameStore";

export default function ForgePage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
          className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
        >
          🎒 装備
        </Link>
      </div>
      <PlayerStatus />
      <ForgePanel />
    </main>
  );
}
