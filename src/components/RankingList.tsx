"use client";

import { getClass } from "@/data/classes";
import { getDifficulty, normalizeDifficulty } from "@/data/difficulty";
import { getTitle } from "@/data/titles";
import type { RankingEntry, RankingFilter } from "@/lib/ranking";

/** A "深層到達者ログ" style record list (not a flashy leaderboard). */
export default function RankingList({
  entries,
  filter,
}: {
  entries: RankingEntry[];
  filter: RankingFilter;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-emerald-500/20 bg-black/40 p-4 text-center font-mono text-xs text-emerald-300/70">
        記録なし — 該当する到達者ログが見つかりません
      </p>
    );
  }
  const endless = filter.kind === "endless";

  return (
    <ol className="space-y-1 font-mono">
      {entries.map((e, i) => {
        const cls = getClass(e.job as never);
        const diff = getDifficulty(normalizeDifficulty(e.difficulty));
        const title = getTitle(e.title);
        const floor = endless ? `Abyss +${e.endlessAbyssFloor}` : `${e.highestFloorReached}F`;
        return (
          <li
            key={`${e.playerName}-${e.updatedAt}-${i}`}
            className="flex items-center gap-2 rounded-md border border-emerald-500/15 bg-black/40 px-2 py-1.5 text-[11px] text-emerald-200"
          >
            <span className="w-5 shrink-0 text-right text-emerald-500/70">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="font-bold text-emerald-100">{e.playerName}</span>
              {title.id && <span className="ml-1 text-[9px] text-emerald-400/60">《{title.name}》</span>}
              <span className="block text-[9px] text-emerald-300/60">
                {cls.icon} {cls.name} ・ {diff.name}
                {e.equippedWeaponName ? ` ・ ${e.equippedWeaponName}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="font-bold text-amber-300">{floor}</span>
              {e.hasShinkiMakina && <span className="block text-[9px] text-fuchsia-300">🌈 神機マキナ</span>}
              {e.cleared1000 && !e.hasShinkiMakina && (
                <span className="block text-[9px] text-emerald-400">1000F制覇</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
