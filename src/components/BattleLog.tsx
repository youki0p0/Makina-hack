"use client";

import GlyphText from "@/components/GlyphText";
import { useGameStore } from "@/store/gameStore";

const toneClass = {
  neutral: "text-gray-300",
  good: "text-emerald-300",
  bad: "text-red-300",
} as const;

export default function BattleLog() {
  const log = useGameStore((s) => s.battleLog);
  const recent = [...log].slice(-5).reverse();

  return (
    <div className="h-24 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2 text-xs">
      {recent.length === 0 ? (
        <p className="text-gray-500">戦闘ログ</p>
      ) : (
        recent.map((entry) => (
          <p key={entry.id} className={toneClass[entry.tone]}>
            <GlyphText text={entry.text} size={12} />
          </p>
        ))
      )}
    </div>
  );
}
