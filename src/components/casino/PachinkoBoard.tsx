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
const PachinkoBoard = forwardRef<
  PachinkoBoardHandle,
  { onPocket: () => void; reduced?: boolean; denchu?: boolean }
>(function PachinkoBoard({ onPocket, reduced = false, denchu = false }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const balls = useRef<Ball[]>([]);
    const pegs = useRef<Peg[]>([]);
    const raf = useRef<number | null>(null);
    const visible = useRef(true);
    const onPocketRef = useRef(onPocket);
    onPocketRef.current = onPocket;
    const denchuRef = useRef(denchu);
    denchuRef.current = denchu;

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

        // 中央モニター（センター役物）の窪み。ここに図柄オーバーレイが重なる。
        const mX = BOARD.monitorX;
        const mY = BOARD.monitorY;
        const mW = BOARD.monitorW;
        const mH = BOARD.monitorH;
        ctx.fillStyle = "#02080f";
        ctx.fillRect(mX, mY, mW, mH);
        ctx.strokeStyle = "#2b6c86";
        ctx.lineWidth = 3;
        ctx.strokeRect(mX, mY, mW, mH);
        ctx.lineWidth = 1;

        // 役物を囲む装飾釘（左右の縁＋役物直下の天釘）。
        ctx.fillStyle = "#7d97ad";
        const frameNails: Array<[number, number]> = [];
        for (let y = mY + 14; y < mY + mH - 8; y += 26) {
          frameNails.push([14, y], [BOARD.width - 14, y]); // 左右の縁
        }
        for (let x = mX + 18; x < mX + mW - 12; x += 30) {
          frameNails.push([x, mY + mH + 10]); // 役物直下の天釘
        }
        for (const [x, y] of frameNails) {
          ctx.beginPath();
          ctx.arc(x, y, BOARD.pegRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        // 左上打ちのレール（左下の発射口 → 左の縁を上って → 天＝役物上へ）。
        ctx.strokeStyle = "rgba(255,207,51,.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, BOARD.height - 18);
        ctx.lineTo(8, 12);
        ctx.quadraticCurveTo(8, 5, BOARD.pocketX - 8, 5);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = "#ffcf33";
        ctx.beginPath();
        ctx.arc(8, BOARD.height - 18, 5, 0, Math.PI * 2); // 発射口（左下）
        ctx.fill();

        // プレイ領域の道釘。
        ctx.fillStyle = "#8fb3d9";
        for (const p of pegs.current) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, BOARD.pegRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        // ステージ＆ワープ（海物語の肝）。中央の隙間=ワープから落ちるとヘソ濃厚。
        const sLeft = BOARD.pocketX - BOARD.stageHalf;
        const sRight = BOARD.pocketX + BOARD.stageHalf;
        ctx.strokeStyle = "#36c0e0";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sLeft, BOARD.stageY);
        ctx.lineTo(BOARD.pocketX - BOARD.warpHalf, BOARD.stageY);
        ctx.moveTo(BOARD.pocketX + BOARD.warpHalf, BOARD.stageY);
        ctx.lineTo(sRight, BOARD.stageY);
        ctx.stroke();
        ctx.lineWidth = 1;
        // ワープ→ヘソの導線。
        ctx.strokeStyle = "rgba(54,192,224,.35)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(BOARD.pocketX, BOARD.stageY + 2);
        ctx.lineTo(BOARD.pocketX, BOARD.pocketY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 入賞口（ヘソ）。電サポ中は広がって光る。
        const half = BOARD.pocketW / 2 + (denchuRef.current ? BOARD.denchuBonusHalf : 0);
        ctx.fillStyle = denchuRef.current ? "rgba(255,207,51,.3)" : "rgba(124,92,255,.25)";
        ctx.fillRect(BOARD.pocketX - half, BOARD.pocketY, half * 2, BOARD.pocketH);
        ctx.strokeStyle = denchuRef.current ? "#ffcf33" : "#7c5cff";
        ctx.lineWidth = 2;
        ctx.strokeRect(BOARD.pocketX - half, BOARD.pocketY, half * 2, BOARD.pocketH);
        ctx.lineWidth = 1;
        ctx.fillStyle = denchuRef.current ? "#ffe9a3" : "#cdbcff";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ヘソ", BOARD.pocketX, BOARD.pocketY + 14);

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
          const ev = stepBall(b, pegs.current, BOARD, denchuRef.current);
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
