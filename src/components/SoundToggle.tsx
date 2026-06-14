"use client";

import { useEffect, useState } from "react";
import { initAudio, isMuted, setMuted } from "@/lib/audio";

export default function SoundToggle({ className = "" }: { className?: string }) {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  return (
    <button
      onClick={() => {
        initAudio();
        const next = !muted;
        setMuted(next);
        setMutedState(next);
      }}
      className={`rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95 ${className}`}
      aria-label="サウンド切替"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
