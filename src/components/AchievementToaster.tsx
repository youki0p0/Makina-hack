"use client";

import { useEffect } from "react";
import { getAchievement } from "@/data/achievements";
import { sfx } from "@/lib/audio";
import { useGameStore } from "@/store/gameStore";

/**
 * Global unlock toast: when an achievement is newly earned it lands in the store
 * queue; we surface it top-center, play a jingle, and auto-dismiss after a few
 * seconds (tap to dismiss early). Mounted once in the root layout so it shows on
 * every screen. Multiple unlocks queue up and play one after another.
 */
export default function AchievementToaster() {
  const currentId = useGameStore((s) => s.achievementQueue[0] ?? null);
  const dismiss = useGameStore((s) => s.dismissAchievement);

  useEffect(() => {
    if (!currentId) return;
    sfx("coin");
    const t = setTimeout(() => dismiss(), 3600);
    return () => clearTimeout(t);
  }, [currentId, dismiss]);

  if (!currentId) return null;
  const a = getAchievement(currentId);
  if (!a) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <button
        onClick={() => dismiss()}
        className="animate-pop pointer-events-auto mt-2 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-amber-400/60 bg-[#1a1726]/95 p-3 text-left shadow-lg active:scale-95"
      >
        <span className="text-3xl">{a.icon}</span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.2em] text-amber-300">★ 実績解除！</p>
          <p className="truncate font-extrabold text-amber-100">{a.name}</p>
          <p className="truncate text-[10px] text-gray-300">{a.desc}</p>
        </div>
      </button>
    </div>
  );
}
