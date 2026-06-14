"use client";

import { useEffect, useRef, useState } from "react";
import { sfx, type Sfx } from "@/lib/audio";

export interface Floater {
  id: number;
  text: string;
  cls: string;
}

/**
 * Watches a numeric value (e.g. HP) and emits floating damage/heal numbers,
 * a shake trigger, vibration, and a sound effect when it changes.
 * `resetKey` resets the baseline without animating (e.g. a new enemy).
 */
export function useDamageFx(
  value: number,
  resetKey: string,
  hurtSfx: Sfx = "hit",
) {
  const prev = useRef(value);
  const prevKey = useRef(resetKey);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (prevKey.current !== resetKey) {
      prevKey.current = resetKey;
      prev.current = value;
      return;
    }
    const delta = value - prev.current;
    prev.current = value;
    if (delta === 0) return;

    const id = Date.now() + Math.random();
    const text = delta > 0 ? `+${delta}` : `${delta}`;
    const cls = delta > 0 ? "text-emerald-300" : "text-red-300";
    setFloaters((f) => [...f, { id, text, cls }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 800);

    if (delta < 0) {
      setShake((s) => s + 1);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
      sfx(hurtSfx);
    } else {
      sfx("heal");
    }
  }, [value, resetKey, hurtSfx]);

  return { floaters, shake };
}
