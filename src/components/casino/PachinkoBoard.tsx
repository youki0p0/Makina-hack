"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { BOARD, PACHINKO_CONFIG } from "@/lib/pachinko/config";
import { buildPegs, launchBall, stepBall, type Ball, type Peg } from "@/lib/pachinko/physics";

export interface PachinkoBoardHandle {
  /** 左上から1球発射。盤上の球が上限なら false。 */
  launch: () => boolean;
  /** 盤上で稼働中の球数。 */
  activeCount: () => number;
}

/**
 * 盤面 Canvas。物理玉（最大 maxPhysicsBalls）を requestAnimationFrame で更新し、
 * 入賞口に入ったら onPocket を呼ぶ。object pool で球を再利用。非表示時は停止。
 */
const PachinkoBoard = forwardRef<PachinkoBoardHandle, { onPocket: () => void; reduced?: boolean }>(
  function PachinkoBoard({ onPocket, reduced = false }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const balls = useRef<Ball[]>([]);
    const pegs = useRef<Peg[]>([]);
    const raf = useRef<number | null>(null);
    const visible = useRef(true);
    const onPocketRef = useRef(onPocket);
    onPocketRef.current = onPocket;

    const cap = () =>
      reduced ? Math.ceil(PACHINKO_CONFIG.maxPhysicsBalls / 2) : PACHINKO_CONFIG.maxPhysicsBalls;

    useImperativeHandle(ref, () => ({
      launch() {
        const active = balls.current.filter((b) => b.active).length;
        if (active >= cap()) return false;
        // pool 上の非アクティブ枠を再利用。
        const fresh = launchBall(BOARD);
        const slot = balls.current.find((b) => !b.active);
        if (slot) Object.assign(slot, fresh);
        else balls.current.push(fresh);
        return true;
      },
      activeCount() {
        return balls.current.filter((b) => b.active).length;
      },
    }));

    useEffect(() => {
      pegs.current = buildPegs(BOARD);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const draw = () => {
        ctx.clearRect(0, 0, BOARD.width, BOARD.height);
        // 盤面（深海グラデ）。
        const g = ctx.createLinearGradient(0, 0, 0, BOARD.height);
        g.addColorStop(0, "#0a1530");
        g.addColorStop(1, "#06243a");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, BOARD.width, BOARD.height);

        // 左上打ちのレール（左下の発射口 → 左を上って → 天＝中央上へ）。
        ctx.strokeStyle = "rgba(255,207,51,.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, BOARD.height - 18);
        ctx.lineTo(10, 14);
        ctx.quadraticCurveTo(10, 7, BOARD.pocketX - 8, 7);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = "#ffcf33";
        ctx.beginPath();
        ctx.arc(10, BOARD.height - 18, 5, 0, Math.PI * 2); // 発射口（左下）
        ctx.fill();

        // ピン。
        ctx.fillStyle = "#8fb3d9";
        for (const p of pegs.current) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, BOARD.pegRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        // 入賞口（中央下のスタートチャッカー）。
        ctx.fillStyle = "rgba(124,92,255,.25)";
        ctx.fillRect(
          BOARD.pocketX - BOARD.pocketW / 2,
          BOARD.pocketY,
          BOARD.pocketW,
          BOARD.pocketH,
        );
        ctx.strokeStyle = "#7c5cff";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          BOARD.pocketX - BOARD.pocketW / 2,
          BOARD.pocketY,
          BOARD.pocketW,
          BOARD.pocketH,
        );
        ctx.lineWidth = 1;
        ctx.fillStyle = "#cdbcff";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("START", BOARD.pocketX, BOARD.pocketY + 17);

        // 球。
        ctx.fillStyle = "#f4f7ff";
        for (const b of balls.current) {
          if (!b.active) continue;
          ctx.beginPath();
          ctx.arc(b.x, b.y, BOARD.ballRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      const frame = () => {
        raf.current = requestAnimationFrame(frame);
        if (!visible.current) return;
        for (const b of balls.current) {
          if (!b.active) continue;
          const ev = stepBall(b, pegs.current, BOARD);
          if (ev === "pocket") onPocketRef.current();
        }
        draw();
      };
      draw();
      raf.current = requestAnimationFrame(frame);

      const onVis = () => {
        visible.current = document.visibilityState === "visible";
      };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        if (raf.current != null) cancelAnimationFrame(raf.current);
        document.removeEventListener("visibilitychange", onVis);
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        width={BOARD.width}
        height={BOARD.height}
        className="w-full rounded-xl border border-cyan-500/30"
        style={{ aspectRatio: `${BOARD.width} / ${BOARD.height}` }}
        aria-label="パチンコ盤面"
      />
    );
  },
);

export default PachinkoBoard;
