"use client";

import { BLESSING_MAP } from "@/lib/arena/blessings";

/** 勝利後に提示される祝福3択。1つ選ぶとラン内で永続・累積する。 */
export default function BlessingChoice({
  offered,
  owned,
  onChoose,
}: {
  offered: string[];
  owned: string[];
  onChoose: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="text-4xl">✨</div>
      <h2 className="text-xl font-black text-amber-300">祝福を1つ選ぶ</h2>
      <p className="text-[11px] text-gray-400">ラン内でずっと効果が続く（累積）。後半ほど効いてくる。</p>

      <div className="flex w-full max-w-xs flex-col gap-2">
        {offered.map((id) => {
          const b = BLESSING_MAP[id];
          if (!b) return null;
          return (
            <button
              key={id}
              onClick={() => onChoose(id)}
              className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-left active:scale-95"
            >
              <span className="text-2xl">{b.emoji}</span>
              <span>
                <span className="block text-sm font-bold text-amber-100">{b.name}</span>
                <span className="block text-[11px] text-gray-300">{b.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {owned.length > 0 && (
        <div className="mt-1 flex max-w-xs flex-wrap justify-center gap-1">
          <span className="text-[10px] text-gray-500">取得済み:</span>
          {owned.map((id, i) => (
            <span key={i} className="text-[12px]" title={BLESSING_MAP[id]?.name}>
              {BLESSING_MAP[id]?.emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
