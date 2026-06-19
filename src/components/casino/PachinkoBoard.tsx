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
        // 通常時=左打ち / 当たり時(電サポ=Makina Mode)=右打ち。
        const fresh = launchBall(BOARD, Math.random, denchuRef.current);
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

        // ===== 打ち分けレーン（左=通常時 / 右=当たり時）。役物の左右外側の細い縦樋。 =====
        const migi = denchuRef.current;
        const drawLane = (cx: number, top: number, bot: number, hot: boolean) => {
          ctx.strokeStyle = hot ? "rgba(255,207,51,.85)" : "rgba(120,170,200,.4)";
          ctx.lineWidth = hot ? 2 : 1.5;
          for (const dx of [-BOARD.laneHalf, BOARD.laneHalf]) {
            ctx.beginPath();
            ctx.moveTo(cx + dx, top);
            ctx.lineTo(cx + dx, bot);
            ctx.stroke();
          }
          ctx.lineWidth = 1;
        };
        // 左打ちレーン（モニター下端まで降りて盤面へ）。
        drawLane(BOARD.leftLaneX, BOARD.launchY, BOARD.laneExitY, !migi);
        // 右打ちレーン（大入賞口アタッカーまで）。
        drawLane(BOARD.rightLaneX, BOARD.launchY, BOARD.attackerY, migi);

        // 右下の大入賞口（アタッカー）。右打ち中だけ開いて光る演出。
        ctx.fillStyle = migi ? "rgba(255,207,51,.3)" : "rgba(124,92,255,.12)";
        ctx.strokeStyle = migi ? "#ffcf33" : "#5b6b8a";
        ctx.lineWidth = 2;
        ctx.fillRect(BOARD.attackerX - BOARD.attackerW / 2, BOARD.attackerY, BOARD.attackerW, BOARD.attackerH);
        ctx.strokeRect(BOARD.attackerX - BOARD.attackerW / 2, BOARD.attackerY, BOARD.attackerW, BOARD.attackerH);
        ctx.lineWidth = 1;
        ctx.fillStyle = migi ? "#ffe9a3" : "#8a96b5";
        ctx.font = "8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("大入賞", BOARD.attackerX, BOARD.attackerY + 12);

        // 「右打ち→」表示（当たり中のみ）。
        if (migi) {
          ctx.fillStyle = "#ffcf33";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "right";
          ctx.fillText("右打ち→", BOARD.rightLaneX - 4, mY + 40);
        }

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

        // 球（稼働中＝白丸、入賞後＝ヘソへ吸い込まれて縮む“間”）。
        for (const b of balls.current) {
          if (b.active) {
            ctx.fillStyle = b.onStage ? "#ffe9a3" : "#f4f7ff";
            ctx.beginPath();
            ctx.arc(b.x, b.y, BOARD.ballRadius, 0, Math.PI * 2);
            ctx.fill();
          } else if (b.sinking !== undefined && b.sinking < 1) {
            const r = BOARD.ballRadius * (1 - b.sinking);
            ctx.fillStyle = `rgba(255,233,163,${1 - b.sinking})`;
            ctx.beginPath();
            ctx.arc(BOARD.pocketX, BOARD.pocketY, Math.max(0.5, r), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      };

      const frame = () => {
        raf.current = requestAnimationFrame(frame);
        if (!visible.current) return;
        for (const b of balls.current) {
          if (!b.active) {
            // 入賞済みの吸い込みアニメを進める。
            if (b.sinking !== undefined && b.sinking < 1) b.sinking += 0.12;
            continue;
          }
          const ev = stepBall(b, pegs.current, BOARD, denchuRef.current);
          if (ev === "pocket") {
            b.sinking = 0; // ヘソへ吸い込まれる“間”を描く
            onPocketRef.current();
          }
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
