"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { bossRank } from "@/data/enemies";
import { initAudio, isMuted, setBgmTheme, startBgm } from "@/lib/audio";
import { useGameStore } from "@/store/gameStore";

/**
 * Starts audio on the first user gesture (browsers block autoplay) and switches
 * the BGM theme by location: casino / forge / dungeon, and on the battle screen
 * a per-50-floor "world" theme (pitch shifts deeper) or a tense boss theme.
 */
export default function AudioController() {
  const pathname = usePathname();
  const floor = useGameStore((s) => s.currentFloor);

  useEffect(() => {
    const onGesture = () => {
      initAudio();
      if (!isMuted()) startBgm();
    };
    window.addEventListener("pointerdown", onGesture, { once: true });
    return () => window.removeEventListener("pointerdown", onGesture);
  }, []);

  useEffect(() => {
    if (pathname?.startsWith("/casino")) setBgmTheme("casino");
    else if (pathname?.startsWith("/forge")) setBgmTheme("forge");
    else if (pathname?.startsWith("/battle")) {
      if (bossRank(floor) >= 2) {
        setBgmTheme("boss");
      } else {
        const seg = Math.floor((floor - 1) / 50); // new key every 50 floors
        setBgmTheme("world", Math.pow(2, (seg % 6) / 12));
      }
    } else {
      setBgmTheme("dungeon");
    }
  }, [pathname, floor]);

  return null;
}
