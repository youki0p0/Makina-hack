"use client";

import Link from "next/link";
import { useEffect } from "react";
import EquipmentPanel from "@/components/EquipmentPanel";
import GachaPanel from "@/components/GachaPanel";
import InventoryList from "@/components/InventoryList";
import PlayerStatus from "@/components/PlayerStatus";
import PixelGlyph from "@/components/PixelGlyph";
import { isFeatureUnlocked } from "@/data/unlocks";
import { useGameStore } from "@/store/gameStore";

export default function InventoryPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const progress = useGameStore((s) => s.progress);

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
        <Link
          href="/"
          className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
        >
          ← タイトル
        </Link>
        <div className="flex items-center gap-2">
          {/* 装備→鍛冶屋の導線（鍛冶屋→装備の一方通行を解消）。鍛冶屋が解放済みのときだけ表示。 */}
          {isFeatureUnlocked("forge", progress) && (
            <Link
              href="/forge"
              className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
            >
              <PixelGlyph kind="attack" size={14} /> 鍛冶屋
            </Link>
          )}
          <Link
            href="/battle"
            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white active:scale-95"
          >
            戦闘へ →
          </Link>
        </div>
      </div>

      <PlayerStatus />
      <EquipmentPanel />
      <GachaPanel />
      <InventoryList />
    </main>
  );
}
