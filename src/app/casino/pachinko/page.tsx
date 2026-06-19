"use client";

import Link from "next/link";
import { useCallbackRef } from "@/lib/useCallbackRef";
import { useEffect, useRef, useState } from "react";
import PachinkoBoard, { type PachinkoBoardHandle } from "@/components/casino/PachinkoBoard";
import PachinkoReels, { type PachinkoReelsHandle } from "@/components/casino/PachinkoReels";
import PayoutParticles, { type PayoutParticlesHandle } from "@/components/casino/PayoutParticles";
import { PACHINKO_CONFIG, BOARD } from "@/lib/pachinko/config";
import { spinReels, type Mode, type ReelResult } from "@/lib/pachinko/reels";
import { getSymbol } from "@/lib/pachinko/symbols";
import { planPayout, counterStep, particlesThisFrame } from "@/lib/pachinko/payout";
import { initAudio, slotSfx } from "@/lib/audio";
import { fmt } from "@/lib/ui";

const START_BALLS = 500;
const HOLD_MAX = 4;
// 確変/時短(Makina Mode)の回転数。海物語の電サポ区間に相当。
const MAKINA_SPINS = { jackpot: 100, big: 60 };
// ラウンド制アタッカーの表示用ラウンド数。
const ROUNDS: Record<string, number> = { small: 2, normal: 4, big: 8, jackpot: 16 };

interface Bonus {
  label: string;
  color: string;
  rounds: number;
  round: number;
}

// 保留＝ヘソ入賞時に内部抽選済みの1変動（実機どおり）。色は信頼度の先読み示唆。
interface Hold {
  result: ReelResult;
  color: string;
}
const HOLD_COLORS: Record<string, string> = {
  white: "#e5e7eb",
  blue: "#38bdf8",
  green: "#34d399",
  red: "#f43f5e",
  rainbow: "#fbbf24",
};

/** 先読み色を抽選（赤/虹はほぼ当たり、まれにガセ＝裏切りで興奮を作る）。 */
function holdColorFor(result: ReelResult, rng = Math.random): string {
  if (result.win) {
    if (result.jackpot) return "rainbow";
    if (result.tier === "big") return rng() < 0.55 ? "red" : "green";
    return rng() < 0.5 ? "green" : rng() < 0.5 ? "blue" : "white";
  }
  // ハズレ：ほぼ白、まれに高信頼色（ガセ）。
  const r = rng();
  if (r < 0.012) return "red";
  if (r < 0.05) return "green";
  if (r < 0.16) return "blue";
  return "white";
}

export default function PachinkoPage() {
  const boardRef = useRef<PachinkoBoardHandle>(null);
  const reelsRef = useRef<PachinkoReelsHandle>(null);
  const particlesRef = useRef<PayoutParticlesHandle>(null);

  const [balls, setBalls] = useState(START_BALLS);
  const ballsRef = useRef(balls);
  ballsRef.current = balls;

  const [mode, setMode] = useState<Mode>("normal");
  const modeRef = useRef<Mode>("normal");
  modeRef.current = mode;

  // 保留(ヘソ入賞のストック、最大4。各保留は抽選済み結果＋先読み色を持つ)。
  const [holds, setHolds] = useState<Hold[]>([]);
  const holdsRef = useRef<Hold[]>([]);
  holdsRef.current = holds;

  // Makina Mode 残り回転。
  const [makina, setMakina] = useState(0);
  const makinaRef = useRef(0);
  makinaRef.current = makina;

  const [bonus, setBonus] = useState<Bonus | null>(null);
  const bonusRef = useRef<Bonus | null>(null);
  bonusRef.current = bonus;

  const [auto, setAuto] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [effects, setEffects] = useState(true);
  const [flash, setFlash] = useState(false);

  const payoutBalls = useRef(0);
  const payoutParticles = useRef(0);
  const payoutTotal = useRef(1);
  const payoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (m.matches) {
      setReduced(true);
      setEffects(false);
    }
  }, []);

  // ===== 払い出しループ（ラウンド制アタッカー：数秒かけて出玉カウンタを増やす） =====
  const drainPayout = () => {
    if (payoutTimer.current) return;
    payoutTimer.current = setInterval(() => {
      if (payoutBalls.current <= 0 && payoutParticles.current <= 0) {
        if (payoutTimer.current) clearInterval(payoutTimer.current);
        payoutTimer.current = null;
        window.setTimeout(() => setBonus(null), 500);
        return;
      }
      if (payoutBalls.current > 0) {
        const step = counterStep(payoutBalls.current, 75, reduced);
        const inc = Math.min(payoutBalls.current, step);
        payoutBalls.current -= inc;
        setBalls((b) => b + inc);
        // ラウンド表示を出玉の進捗に同期。
        const b0 = bonusRef.current;
        if (b0) {
          const prog = 1 - payoutBalls.current / Math.max(1, payoutTotal.current);
          const round = Math.min(b0.rounds, Math.max(1, Math.ceil(prog * b0.rounds)));
          if (round !== b0.round) setBonus({ ...b0, round });
        }
      }
      if (payoutParticles.current > 0) {
        const n = particlesThisFrame(payoutParticles.current, reduced);
        payoutParticles.current -= n;
        particlesRef.current?.emit(n);
      }
    }, 33);
  };

  const startPayout = (result: ReelResult) => {
    const plan = planPayout(result);
    if (!plan) return;
    const sym = getSymbol(result.symbolId ?? 1);
    setBonus({ label: sym.bonus, color: sym.color, rounds: ROUNDS[sym.tier] ?? 2, round: 1 });
    payoutTotal.current = plan.balls;
    payoutBalls.current += plan.balls;
    payoutParticles.current += plan.particleBudget;
    if (effects) particlesRef.current?.emit(0, plan.rainbow);
    if (plan.rainbow) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 8000);
      slotSfx("bonusBig");
    } else {
      slotSfx("bonus");
    }
    drainPayout();
  };

  // ===== 変動の確定処理 =====
  const onReelDone = useCallbackRef((result: ReelResult) => {
    if (result.win) {
      if (effects && typeof navigator !== "undefined") {
        navigator.vibrate?.(result.jackpot ? [40, 30, 80] : 30);
      }
      startPayout(result);
      if (result.enterComplete) {
        // 確変突入/引き戻し（Makina Mode を満タンに）。
        const k = result.jackpot ? MAKINA_SPINS.jackpot : MAKINA_SPINS.big;
        setMakina(k);
        makinaRef.current = k;
        setMode("complete");
        modeRef.current = "complete";
      }
    }
    // 通常モードのみ保留消化で連続変動（Makina はタイマー駆動）。
    if (modeRef.current === "normal" && holdsRef.current.length > 0) {
      const [next, ...rest] = holdsRef.current;
      holdsRef.current = rest;
      setHolds(rest);
      window.setTimeout(() => doSpinWith(next.result), 80);
    }
  });

  const doSpinWith = useCallbackRef((result: ReelResult) => {
    if (result.reach && effects) slotSfx("reach");
    reelsRef.current?.spin(result, () => onReelDone(result));
  });

  // ヘソ入賞。入賞時に1変動を内部抽選し、変動中なら保留(最大4)に積む（実機どおり）。
  const onPocket = useCallbackRef(() => {
    slotSfx("small");
    if (effects && typeof navigator !== "undefined") navigator.vibrate?.(8);
    if (modeRef.current === "complete") return;
    const result = spinReels("normal");
    if (reelsRef.current?.busy()) {
      if (holdsRef.current.length >= HOLD_MAX) return; // 保留満タンは入賞のみ（変動せず）
      const hold: Hold = { result, color: HOLD_COLORS[holdColorFor(result)] };
      holdsRef.current = [...holdsRef.current, hold];
      setHolds(holdsRef.current);
    } else {
      doSpinWith(result);
    }
  });

  // ===== Makina Mode（確変/時短=電サポ）: 右打ち相当で回り続ける =====
  useEffect(() => {
    if (mode !== "complete") return;
    const id = setInterval(() => {
      if (makinaRef.current <= 0) {
        setMode("normal");
        modeRef.current = "normal";
        setMakina(0);
        return;
      }
      if (!reelsRef.current?.busy()) {
        setMakina((m) => {
          const n = Math.max(0, m - 1);
          makinaRef.current = n;
          return n;
        });
        doSpinWith(spinReels("complete"));
      }
    }, 900);
    return () => clearInterval(id);
  }, [mode, doSpinWith]);

  // ===== 発射 =====
  const launch = useCallbackRef(() => {
    if (ballsRef.current < BOARD.startCost) return;
    initAudio();
    const ok = boardRef.current?.launch();
    if (ok) {
      setBalls((b) => b - BOARD.startCost);
      slotSfx("lever");
    }
  });

  // オート発射。Makina 中(電サポ=右打ち)は常時自動で打つ。
  useEffect(() => {
    if (!auto && mode !== "complete") return;
    const id = setInterval(() => launch(), PACHINKO_CONFIG.launchIntervalMs);
    return () => clearInterval(id);
  }, [auto, mode, launch]);

  useEffect(() => {
    return () => {
      if (payoutTimer.current) clearInterval(payoutTimer.current);
    };
  }, []);

  const complete = mode === "complete";

  return (
    <main className="flex min-h-dvh flex-col gap-2 p-3">
      {flash && (
        <div
          className="pointer-events-none fixed inset-0 z-40 animate-pulse"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(255,0,0,.18), rgba(255,200,0,.18), rgba(0,255,128,.18), rgba(0,160,255,.18), rgba(180,0,255,.18), rgba(255,0,0,.18))",
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <Link href="/casino" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← カジノ
        </Link>
        <span className={`text-xs font-bold ${complete ? "animate-pulse text-amber-300" : "text-cyan-200"}`}>
          {complete ? `🌊 Makina Mode（確変/時短）残り${makina}` : "通常モード"}
        </span>
      </div>

      {/* 所持玉 ＋ 保留ランプ */}
      <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-black/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">保留</span>
          <div className="flex gap-1">
            {Array.from({ length: HOLD_MAX }, (_, i) => {
              const h = holds[i];
              return (
                <span
                  key={i}
                  className="h-2.5 w-2.5 rounded-full transition-colors"
                  style={{
                    background: h ? h.color : "rgba(255,255,255,.15)",
                    boxShadow: h && h.color !== HOLD_COLORS.white ? `0 0 5px ${h.color}` : "none",
                  }}
                />
              );
            })}
          </div>
        </div>
        <span className="text-lg font-black text-amber-300">玉 {fmt(balls)}</span>
      </div>

      {/* 盤面が中央モニターを囲む“ひとつの台”。役物の窪みに図柄オーバーレイを重ねる。 */}
      <div className="relative w-full">
        <PachinkoBoard ref={boardRef} onPocket={onPocket} reduced={reduced} denchu={complete} />
        <div
          className="absolute"
          style={{
            left: `${(BOARD.monitorX / BOARD.width) * 100}%`,
            top: `${(BOARD.monitorY / BOARD.height) * 100}%`,
            width: `${(BOARD.monitorW / BOARD.width) * 100}%`,
            height: `${(BOARD.monitorH / BOARD.height) * 100}%`,
          }}
        >
          <PachinkoReels ref={reelsRef} effects={effects} reduced={reduced} />
        </div>
        {/* ラウンド制アタッカー出玉オーバーレイ（役物直下） */}
        {bonus && (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 text-center"
            style={{ top: `${((BOARD.monitorY + BOARD.monitorH + 2) / BOARD.height) * 100}%` }}
          >
            <span
              className="rounded-full px-3 py-0.5 text-xs font-black text-black"
              style={{ background: bonus.color }}
            >
              {bonus.label}　ROUND {bonus.round}/{bonus.rounds}
            </span>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-cyan-300/70">
        玉がヘソ(中央)に入ると変動！ ステージ中央のワープに乗ると吸い込み濃厚
      </p>

      <div className="rounded-xl border border-amber-400/20 bg-black/40">
        <PayoutParticles ref={particlesRef} reduced={reduced} />
      </div>

      <button
        onClick={() => launch()}
        disabled={balls < BOARD.startCost}
        className="h-14 rounded-2xl bg-amber-500 text-lg font-extrabold text-black active:scale-95 disabled:opacity-40"
      >
        ● 発射（左上打ち / 玉 -{BOARD.startCost}）
      </button>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Toggle label="オート発射" on={auto} onClick={() => setAuto((v) => !v)} />
        <Toggle label="軽量モード" on={reduced} onClick={() => setReduced((v) => !v)} />
        <Toggle label="演出" on={effects} onClick={() => setEffects((v) => !v)} />
      </div>

      <p className="pb-2 text-center text-[10px] text-gray-500">
        左上打ち→釘を流れて中央へ→ステージ＆ワープでヘソIN→図柄変動。
        4/5/6/7当たりで確変(Makina Mode)＝右打ち高速回転。
      </p>
    </main>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-10 rounded-xl font-bold active:scale-95 ${
        on ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-300"
      }`}
    >
      {label}: {on ? "ON" : "OFF"}
    </button>
  );
}
