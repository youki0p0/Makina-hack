"use client";

import { useEffect } from "react";
import { sfx } from "@/lib/audio";
import { getWorld, FINAL_FLOOR } from "@/data/worlds";
import { useGameStore } from "@/store/gameStore";

/** Quiet, premium "World Complete" screen shown when a 100th-floor boss falls. */
export default function WorldClearOverlay({ floor }: { floor: number }) {
  const clearWorldClear = useGameStore((s) => s.clearWorldClear);
  const enterCurrentFloor = useGameStore((s) => s.enterCurrentFloor);
  const cleared = getWorld(floor);
  const next = getWorld(floor + 1);
  const isFinal = floor >= FINAL_FLOOR;

  useEffect(() => {
    sfx("win");
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-6">
      <div
        className="w-full max-w-sm rounded-2xl border p-6 text-center"
        style={{ borderColor: `${cleared.accent}66`, background: "#0c0a14" }}
      >
        <p className="text-xs tracking-[0.3em] text-gray-400">第{cleared.chapter}章</p>
        <h2 className="mt-1 text-2xl font-black" style={{ color: cleared.accent }}>
          {cleared.name}
        </h2>
        <p className="mt-1 text-sm tracking-[0.2em] text-gray-300">COMPLETE</p>

        <div className="my-5 h-px w-full" style={{ background: `${cleared.accent}40` }} />

        {isFinal ? (
          <div className="space-y-1">
            <p className="text-lg font-extrabold" style={{ color: next.accent }}>
              Endless Abyss
            </p>
            <p className="text-xs tracking-[0.2em] text-gray-400">UNLOCKED</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-gray-400">次のワールド</p>
            <p className="text-lg font-extrabold" style={{ color: next.accent }}>
              第{next.chapter}章 {next.name}
            </p>
            <p className="text-[10px] tracking-[0.2em] text-gray-500">UNLOCKED</p>
          </div>
        )}

        <button
          onClick={() => {
            clearWorldClear();
            enterCurrentFloor();
          }}
          className="mt-6 h-14 w-full rounded-2xl bg-white/10 text-lg font-bold text-white active:scale-95"
        >
          次へ →
        </button>
      </div>
    </div>
  );
}
