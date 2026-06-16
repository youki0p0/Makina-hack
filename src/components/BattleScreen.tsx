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
import { sfx } from "@/lib/audio";
import { rarityStyle } from "@/lib/ui";
import { fmt } from "@/lib/ui";
import ItemIcon from "@/components/ItemIcon";
import PixelGlyph from "@/components/PixelGlyph";
import { getWorld, getWorldBackground, FINAL_FLOOR } from "@/data/worlds";
import { ENDING_STAFF_ROLL, ENDING_PROMPT, NG_PLUS_SEQUENCE } from "@/data/lore";
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
        backgroundAttachment: "fixed",
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

/** The unskippable 1000F ending: staff roll → YES/NO → (YES) 強くてニューゲーム. */
function EndingOverlay() {
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

/** A single Endless-Abyss story line (NO route), shown once. */
function EndlessMessageOverlay({ text }: { text: string }) {
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

/** Quiet, premium "World Complete" screen shown when a 100th-floor boss falls. */
function WorldClearOverlay({ floor }: { floor: number }) {
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

function ResultOverlay() {
  const battleState = useGameStore((s) => s.battleState);
  const result = useGameStore((s) => s.lastResult);
  const floor = useGameStore((s) => s.currentFloor);
  const enterCurrentFloor = useGameStore((s) => s.enterCurrentFloor);
  const startBattle = useGameStore((s) => s.startBattle);

  const won = battleState === "won";
  useEffect(() => {
    if (battleState === "won") sfx("win");
    else if (battleState === "lost") sfx("lose");
  }, [battleState]);

  if (!result) return null;
  const victory = won;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-sm animate-pop rounded-2xl border border-white/15 bg-[#15131f] p-5 text-center">
        <h2
          className={`text-2xl font-extrabold ${
            victory ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {victory ? "勝利！" : "敗北…"}
        </h2>

        {victory ? (
          <div className="mt-3 space-y-1 text-sm text-gray-200">
            <p>EXP +{fmt(result.expGained)}</p>
            <p>ゴールド +{fmt(result.goldGained)}</p>
            {result.streakBonusPct > 0 && (
              <p className="flex items-center justify-center gap-1 text-orange-300">
                <PixelGlyph kind="fire" size={14} /> {result.winStreak}連勝 ボーナス +{result.streakBonusPct}%
              </p>
            )}
            {result.leveledUp && <p className="text-yellow-300">レベルアップ！</p>}
            {result.drop ? (
              <div
                className={`mt-3 flex items-center gap-2 rounded-lg border p-2 text-left ${rarityStyle[result.drop.rarity].border} ${rarityStyle[result.drop.rarity].bg}`}
              >
                <ItemIcon item={result.drop} size={48} />
                <div className="min-w-0 flex-1">
                  <p className={`flex items-center gap-1 font-bold ${rarityStyle[result.drop.rarity].text}`}>
                    <PixelGlyph kind="drop" size={14} /> {result.drop.name}
                    {result.dropCount && result.dropCount > 1 && (
                      <span className="ml-1 text-[10px] text-gray-300">ほか +{result.dropCount - 1}個</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-300">{result.drop.description}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">ドロップなし</p>
            )}
            {result.consumable && (
              <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2">
                <p className="flex items-center gap-1 font-bold text-emerald-300">
                  <PixelGlyph kind="heal" size={14} /> {result.consumable.name} を使用
                </p>
                <p className="mt-0.5 text-xs text-gray-300">
                  {result.consumable.kind === "heal"
                    ? `HP +${result.healed}`
                    : result.consumable.description}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-1 text-sm text-gray-200">
            <p>ゴールド -{fmt(result.goldLost)}</p>
            <p className="text-xs text-gray-400">
              {floor > 1 ? `セーブポイント ${floor}階 から再開。` : "ダンジョンの最初に戻された。"}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={victory ? enterCurrentFloor : startBattle}
            className="h-14 rounded-2xl bg-emerald-600 text-lg font-bold text-white active:scale-95"
          >
            {victory ? `${floor}階へ進む →` : "再挑戦する"}
          </button>
          <Link
            href="/inventory"
            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-center font-bold active:scale-95"
          >
            <PixelGlyph kind="bag" size={18} /> 装備を整える
          </Link>
          {!victory && (
            <>
              <Link
                href="/class"
                className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-center font-bold active:scale-95"
              >
                <PixelGlyph kind="attack" size={18} /> 転職する
              </Link>
              <Link
                href="/"
                className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-center font-bold active:scale-95"
              >
                <PixelGlyph kind="home" size={18} /> ホームに戻る
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
