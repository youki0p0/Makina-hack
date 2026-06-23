"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PixelGlyph from "@/components/PixelGlyph";
import { rewardText } from "@/data/quests";
import {
  FIREWORKS_SHOTS,
  SUMMER_MILESTONES,
  fireworksMedal,
  isJuly,
  runFireworks,
} from "@/lib/fireworks";
import { useGameStore } from "@/store/gameStore";

const PIPS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export default function SummerPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const best = useGameStore((s) => s.progress.summerBest);
  const claimed = useGameStore((s) => s.summerClaimed);
  const submit = useGameStore((s) => s.submitFireworksScore);
  const claim = useGameStore((s) => s.claimSummerReward);

  const [values, setValues] = useState<number[]>([]);
  const july = isJuly();

  const { shots, total } = useMemo(() => runFireworks(values), [values]);
  const finished = values.length >= FIREWORKS_SHOTS;
  const last = shots[shots.length - 1];

  // 終了したら自己ベストへ反映（最高スコアのみ更新）。
  useEffect(() => {
    if (finished) submit(total);
  }, [finished, total, submit]);

  const launch = () => {
    if (finished) return;
    setValues((v) => [...v, 1 + Math.floor(Math.random() * 6)]);
  };
  const reset = () => setValues([]);

  if (!hydrated) {
    return <main className="flex min-h-dvh items-center justify-center text-gray-500">読み込み中…</main>;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 bg-gradient-to-b from-[#0b1026] via-[#141a3a] to-[#2a1840] p-4 text-center text-gray-100">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xs text-sky-300 underline active:scale-95">← もどる</Link>
        <span className="text-[10px] text-amber-200">7月限定イベント</span>
      </div>

      <h1 className="text-2xl font-black tracking-tight">
        <PixelGlyph kind="firework" size={24} /> ダイス花火大会
      </h1>

      {!july ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-6">
          <div className="text-4xl"><PixelGlyph kind="firework" size={40} /></div>
          <p className="mt-3 text-sm text-gray-300">
            花火大会は<strong className="text-amber-200">7月限定</strong>のお祭りです。<br />
            また来年の夏にお会いしましょう！
          </p>
          <p className="mt-2 text-[11px] text-gray-500">自己ベスト: {best.toLocaleString()} 点 {fireworksMedal(best)}</p>
        </div>
      ) : (
        <>
          {/* 花火の打ち上げ場 */}
          <div className="relative flex h-44 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            {last ? (
              <div key={values.length} className="animate-pop flex flex-col items-center">
                <span className="text-5xl leading-none">{PIPS[last.value]}</span>
                <PixelGlyph kind="firework" size={56} />
                <span className="mt-1 text-sm font-bold text-amber-200">
                  +{last.points}
                  {last.combo > 1 && <span className="ml-1 text-fuchsia-300">コンボ×{(1 + last.combo * 0.5).toFixed(1)}</span>}
                  {last.value === 6 && <span className="ml-1 text-yellow-300">大輪！</span>}
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-400">「打ち上げる」で花火スタート！<br />出目4以上を続けてコンボ、6は大輪。</p>
            )}
          </div>

          {/* スコア & 進捗 */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
            <span>スコア <span className="font-black text-amber-200">{total.toLocaleString()}</span></span>
            <span className="text-[11px] text-gray-400">{Math.min(values.length, FIREWORKS_SHOTS)} / {FIREWORKS_SHOTS} 発</span>
          </div>

          {!finished ? (
            <button
              onClick={launch}
              className="h-16 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-amber-500 text-xl font-extrabold text-white shadow-lg active:scale-95"
            >
              <PixelGlyph kind="firework" size={20} /> 打ち上げる
            </button>
          ) : (
            <div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 p-3">
              <p className="text-sm font-bold text-amber-200">
                結果 {total.toLocaleString()} 点 <span className="text-2xl align-middle">{fireworksMedal(total)}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-gray-300">
                自己ベスト: {best.toLocaleString()} 点 {fireworksMedal(best)}
                {total >= best && total > 0 && <span className="ml-1 text-emerald-300 font-bold">自己ベスト更新！</span>}
              </p>
              <button
                onClick={reset}
                className="mt-2 h-11 w-full rounded-xl bg-white/10 font-bold active:scale-95"
              >
                🎆 もう一回
              </button>
            </div>
          )}

          {/* 報酬（控えめ・1回ずつ） */}
          <div className="mt-1 rounded-2xl border border-white/10 bg-black/30 p-3 text-left">
            <p className="text-[11px] font-bold text-gray-300">スコア達成のごほうび（各1回）</p>
            <ul className="mt-1.5 space-y-1.5">
              {SUMMER_MILESTONES.map((m) => {
                const done = claimed.includes(m.id);
                const ok = best >= m.minScore && !done;
                return (
                  <li key={m.id} className="flex items-center justify-between text-[12px]">
                    <span className="text-gray-300">
                      {m.minScore === 0 ? "初参加" : `${m.minScore.toLocaleString()}点`} … {rewardText(m.reward)}
                    </span>
                    <button
                      onClick={() => claim(m.id)}
                      disabled={!ok}
                      className={`rounded-lg px-2 py-1 text-[11px] font-bold active:scale-95 ${
                        done
                          ? "bg-white/5 text-gray-500"
                          : ok
                            ? "bg-emerald-600 text-white"
                            : "bg-white/5 text-gray-500"
                      }`}
                    >
                      {done ? "受取済" : ok ? "受け取る" : "未達成"}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[10px] text-gray-500">
              スコア8000で限定称号「<PixelGlyph kind="firework" size={11} />夏の花火師」を獲得（図鑑で装着）。
            </p>
          </div>

          <p className="text-[10px] text-gray-500">
            ※このイベントは本編（ダンジョン/装備）とは独立。ハイスコアを目指してね。
          </p>
        </>
      )}
    </main>
  );
}
