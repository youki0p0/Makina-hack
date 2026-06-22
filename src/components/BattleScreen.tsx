"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ActionButtons from "@/components/ActionButtons";
import BattleLog from "@/components/BattleLog";
import DiceDisplay from "@/components/DiceDisplay";
import EnemyCard from "@/components/EnemyCard";
import PlayerBar from "@/components/PlayerBar";
import ShopScreen from "@/components/ShopScreen";
import SoundToggle from "@/components/SoundToggle";
import PixelGlyph from "@/components/PixelGlyph";
import EndingOverlay from "@/components/battle/EndingOverlay";
import EndlessMessageOverlay from "@/components/battle/EndlessMessageOverlay";
import WorldClearOverlay from "@/components/battle/WorldClearOverlay";
import ResultOverlay from "@/components/battle/ResultOverlay";
import { getWorld, getWorldBackground } from "@/data/worlds";
import { useGameStore } from "@/store/gameStore";

export default function BattleScreen() {
  const battleState = useGameStore((s) => s.battleState);
  const currentEnemy = useGameStore((s) => s.currentEnemy);
  const currentFloor = useGameStore((s) => s.currentFloor);
  const worldCleared = useGameStore((s) => s.worldCleared);
  const pendingEnding = useGameStore((s) => s.pendingEnding);
  const endlessMessage = useGameStore((s) => s.endlessMessage);
  const enterCurrentFloor = useGameStore((s) => s.enterCurrentFloor);
  const [auto, setAuto] = useState<0 | 1 | 2>(0); // 0 off / 1 auto / 2 fast
  const world = getWorld(currentFloor);

  // On entering with nothing in progress, resolve the floor (battle or shop).
  useEffect(() => {
    if ((battleState === "idle" || !currentEnemy) && battleState !== "won" && battleState !== "lost" && battleState !== "shop") {
      enterCurrentFloor();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-battle: an INTERVAL drives every step from live store state. This is
  // robust against repeated dice values (the old effect keyed on diceValue and
  // stalled when two rolls matched). Also auto-skips shops; pauses on overlays.
  useEffect(() => {
    if (!auto) return;
    const period = auto === 2 ? 180 : 480;
    const id = setInterval(() => {
      // Don't churn state / audio in a backgrounded tab — it bloats memory and
      // stalls the page on return. Resume automatically when visible again.
      if (typeof document !== "undefined" && document.hidden) return;
      const s = useGameStore.getState();
      if (s.battleState === "player") {
        s.confirm();
      } else if (s.battleState === "shop") {
        s.leaveShop();
      } else if (s.battleState === "won") {
        if (s.pendingEnding || s.endlessMessage || s.worldCleared !== null) return; // wait for the overlay
        s.enterCurrentFloor();
      } else if (s.battleState === "lost") {
        setAuto(0);
      }
    }, period);
    return () => clearInterval(id);
  }, [auto]);

  if (battleState === "shop") {
    return <ShopScreen />;
  }

  return (
    <div
      className="flex h-[100dvh] flex-col gap-2 overflow-hidden px-3 pt-2"
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
        background: getWorldBackground(world),
        // NOTE: no `background-attachment: fixed` — on mobile it forces the whole
        // multi-layer background to re-rasterize on every repaint (each dice
        // roll/animation), which froze the battle screen. A normal background is
        // cached as one layer and repaints stay cheap.
      }}
    >
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
        >
          ← タイトル
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => setAuto((a) => ((a + 1) % 3) as 0 | 1 | 2)}
            className={`rounded-lg px-3 py-1 text-xs font-bold active:scale-95 ${
              auto ? "bg-amber-500 text-black" : "bg-white/10 text-gray-300"
            }`}
          >
            {auto === 0 ? "⏵ オート" : auto === 1 ? "⏩ オート中" : "⏩⏩ ×2"}
          </button>
          <SoundToggle />
          <Link
            href="/help"
            className="flex items-center rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
          >
            <PixelGlyph kind="help" size={16} />
          </Link>
          <Link
            href="/inventory"
            className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
          >
            <PixelGlyph kind="bag" size={16} /> 装備
          </Link>
        </div>
      </div>

      {/* Chapter banner: which world / floor you're descending through. */}
      <div className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-1">
        <span className="text-xs font-bold" style={{ color: world.accent }}>
          第{world.chapter}章 {world.name}
        </span>
        <span className="text-[10px] text-gray-400">{world.subtitle}</span>
      </div>

      {/* Scrollable middle so the action bar stays pinned and visible. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <EnemyCard />
        <PlayerBar />
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <DiceDisplay />
        </div>
        <BattleLog />
      </div>

      {/* Pinned action area, padded above the browser/system bar. */}
      <div
        className="flex flex-col gap-2"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <ActionButtons />
      </div>

      {pendingEnding ? (
        <EndingOverlay />
      ) : endlessMessage ? (
        <EndlessMessageOverlay text={endlessMessage} />
      ) : worldCleared !== null ? (
        <WorldClearOverlay floor={worldCleared} />
      ) : battleState === "won" || battleState === "lost" ? (
        <ResultOverlay />
      ) : null}
    </div>
  );
}
