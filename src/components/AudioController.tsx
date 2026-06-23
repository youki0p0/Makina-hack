"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { bossRank } from "@/data/enemies";
import { FINAL_FLOOR, getWorld } from "@/data/worlds";
import { initAudio, isMuted, setBgmTheme, startBgm } from "@/lib/audio";
import type { BgmTheme } from "@/lib/audio";
import { useGameStore } from "@/store/gameStore";

/**
 * Starts audio on the first user gesture (browsers block autoplay) and switches
 * the BGM theme by location: casino (calm glamorous lounge; BIG/ダイスラッシュ
 * temporarily swaps to the idol theme) / forge / dungeon, and on the battle
 * screen a per-chapter location theme (w1…w11) or a tense boss theme.
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
    else if (pathname?.startsWith("/arena")) {
      // アリーナ（独立ゲーム）の準備フェーズ用ベーステーマ。
      // ボス戦中の切替は arena/BattleView 側が行う。
      setBgmTheme("idol");
    } else if (pathname?.startsWith("/battle")) {
      if (floor === FINAL_FLOOR) {
        setBgmTheme("final"); // 1000F ラスボス: 専用の最高潮テーマ
      } else if (bossRank(floor) >= 2) {
        setBgmTheme("boss");
      } else {
        // Each 100-floor chapter has its own location-themed track (w1…w11).
        const chapter = Math.min(11, getWorld(floor).chapter);
        setBgmTheme(`w${chapter}` as BgmTheme);
      }
    } else {
      setBgmTheme("dungeon");
    }
  }, [pathname, floor]);

  return null;
}
