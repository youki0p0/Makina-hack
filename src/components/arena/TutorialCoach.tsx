"use client";

import { useState } from "react";

interface Step {
  emoji: string;
  title: string;
  body: string;
  pos: "top" | "mid" | "bottom";
}

// 準備画面の上→下の流れに沿って案内する（実際の画面を見せながら1歩ずつ）。
const STEPS: Step[] = [
  {
    emoji: "🌍",
    title: "① まずフィールドを見る",
    body: "画面上のフィールドが今の舞台。フィールドによって技の効果そのものが変わる（火山→噴火、雨→蒸気…）。",
    pos: "top",
  },
  {
    emoji: "⚖️",
    title: "② 自軍★と敵★を見比べる",
    body: "「自軍★ vs 敵★」のバーで強さを比較。次に戦う敵の色（🔴火力/🟢耐久/🔵速さ）も見える。有利になるよう組もう。",
    pos: "top",
  },
  {
    emoji: "🃏",
    title: "③ パレットからカードを選ぶ",
    body: "下の帯を横スワイプしてカードを見る。🪙コスト予算内で取捨選択（強いほど高い）。長押しで詳細効果。タップで選択。",
    pos: "mid",
  },
  {
    emoji: "🐲",
    title: "④ 味方にタップで割り当て",
    body: "カードを選んだら、右の3体のどれかをタップして装備。1体に技を集めると『集中』（高火力・脆い）。★も上がる！",
    pos: "mid",
  },
  {
    emoji: "⚔️",
    title: "⑤ 準備完了で自動バトル",
    body: "「準備完了！！」を押すと干渉できない3v3オート戦闘。観戦して勝敗を見届けよう。",
    pos: "bottom",
  },
  {
    emoji: "✨",
    title: "⑥ 勝ったら祝福を選ぶ",
    body: "勝つたびに祝福を1つ獲得（ラン中ずっと累積＝後半インフレ）。負けるとライフが減り、0で敗退。目標勝利数で優勝！",
    pos: "bottom",
  },
];

const POS_CLASS: Record<Step["pos"], string> = {
  top: "top-24",
  mid: "top-1/2 -translate-y-1/2",
  bottom: "bottom-24",
};

export default function TutorialCoach({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setI((v) => Math.min(v + 1, STEPS.length - 1))}>
      <div
        className={`absolute left-1/2 w-[88%] max-w-xs -translate-x-1/2 ${POS_CLASS[step.pos]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl border border-emerald-400/50 bg-[#14121d] p-4 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{step.emoji}</span>
            <h3 className="text-sm font-extrabold text-emerald-200">{step.title}</h3>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-gray-200">{step.body}</p>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1">
              {STEPS.map((_, n) => (
                <span
                  key={n}
                  className={`h-1.5 w-1.5 rounded-full ${n === i ? "bg-emerald-400" : "bg-white/25"}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {!last ? (
                <>
                  <button
                    onClick={onClose}
                    className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold text-gray-300 active:scale-95"
                  >
                    スキップ
                  </button>
                  <button
                    onClick={() => setI((v) => v + 1)}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-extrabold text-white active:scale-95"
                  >
                    次へ ▶
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-extrabold text-white active:scale-95"
                >
                  はじめる！
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
