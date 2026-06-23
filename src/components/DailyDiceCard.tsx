"use client";

import { useState } from "react";
import { DICE_FACES, faceById, spinDailyDice, type DiceFaceId } from "@/lib/dailyDice";
import { rewardText } from "@/data/quests";
import { todayKey } from "@/lib/maintenance";
import { useGameStore } from "@/store/gameStore";

const PIPS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"]; // index = 出目

/**
 * タイトルの「🎲 今日のダイス」カード。1日1回、3つの面から1つ選んで振り、
 * 出目に応じた小さな報酬がもらえる。振り終えた日は結果を表示し、翌0時に再挑戦。
 */
export default function DailyDiceCard() {
  const diceKey = useGameStore((s) => s.dailyDiceKey);
  const diceFace = useGameStore((s) => s.dailyDiceFace);
  const diceValue = useGameStore((s) => s.dailyDiceValue);
  const roll = useGameStore((s) => s.rollDailyDice);

  // 振った瞬間だけ簡易演出（出目がくるっと回る）を出すためのローカル状態。
  const [spinning, setSpinning] = useState(false);

  const done = diceKey === todayKey();

  const onPick = (id: DiceFaceId) => {
    if (done || spinning) return;
    setSpinning(true);
    // 演出を一拍見せてから確定（結果は決定論なので見た目だけの遅延）。
    window.setTimeout(() => {
      roll(id);
      setSpinning(false);
    }, 600);
  };

  // 結果表示（本日振り済み）。
  if (done && !spinning) {
    const face = faceById(diceFace);
    const reward = face ? spinDailyDice(face.id, todayKey()).reward : null;
    const jackpot = diceValue === 6; // 出目6＝各面の大当たり

    if (jackpot) {
      // 大当たり：金枠＋✨でちょっと派手にお祝い。
      return (
        <div className="animate-pop rounded-xl border border-amber-400/60 bg-amber-500/15 p-2.5 text-[12px] shadow-[0_0_18px_rgba(251,191,36,0.25)]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-100">🎲 今日のダイス</span>
            <span className="text-[10px] text-amber-300/80">また明日 0時に！</span>
          </div>
          <div className="mt-1 text-center text-[13px] font-black tracking-wide text-amber-200">
            ✨ 大当たり！ ✨
          </div>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="text-3xl leading-none drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
              {PIPS[diceValue] ?? "🎲"}
            </span>
            <div className="text-left">
              <div className="text-[11px] text-amber-100/80">
                {face?.emoji} {face?.label} → 出目 <span className="font-bold">{diceValue}</span>
              </div>
              {reward && (
                <div className="text-[13px] font-black text-amber-100">{rewardText(reward)} 獲得！</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-2.5 text-[12px]">
        <div className="flex items-center justify-between">
          <span className="font-bold text-violet-100">🎲 今日のダイス</span>
          <span className="text-[10px] text-gray-400">また明日 0時に！</span>
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <span className="text-3xl leading-none">{PIPS[diceValue] ?? "🎲"}</span>
          <div className="text-left">
            <div className="text-[11px] text-gray-300">
              {face?.emoji} {face?.label} → 出目 <span className="font-bold">{diceValue}</span>
            </div>
            {reward && (
              <div className="font-bold text-amber-200">{rewardText(reward)} 獲得！</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 未プレイ：面を選んで振る。
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-2.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-bold text-violet-100">🎲 今日のダイス</span>
        <span className="text-[10px] text-gray-400">1日1回・運試し</span>
      </div>
      <p className="mt-0.5 text-[10px] text-gray-400">
        {spinning ? "コロコロ…！" : "どの目で振る？ 選ぶと報酬の寄りが変わるよ"}
      </p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {DICE_FACES.map((f) => (
          <button
            key={f.id}
            onClick={() => onPick(f.id)}
            disabled={spinning}
            className="flex flex-col items-center rounded-lg border border-white/10 bg-black/30 py-1.5 active:scale-95 disabled:opacity-50"
          >
            <span className={`text-xl leading-none ${spinning ? "animate-spin" : ""}`}>{f.emoji}</span>
            <span className="mt-0.5 text-[11px] font-bold text-gray-100">{f.label}</span>
            <span className="text-[9px] text-gray-400">{f.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
