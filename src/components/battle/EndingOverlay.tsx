"use client";

import { useState } from "react";
import { ENDING_STAFF_ROLL, ENDING_PROMPT, NG_PLUS_SEQUENCE } from "@/data/lore";
import { useGameStore } from "@/store/gameStore";

/** The unskippable 1000F ending: staff roll → YES/NO → (YES) 強くてニューゲーム. */
export default function EndingOverlay() {
  const newGamePlus = useGameStore((s) => s.newGamePlus);
  const declineEnding = useGameStore((s) => s.declineEnding);
  const [step, setStep] = useState<"roll" | "ngplus">("roll");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black p-6 text-center">
      <div className="w-full max-w-sm">
        {step === "roll" ? (
          <>
            <div className="space-y-1 text-sm leading-relaxed text-white">
              {ENDING_STAFF_ROLL.map((line, i) => (
                <p key={i} className={line === "" ? "h-3" : ""}>
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => setStep("ngplus")}
                className="h-14 rounded-2xl border border-white/40 bg-white/5 text-lg font-bold text-white active:scale-95"
              >
                ▶ {ENDING_PROMPT.yes}
              </button>
              <button
                onClick={declineEnding}
                className="h-12 rounded-2xl border border-white/15 text-sm font-bold text-gray-300 active:scale-95"
              >
                {ENDING_PROMPT.no}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1 text-sm leading-relaxed text-white">
              {NG_PLUS_SEQUENCE.map((line, i) => (
                <p key={i} className={line === "" ? "h-3" : ""}>
                  {line}
                </p>
              ))}
            </div>
            <button
              onClick={newGamePlus}
              className="mt-6 h-14 w-full rounded-2xl border border-white/40 bg-white/5 text-lg font-bold text-white active:scale-95"
            >
              再起動する
            </button>
          </>
        )}
      </div>
    </div>
  );
}
