"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PixelGlyph from "@/components/PixelGlyph";
import {
  MATERIAL_INFO,
  maxDailyLevel,
  maxDailyUses,
  maxRushUses,
  RUSH_BOSS_COUNT,
  weekdayTheme,
  type MaterialId,
} from "@/data/dungeon";
import { useGameStore } from "@/store/gameStore";

// ===== 導入ストーリー（3行×2ビート、フェードイン/アウト・タップで進む）=====
const STORY_BEATS: string[][] = [
  ["ダンジョンの最奥で——", "曜日ごとに姿を変える", "“揺らぎの層” が見つかった。"],
  ["そこに眠る素材を集めれば", "装備の★をさらに研ぎ澄ませる。", "さあ、日替わりの試練へ。"],
];

function StoryOverlay({ onDone }: { onDone: () => void }) {
  const [beat, setBeat] = useState(0);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 30); // マウント後にフェードイン
    return () => clearTimeout(t);
  }, [beat]);
  const next = () => {
    setShow(false);
    setTimeout(() => {
      if (beat < STORY_BEATS.length - 1) setBeat((b) => b + 1);
      else onDone();
    }, 400);
  };
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black p-8"
      onClick={next}
    >
      <div className={`max-w-xs space-y-3 text-center transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}>
        {STORY_BEATS[beat].map((l, i) => (
          <p key={i} className="text-lg font-bold leading-relaxed text-fuchsia-100">{l}</p>
        ))}
        <p className="pt-8 text-[10px] text-gray-500">タップで進む（{beat + 1}/{STORY_BEATS.length}）</p>
      </div>
    </div>
  );
}

function HelpOverlay({ onDone }: { onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-6">
      <div className="w-full max-w-xs animate-pop space-y-3 rounded-2xl border border-fuchsia-500/30 bg-[#15131f] p-5">
        <h2 className="text-center text-lg font-extrabold text-fuchsia-200">遊び方</h2>
        <ul className="space-y-2 text-[12px] leading-relaxed text-gray-200">
          <li>🗓️ <b>日替わりダンジョン</b>：曜日で表情が変わる挑戦。レベルは「Lv×100階」相当の難度。クリアで素材（🔹欠片・🔶核）が貯まる。</li>
          <li>⚔️ <b>ボスラッシュ</b>：ボス{RUSH_BOSS_COUNT}連戦（回復なし）。<b>コイン＆EXPが4倍</b>。道中で<b>💠覇者の刻印</b>(0.5%)も狙える。</li>
          <li>⭐ 集めた素材は<b>鍛冶屋</b>で装備の<b>★アップ</b>に使える（既存の★を上限の先へ）。</li>
          <li>⏳ 挑戦回数は<b>毎日0時にリセット</b>。深く潜るほど回数が増える（1000/1500/2000/2500階で+1）。</li>
        </ul>
        <button
          onClick={onDone}
          className="h-12 w-full rounded-2xl bg-fuchsia-600 font-bold text-white active:scale-95"
        >
          はじめる
        </button>
      </div>
    </div>
  );
}

export default function DailyPage() {
  const router = useRouter();
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const highest = useGameStore((s) => s.progress.highestFloorReached);
  const dailyUses = useGameStore((s) => s.dailyUses);
  const rushUses = useGameStore((s) => s.rushUses);
  const materials = useGameStore((s) => s.materials);
  const dailyCleared = useGameStore((s) => s.dailyCleared);
  const seenStory = useGameStore((s) => s.seenDailyStory);
  const seenHelp = useGameStore((s) => s.seenDailyHelp);
  const markStory = useGameStore((s) => s.markDailyStorySeen);
  const markHelp = useGameStore((s) => s.markDailyHelpSeen);
  const enterDaily = useGameStore((s) => s.enterDailyDungeon);
  const enterRush = useGameStore((s) => s.enterBossRush);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <main className="flex min-h-dvh items-center justify-center text-gray-500">読み込み中…</main>;
  }

  const theme = weekdayTheme();
  const maxLevel = maxDailyLevel(highest);
  const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);

  const startDaily = (lv: number) => {
    if (dailyUses <= 0) return;
    enterDaily(lv);
    router.push("/battle");
  };
  const startRush = () => {
    if (rushUses <= 0) return;
    enterRush();
    router.push("/battle");
  };

  return (
    <main className="flex min-h-dvh flex-col gap-4 p-3">
      {/* 導入ストーリー → 遊び方（初回のみ） */}
      {!seenStory && <StoryOverlay onDone={markStory} />}
      {seenStory && !seenHelp && <HelpOverlay onDone={markHelp} />}

      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">← タイトル</Link>
        <button
          onClick={() => {
            // 遊び方を読み返せるように。
            useGameStore.setState({ seenDailyHelp: false });
          }}
          className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
        >
          ❔ 遊び方
        </button>
      </div>

      {/* 素材インベントリ */}
      <div className="flex items-center justify-around rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-2 text-sm">
        {(["shard", "core", "sigil"] as MaterialId[]).map((id) => (
          <span key={id} className="flex items-center gap-1 font-bold text-fuchsia-100" title={MATERIAL_INFO[id].name}>
            {MATERIAL_INFO[id].icon} {materials[id]}
          </span>
        ))}
        <Link href="/forge" className="rounded-lg bg-fuchsia-600/80 px-2 py-1 text-xs font-bold text-white active:scale-95">
          ⭐ ★アップ
        </Link>
      </div>

      {/* ボスラッシュ（常設） */}
      <section className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-amber-200">⚔️ ボスラッシュ</h2>
          <span className="text-xs text-amber-100">残り {rushUses}/{maxRushUses(highest)}</span>
        </div>
        <p className="text-[11px] text-gray-300">ボス{RUSH_BOSS_COUNT}連戦・回復なし。<b className="text-amber-200">コイン&EXP 4倍</b>、💠刻印も狙える。</p>
        <button
          onClick={startRush}
          disabled={rushUses <= 0}
          className="h-12 w-full rounded-2xl bg-amber-600 font-extrabold text-white active:scale-95 disabled:opacity-40"
        >
          {rushUses > 0 ? "挑戦する" : "本日の回数を使い切った"}
        </button>
      </section>

      {/* 日替わりダンジョン */}
      <section className="space-y-2 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-fuchsia-200">{theme.emoji} {theme.name}</h2>
          <span className="text-xs text-fuchsia-100">残り {dailyUses}/{maxDailyUses(highest)}</span>
        </div>
        <p className="text-[11px] text-gray-400">{theme.blurb}・Lv×100階 相当の難度。素材(🔹🔶)を集めよう。</p>
        <div className="grid grid-cols-3 gap-2">
          {levels.map((lv) => {
            const cleared = dailyCleared.includes(lv);
            return (
              <button
                key={lv}
                onClick={() => startDaily(lv)}
                disabled={dailyUses <= 0}
                className={`relative flex h-14 flex-col items-center justify-center rounded-xl border text-sm font-bold active:scale-95 disabled:opacity-40 ${
                  cleared
                    ? "border-emerald-500/40 bg-emerald-600/20 text-emerald-200"
                    : "border-white/15 bg-black/30 text-gray-100"
                }`}
              >
                <span>Lv{lv}</span>
                <span className="text-[9px] text-gray-400">{lv * 100}階級</span>
                {cleared && <span className="absolute right-1 top-0.5 text-[9px] text-emerald-300">✓済</span>}
              </button>
            );
          })}
        </div>
        {dailyUses <= 0 && <p className="text-center text-[11px] text-gray-500">本日の回数を使い切った（毎日0時に回復）</p>}
      </section>
    </main>
  );
}
