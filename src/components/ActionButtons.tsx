"use client";

import { sfx } from "@/lib/audio";
import { useGameStore } from "@/store/gameStore";

export default function ActionButtons() {
  const battleState = useGameStore((s) => s.battleState);
  const rerollsLeft = useGameStore((s) => s.rerollsLeft);
  const reroll = useGameStore((s) => s.reroll);
  const confirm = useGameStore((s) => s.confirm);
  const handedness = useGameStore((s) => s.handedness);

  const disabled = battleState !== "player";

  const rerollBtn = (
    <button
      key="reroll"
      onClick={() => {
        sfx("roll");
        reroll();
      }}
      disabled={disabled || rerollsLeft <= 0}
      className="flex h-20 flex-col items-center justify-center rounded-2xl bg-sky-600 text-lg font-bold text-white shadow-lg active:scale-95 disabled:opacity-40"
    >
      <span>🎲 リロール</span>
      <span className="text-xs font-normal opacity-90">残り {rerollsLeft}</span>
    </button>
  );

  const confirmBtn = (
    <button
      key="confirm"
      onClick={() => {
        sfx("select");
        confirm();
      }}
      disabled={disabled}
      className="flex h-20 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-extrabold text-white shadow-lg active:scale-95 disabled:opacity-40"
    >
      ⚔️ 決定
    </button>
  );

  // Right-handed: 決定 sits on the right (thumb side). Left-handed: mirror.
  const order = handedness === "left" ? [confirmBtn, rerollBtn] : [rerollBtn, confirmBtn];

  return <div className="grid grid-cols-2 gap-3">{order}</div>;
}
