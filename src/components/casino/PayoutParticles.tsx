"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { PACHINKO_CONFIG } from "@/lib/pachinko/config";

export interface PayoutParticlesHandle {
  /** 払い出し粒子を count 個キューに積む。rainbow で虹色。 */
  emit: (count: number, rainbow?: boolean) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
  active: boolean;
}

const W = 320;
const H = 120;

/**
 * 下部の出玉演出。見た目専用の粒子（物理演算なし）。object pool で再利用し、
 * 最大 jackpotMaxPayoutParticles 個まで。非表示時 / reduced で自動軽量化。
 */
const PayoutParticles = forwardRef<PayoutParticlesHandle, { reduced?: boolean }>(
  function PayoutParticles({ reduced = false }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pool = useRef<Particle[]>([]);
    const pending = useRef(0);
    const rainbow = useRef(false);
    const raf = useRef<number | null>(null);
    const visible = useRef(true);
    // 粒子も保留も無いアイドル時に毎フレーム clearRect/描画し続けると発熱する。
    // 空になったら1回だけクリアし、以降のフレームは描画をスキップする。
    const idleCleared = useRef(false);

    useImperativeHandle(ref, () => ({
      emit(count: number, rb = false) {
        pending.current += Math.max(0, Math.floor(count));
        if (rb) rainbow.current = true;
      },
    }));

    useEffect(() => {
      const cap = PACHINKO_CONFIG.jackpotMaxPayoutParticles;
      if (pool.current.length === 0) {
        pool.current = Array.from({ length: cap }, () => ({
          x: 0, y: 0, vx: 0, vy: 0, life: 0, hue: 45, active: false,
        }));
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const spawn = (n: number) => {
        let spawned = 0;
        for (let i = 0; i < pool.current.length && spawned < n; i++) {
          const p = pool.current[i];
          if (p.active) continue;
          p.active = true;
          p.x = 20 + Math.random() * (W - 40);
          p.y = -6;
          p.vx = (Math.random() - 0.5) * 1.6;
          p.vy = 1 + Math.random() * 2.4;
          p.life = 1;
          p.hue = rainbow.current ? Math.floor(Math.random() * 360) : 40 + Math.random() * 14;
          spawned++;
        }
      };

      const frame = () => {
        raf.current = requestAnimationFrame(frame);
        if (!visible.current) return;
        // 粒子も保留も無いフレームは描画スキップ（idle時の常時60fps描画＝発熱を断つ）。
        let anyActive = false;
        for (let i = 0; i < pool.current.length; i++) {
          if (pool.current[i].active) {
            anyActive = true;
            break;
          }
        }
        if (pending.current <= 0 && !anyActive) {
          if (!idleCleared.current) {
            ctx.clearRect(0, 0, W, H);
            idleCleared.current = true;
          }
          return;
        }
        idleCleared.current = false;
        // キュー消化（reduced 時は1フレームの放出を抑える）。
        const per = reduced
          ? Math.ceil(PACHINKO_CONFIG.payoutParticlesPerFrame / 2)
          : PACHINKO_CONFIG.payoutParticlesPerFrame;
        if (pending.current > 0) {
          const n = Math.min(pending.current, per);
          spawn(n);
          pending.current -= n;
          if (pending.current <= 0) rainbow.current = false;
        }
        ctx.clearRect(0, 0, W, H);
        for (const p of pool.current) {
          if (!p.active) continue;
          p.vy += 0.12;
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.012;
          if (p.life <= 0 || p.y > H + 8) {
            p.active = false;
            continue;
          }
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
          const col = rainbow.current || p.hue > 60 ? `hsl(${p.hue}, 90%, 60%)` : "#ffd54a";
          // 出玉コインは盤面の玉(半径5)より大きく＝コインがジャラジャラ出る満足感。
          const R = 7;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
          ctx.fill();
          // 縁取り＋ハイライトでコインらしく。
          ctx.strokeStyle = "rgba(120,80,0,.5)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,.55)";
          ctx.beginPath();
          ctx.arc(p.x - R * 0.3, p.y - R * 0.3, R * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      };
      raf.current = requestAnimationFrame(frame);

      const onVis = () => {
        visible.current = document.visibilityState === "visible";
      };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        if (raf.current != null) cancelAnimationFrame(raf.current);
        document.removeEventListener("visibilitychange", onVis);
      };
    }, [reduced]);

    return (
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="h-[120px] w-full rounded-xl"
        aria-hidden
      />
    );
  },
);

export default PayoutParticles;
