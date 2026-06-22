"use client";

import Link from "next/link";
import PixelGlyph from "@/components/PixelGlyph";
import { milestoneSouls, nextMilestoneFloor } from "@/data/milestones";
import { TITLES } from "@/data/titles";
import { useGameStore } from "@/store/gameStore";

const TOTAL_TITLES = TITLES.filter((t) => t.tier).length;

/**
 * タイトル画面の「次の目標」カード。プレイヤーが次に何を目指すかを可視化して、
 * セッション継続の動機を作る（リテンション）。深度の次の節目（魂報酬つき）と
 * 称号コレクションの進捗を表示する。
 */
export default function NextGoals() {
  const highest = useGameStore((s) => s.progress.highestFloorReached);
  const claimed = useGameStore((s) => s.progress.claimedTitles.length);

  const next = nextMilestoneFloor(highest);
  const reward = milestoneSouls(next);
  const prev = next - 100;
  const pct = Math.max(0, Math.min(100, Math.round(((highest - prev) / 100) * 100)));
  const remaining = Math.max(0, next - highest);

  return (
    <div className="space-y-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-left">
      <p className="flex items-center gap-1 text-[11px] font-bold text-sky-200">
        <PixelGlyph kind="ranking" size={14} /> 次の目標
      </p>

      {/* 深度の次の節目（魂報酬） */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-gray-300">
          <span>
            次の節目: <strong className="text-sky-200">{next}階</strong>
            <span className="text-gray-500">（あと{remaining}階）</span>
          </span>
          <span className="flex items-center gap-0.5 text-indigo-300">
            <PixelGlyph kind="soul" size={12} /> +{reward}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/40">
          <div className="h-full rounded-full bg-sky-400" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* 称号コレクション進捗 */}
      <Link
        href="/collection"
        className="flex items-center justify-between text-[11px] text-gray-300 active:scale-95"
      >
        <span className="flex items-center gap-1">
          <PixelGlyph kind="crown" size={12} /> 称号コレクション
        </span>
        <span className="text-amber-200">
          {claimed} / {TOTAL_TITLES} →
        </span>
      </Link>
    </div>
  );
}
