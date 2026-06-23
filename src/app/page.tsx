"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SoundToggle from "@/components/SoundToggle";
import PixelGlyph from "@/components/PixelGlyph";
import EventBadge from "@/components/EventBadge";
import { casinoEvent } from "@/lib/casino";
import { FINAL_FLOOR } from "@/data/worlds";
import { isFeatureUnlocked, FEATURE_UNLOCKS } from "@/data/unlocks";
import { getDailyBonus } from "@/lib/daily";
import NextGoals from "@/components/NextGoals";
import DailyDiceCard from "@/components/DailyDiceCard";
import { useGameStore } from "@/store/gameStore";

export default function TitlePage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const floor = useGameStore((s) => s.currentFloor);
  const player = useGameStore((s) => s.player);
  const progress = useGameStore((s) => s.progress);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const seenHelp = useGameStore((s) => s.seenHelp);
  const markHelpSeen = useGameStore((s) => s.markHelpSeen);
  const checkpoint = useGameStore((s) => s.checkpoint);
  const setStartFloor = useGameStore((s) => s.setStartFloor);
  const startFloorPref = useGameStore((s) => s.startFloorPref);
  const daily = getDailyBonus();

  // Start-floor options: 1, and the floor just past each reached 50-mark
  // checkpoint (51, 101, …) so you resume after the cleared boss.
  const startFloors: number[] = [1];
  for (let f = 50; f <= checkpoint; f += 50) startFloors.push(f + 1);
  // Once the 1000F final boss has been reached, offer it directly so you can
  // retry the last battle from its save point.
  if (progress.highestFloorReached >= FINAL_FLOOR && !startFloors.includes(FINAL_FLOOR)) {
    startFloors.push(FINAL_FLOOR);
    startFloors.sort((a, b) => a - b);
  }

  // 1000階踏破で鍛冶屋の強化上限が解放される。プレイヤーが気づくよう、未確認なら鍛冶屋に「New」。
  const cleared1000 = hydrated && (progress.highestFloorReached >= FINAL_FLOOR || progress.endingSeen);
  const [forgeUnlockNew, setForgeUnlockNew] = useState(false);
  useEffect(() => {
    if (!cleared1000) {
      setForgeUnlockNew(false);
      return;
    }
    setForgeUnlockNew(window.localStorage.getItem("forgeUnlockSeen") !== "1");
  }, [cleared1000]);

  const hasProgress = hydrated && (floor > 1 || player.level > 1);
  const artifactsUnlocked = isFeatureUnlocked("artifacts", progress);
  const casinoUnlocked = isFeatureUnlocked("casino", progress);
  const forgeUnlocked = isFeatureUnlocked("forge", progress);
  const showFirstRun = hydrated && !seenHelp;

  /** A half-width locked placeholder (feature not yet unlocked). */
  const lockedCell = (label: string, hint: string) => (
    <div className="flex h-12 flex-1 flex-col items-center justify-center rounded-2xl bg-white/5 text-gray-500">
      <span className="flex items-center gap-1 text-sm font-bold">
        <PixelGlyph kind="lock" size={14} /> {label}
      </span>
      <span className="text-[9px]">{hint}</span>
    </div>
  );

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="absolute right-3 top-3">
        <SoundToggle />
      </div>
      <div>
        <h1 className="text-4xl font-black tracking-tight">
          🎲 Dice Ex
          <br />
          Machina
        </h1>
        <p className="mt-3 text-sm text-gray-400">
          装備で出目が書き換わるハクスラRPG
        </p>
      </div>

      {!hydrated ? (
        <p className="text-gray-500">読み込み中…</p>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Link
            href="/battle"
            className="h-16 rounded-2xl bg-emerald-600 pt-4 text-xl font-extrabold text-white shadow-lg active:scale-95"
          >
            {hasProgress ? `▶ つづきから (${floor}階)` : "▶ はじめる"}
          </Link>

          {startFloors.length > 1 && (
            <div>
              <p className="text-[10px] text-gray-500">出発階を選ぶ（詰まったら1階から鍛え直し）</p>
              <select
                value={startFloors.includes(startFloorPref) ? startFloorPref : 1}
                onChange={(e) => setStartFloor(Number(e.target.value))}
                className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-black/40 px-2 text-sm font-bold text-gray-100"
              >
                {startFloors.map((f) => (
                  <option key={f} value={f}>
                    {f === 1
                      ? "1階から（最初）"
                      : f === FINAL_FLOOR
                        ? "1000階 ラスボスから（再挑戦）"
                        : `${f}階から（セーブポイント）`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 📅 今日のやること（デイリー系をまとめたハブ。毎日0時リセット） */}
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-300">📅 今日のやること</span>
              <span className="text-[9px] text-gray-500">毎日0時にリセット</span>
            </div>
            {/* 日替わりダンジョン / ミッション */}
            <div className="flex gap-2">
              <Link
                href="/daily"
                className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-fuchsia-700/80 text-[13px] font-bold text-fuchsia-50 active:scale-95"
              >
                🗓️ 日替わり
              </Link>
              <Link
                href="/missions"
                className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-amber-700/80 text-[13px] font-bold text-amber-50 active:scale-95"
              >
                🎁 ミッション
              </Link>
            </div>
            {/* 今日のダイス（1日1回の運試し） */}
            <DailyDiceCard />
            {/* 本日のボーナス（今日の常時パッシブ） */}
            <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
              <PixelGlyph kind="star" size={14} /> 本日のボーナス: <span className="font-bold">{daily.label}</span>
            </div>
            {/* 次の目標（リテンション用） */}
            <NextGoals />
          </div>

          {/* 装備 / 鍛冶屋 */}
          <div className="flex gap-2">
            <Link
              href="/inventory"
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/10 font-bold active:scale-95"
            >
              <PixelGlyph kind="bag" size={18} /> 装備
            </Link>
            {forgeUnlocked ? (
              <Link
                href="/forge"
                className="relative flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-amber-700/80 font-bold active:scale-95"
              >
                <PixelGlyph kind="attack" size={18} /> 鍛冶屋
                {forgeUnlockNew && (
                  <span className="absolute -right-1 -top-1 animate-pulse rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow">
                    New
                  </span>
                )}
              </Link>
            ) : (
              lockedCell("鍛冶屋", FEATURE_UNLOCKS.forge.hint)
            )}
          </div>

          {/* 転職 / アーティファクト */}
          <div className="flex gap-2">
            <Link
              href="/class"
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/10 font-bold active:scale-95"
            >
              <PixelGlyph kind="attack" size={18} /> 転職
            </Link>
            {artifactsUnlocked ? (
              <Link
                href="/artifacts"
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-indigo-600/80 font-bold active:scale-95"
              >
                <PixelGlyph kind="soul" size={18} /> アーティファクト
              </Link>
            ) : (
              lockedCell("アーティファクト", FEATURE_UNLOCKS.artifacts.hint)
            )}
          </div>

          {/* カジノ */}
          {casinoUnlocked ? (
            <Link
              href="/casino"
              className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-fuchsia-600/80 font-bold active:scale-95"
            >
              <PixelGlyph kind="casino" size={18} /> カジノ
              {casinoEvent().active && <EventBadge />}
            </Link>
          ) : (
            <div className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/5 text-sm text-gray-500">
              <PixelGlyph kind="lock" size={16} /> カジノ（{FEATURE_UNLOCKS.casino.hint}）
            </div>
          )}

          {/* ランキング / 残響戦 */}
          <div className="flex gap-2">
            <Link
              href="/ranking"
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-emerald-700/70 font-bold active:scale-95"
            >
              <PixelGlyph kind="ranking" size={18} /> ランキング
            </Link>
            <Link
              href="/echo"
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-fuchsia-700/70 font-bold active:scale-95"
            >
              <PixelGlyph kind="ghost" size={18} /> 残響戦
            </Link>
          </div>

          {/* 実績 / 図鑑 */}
          <Link
            href="/collection"
            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 font-bold active:scale-95"
          >
            <PixelGlyph kind="codex" size={18} /> 実績 / 図鑑
          </Link>

          {/* 遊び方 / 設定 */}
          <div className="flex gap-2">
            <Link
              href="/help"
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/10 font-bold active:scale-95"
            >
              <PixelGlyph kind="help" size={18} /> 遊び方
            </Link>
            <Link
              href="/settings"
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/10 font-bold active:scale-95"
            >
              ⚙️ 設定
            </Link>
          </div>

          {/* リリースノート */}
          <Link
            href="/news"
            className="text-xs text-gray-500 underline active:scale-95"
          >
            📜 リリースノート（更新履歴）
          </Link>
        </div>
      )}

      <p className="text-[10px] text-gray-600">
        操作は「リロール」と「決定」だけ。
      </p>

      {showFirstRun && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-xs animate-pop rounded-2xl border border-white/15 bg-[#15131f] p-5 text-center">
            <div className="text-3xl">🎲</div>
            <h2 className="mt-1 text-lg font-extrabold">ようこそ！</h2>
            <p className="mt-2 text-xs text-gray-300">
              ターンごとに振られるダイスを、<br />
              「リロール」で振り直し「決定」で発動。<br />
              <span className="text-amber-300">装備や職業で出目の効果が変わる</span>のが肝です。
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/help"
                onClick={markHelpSeen}
                className="h-12 rounded-xl bg-emerald-600 pt-3 font-bold text-white active:scale-95"
              >
                遊び方を見る
              </Link>
              <button
                onClick={markHelpSeen}
                className="h-10 rounded-xl bg-white/10 font-bold active:scale-95"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
