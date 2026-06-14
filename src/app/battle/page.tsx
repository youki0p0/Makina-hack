"use client";

import { useEffect } from "react";
import BattleScreen from "@/components/BattleScreen";
import { useGameStore } from "@/store/gameStore";

export default function BattlePage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);

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

  return <BattleScreen />;
}
