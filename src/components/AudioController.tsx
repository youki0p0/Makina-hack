"use client";

import { useEffect } from "react";
import { initAudio, isMuted, startBgm } from "@/lib/audio";

/**
 * Starts audio on the first user gesture (browsers block autoplay).
 * Mounted once in the root layout.
 */
export default function AudioController() {
  useEffect(() => {
    const onGesture = () => {
      initAudio();
      if (!isMuted()) startBgm();
    };
    window.addEventListener("pointerdown", onGesture, { once: true });
    return () => window.removeEventListener("pointerdown", onGesture);
  }, []);

  return null;
}
