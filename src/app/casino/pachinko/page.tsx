"use client";

import Link from "next/link";
import { useCallbackRef } from "@/lib/useCallbackRef";
import { useEffect, useRef, useState } from "react";
import PachinkoBoard, { type PachinkoBoardHandle } from "@/components/casino/PachinkoBoard";
import PachinkoReels, { type PachinkoReelsHandle } from "@/components/casino/PachinkoReels";
import PayoutParticles, { type PayoutParticlesHandle } from "@/components/casino/PayoutParticles";
import { PACHINKO_CONFIG, BOARD } from "@/lib/pachinko/config";
import { spinReels, type Mode, type ReelResult } from "@/lib/pachinko/reels";
import { planPayout, counterStep, particlesThisFrame, stepTowards } from "@/lib/pachinko/payout";
import { initAudio, slotSfx } from "@/lib/audio";
import { fmt } from "@/lib/ui";

const START_BALLS = 500;

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

  const [auto, setAuto] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [effects, setEffects] = useState(true);
  const [flash, setFlash] = useState(false);

  // 入賞キュー（リール変動中の入賞は溜める）。
  const pendingSpins = useRef(0);
  // 払い出しの残り（玉・粒子）。複数当たりは加算。
  const payoutBalls = useRef(0);
  const payoutParticles = useRef(0);
  const payoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // prefers-reduced-motion → 自動で軽量モード。
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (m.matches) {
      setReduced(true);
      setEffects(false);
    }
  }, []);

  // ===== 払い出しループ（数秒かけて玉カウンタを増やし、払い出し玉を流す） =====
  const drainPayout = () => {
    if (payoutTimer.current) return;
    payoutTimer.current = setInterval(() => {
      if (payoutBalls.current <= 0 && payoutParticles.current <= 0) {
        if (payoutTimer.current) clearInterval(payoutTimer.current);
        payoutTimer.current = null;
        return;
      }
      if (payoutBalls.current > 0) {
        // 残りを ~2.5秒で消化する想定のフレーム数で割る。
        const step = counterStep(payoutBalls.current, 75, reduced);
        const inc = Math.min(payoutBalls.current, step);
        payoutBalls.current -= inc;
        setBalls((b) => b + inc);
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

  // ===== リール変動 =====
  const onReelDone = useCallbackRef((result: ReelResult) => {
    if (result.win) {
      startPayout(result);
      if (result.enterComplete) setMode("complete");
    } else if (modeRef.current === "complete" && Math.random() < 0.25) {
      // 確変転落。
      setMode("normal");
    }
    // 溜まった入賞があれば続けて変動。
    if (pendingSpins.current > 0) {
      pendingSpins.current -= 1;
      window.setTimeout(() => doSpin(), 60);
    }
  });

  const doSpin = useCallbackRef(() => {
    const result = spinReels(modeRef.current);
    if (result.reach && effects) slotSfx("reach");
    reelsRef.current?.spin(result, () => onReelDone(result));
  });

  // 入賞口に球が入った。変動中はキューに積む（バックログ過多を防ぐため上限3）。
  const onPocket = useCallbackRef(() => {
    slotSfx("small");
    if (reelsRef.current?.busy()) {
      pendingSpins.current = Math.min(3, pendingSpins.current + 1);
    } else {
      doSpin();
    }
  });

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

  // オート発射。
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => launch(), PACHINKO_CONFIG.launchIntervalMs);
    return () => clearInterval(id);
  }, [auto, launch]);

  useEffect(() => {
    return () => {
      if (payoutTimer.current) clearInterval(payoutTimer.current);
    };
  }, []);

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
        <span className="text-xs font-bold text-cyan-200">
          {mode === "complete" ? "🌊 Makina Mode（確変）" : "通常モード"}
        </span>
      </div>

      <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-2 text-center">
        <h1 className="font-bold text-cyan-200">奈落海 / Abyss Marine</h1>
        <p className="text-[10px] text-gray-400">
          深海×歯車×ダイス×固有武器のパチンコ。7以外でも3つ揃えば当たり。
        </p>
      </div>

      {/* 所持玉 */}
      <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-black/30 px-3 py-2">
        <span className="text-xs text-gray-300">所持玉</span>
        <span className="text-xl font-black text-amber-300">{fmt(balls)}</span>
      </div>

      {/* 主役: 中央モニター（固有武器のドット絵が変動） */}
      <PachinkoReels ref={reelsRef} effects={effects} reduced={reduced} />

      {/* モニター直下の盤面“帯”。左上打ちした玉が中央のヘソに入るか（玉・釘はドット描画）。 */}
      <p className="-mb-1 text-center text-[10px] text-cyan-300/70">
        ▲ 玉がヘソ(中央)に入ると上のモニターが変動！
      </p>
      <PachinkoBoard ref={boardRef} onPocket={onPocket} reduced={reduced} />

      {/* 下部: 出玉演出（薄め） */}
      <div className="rounded-xl border border-amber-400/20 bg-black/40">
        <PayoutParticles ref={particlesRef} reduced={reduced} />
      </div>

      {/* 操作 */}
      <button
        onClick={() => launch()}
        disabled={balls < BOARD.startCost}
        className="h-14 rounded-2xl bg-amber-500 text-lg font-extrabold text-black active:scale-95 disabled:opacity-40"
      >
        ● 発射（玉 -{BOARD.startCost}）
      </button>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Toggle label="オート発射" on={auto} onClick={() => setAuto((v) => !v)} />
        <Toggle label="軽量モード" on={reduced} onClick={() => setReduced((v) => !v)} />
        <Toggle label="演出" on={effects} onClick={() => setEffects((v) => !v)} />
      </div>

      <p className="pb-2 text-center text-[10px] text-gray-500">
        球は左上から発射 → 釘を流れて中央下の入賞口へ → 図柄変動 → 当たりで大量払い出し。
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
