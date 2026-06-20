"use client";

import { diceKindIcon } from "@/data/diceFaces";
import { diceKindColor } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";

const PIPS: Record<number, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

export default function DiceDisplay() {
  const diceValue = useGameStore((s) => s.diceValue);
  const faces = useGameStore((s) => s.diceFaces);
  const face = useGameStore((s) => s.currentFace());
  const twoDice = useGameStore((s) => s.twoDice);

  return (
    <div className="flex flex-col items-center">
      {/* Big current roll */}
      <div
        key={diceValue}
        className="animate-roll select-none text-7xl leading-none drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]"
      >
        {PIPS[diceValue]}
      </div>

      {/* 「2個振り(高い方を採用)」が発動したターンの目印。両出目を見せ、採用した目を強調。 */}
      {twoDice && (
        <div
          key={`two-${twoDice[0]}-${twoDice[1]}-${diceValue}`}
          className="animate-pop mt-1 flex items-center gap-1 rounded-full border border-violet-400/50 bg-violet-500/15 px-2 py-0.5 text-[11px] font-bold text-violet-200"
        >
          <span>🎲×2</span>
          {twoDice.map((d, i) => (
            <span
              key={i}
              className={d === diceValue ? "text-base text-white" : "text-gray-400 line-through"}
            >
              {PIPS[d]}
            </span>
          ))}
          <span className="text-violet-300">高い方を採用！</span>
        </div>
      )}

      {/* Resolved effect for the current face */}
      <div
        key={`face-${diceValue}-${face.name}`}
        className="animate-pop mt-2 text-center"
      >
        <div className={`text-2xl font-extrabold ${diceKindColor[face.effect.kind]}`}>
          {diceKindIcon[face.effect.kind]} {face.name}
        </div>
        <div className="mt-0.5 text-xs text-gray-300">{face.description}</div>
        {face.modifiedBy.length > 0 && (
          <div className="mt-1 text-[10px] text-amber-300">
            ✦ {face.modifiedBy.join(" / ")} で変化
          </div>
        )}
      </div>

      {/* The whole dice table at a glance */}
      <div className="mt-3 grid w-full grid-cols-6 gap-1">
        {faces.map((f) => {
          const active = f.value === diceValue;
          const changed = f.modifiedBy.length > 0;
          return (
            <div
              key={f.value}
              className={`flex flex-col items-center rounded-md border px-0.5 py-1 text-center ${
                active
                  ? "border-white bg-white/15"
                  : changed
                    ? "border-amber-500/60 bg-amber-500/10"
                    : "border-white/10 bg-black/20"
              }`}
            >
              <span className="text-sm leading-none">{PIPS[f.value]}</span>
              <span className="mt-0.5 text-[8px] leading-tight text-gray-300">
                {f.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
