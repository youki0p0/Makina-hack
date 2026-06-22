"use client";

import { useGameStore } from "@/store/gameStore";

/** A single Endless-Abyss story line (NO route), shown once. */
export default function EndlessMessageOverlay({ text }: { text: string }) {
  const clearEndlessMessage = useGameStore((s) => s.clearEndlessMessage);
  const enterCurrentFloor = useGameStore((s) => s.enterCurrentFloor);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/95 p-6 text-center">
      <div className="w-full max-w-sm">
        <div className="space-y-1 whitespace-pre-line text-sm leading-relaxed text-gray-100">
          {text}
        </div>
        <button
          onClick={() => {
            clearEndlessMessage();
            enterCurrentFloor();
          }}
          className="mt-8 h-12 w-full rounded-2xl border border-white/20 text-sm font-bold text-gray-200 active:scale-95"
        >
          ……続ける
        </button>
      </div>
    </div>
  );
}
