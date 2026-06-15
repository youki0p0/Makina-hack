"use client";

import { getClass } from "@/data/classes";
import { getDifficulty, normalizeDifficulty } from "@/data/difficulty";
import PixelGlyph from "@/components/PixelGlyph";
import type { RankingEntry } from "@/lib/ranking";

/** A selectable "echo" (someone's record reconstructed as a foe). */
export default function EchoBattleCard({
  entry,
  onChallenge,
}: {
  entry: RankingEntry;
  onChallenge: () => void;
}) {
  const cls = getClass(entry.job as never);
  const diff = getDifficulty(normalizeDifficulty(entry.difficulty));
  const power = entry.hasShinkiMakina ? "★★★" : entry.cleared1000 ? "★★" : entry.highestFloorReached >= 500 ? "★" : "";

  return (
    <div className="flex items-center gap-2 rounded-xl border border-fuchsia-500/25 bg-black/40 p-2">
      <PixelGlyph kind="ghost" size={28} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-fuchsia-100">
          {entry.playerName}の残響 {power && <span className="text-amber-300">{power}</span>}
        </p>
        <p className="text-[10px] text-gray-400">
          {cls.icon} {cls.name} ・ {diff.name} ・ {entry.highestFloorReached}F到達
          {entry.hasShinkiMakina && <PixelGlyph kind="rainbow" size={12} className="ml-1" />}
        </p>
      </div>
      <button
        onClick={onChallenge}
        className="shrink-0 rounded-lg bg-fuchsia-700 px-3 py-2 text-xs font-bold text-white active:scale-95"
      >
        挑む
      </button>
    </div>
  );
}
