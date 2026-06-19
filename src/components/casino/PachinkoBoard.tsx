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

/** 角丸矩形パス（文字ラベルの代わりに“いい感じの役物”を描くため）。 */
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 4方向のきらめき星（入賞口の中心アクセント）。 */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, r: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - 0.28) * r * 0.4, y + Math.sin(a - 0.28) * r * 0.4);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a + 0.28) * r * 0.4, y + Math.sin(a + 0.28) * r * 0.4);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * 盤面 Canvas。物理玉（最大 maxPhysicsBalls）を requestAnimationFrame で更新し、
 * 入賞口に入ったら onPocket を呼ぶ。object pool で球を再利用。非表示時は停止。
 */
const PachinkoBoard = forwardRef<
  PachinkoBoardHandle,
  { onPocket: () => void; onAttacker?: () => void; reduced?: boolean; denchu?: boolean }
>(function PachinkoBoard({ onPocket, onAttacker, reduced = false, denchu = false }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const balls = useRef<Ball[]>([]);
    const pegs = useRef<Peg[]>([]);
    const raf = useRef<number | null>(null);
    const visible = useRef(true);
    const onPocketRef = useRef(onPocket);
    onPocketRef.current = onPocket;
    const onAttackerRef = useRef(onAttacker);
    onAttackerRef.current = onAttacker;
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

        // 右下の大入賞口（アタッカー）＝開閉シャッター。右打ち中だけ金色に開いて光る（文字なし）。
        {
          const ax = BOARD.attackerX - BOARD.attackerW / 2;
          const ay = BOARD.attackerY;
          const aw = BOARD.attackerW;
          const ah = BOARD.attackerH;
          const ag = ctx.createLinearGradient(0, ay, 0, ay + ah);
          if (migi) {
            ag.addColorStop(0, "#fff0b8");
            ag.addColorStop(1, "#cf8418");
          } else {
            ag.addColorStop(0, "#2b3650");
            ag.addColorStop(1, "#151d2e");
          }
          ctx.fillStyle = ag;
          rrect(ctx, ax, ay, aw, ah, 3);
          ctx.fill();
          // 開いたシャッターの横スリット。
          ctx.strokeStyle = migi ? "rgba(120,70,0,.45)" : "rgba(255,255,255,.06)";
          for (let yy = ay + 4; yy < ay + ah - 1; yy += 4) {
            ctx.beginPath();
            ctx.moveTo(ax + 2, yy);
            ctx.lineTo(ax + aw - 2, yy);
            ctx.stroke();
          }
          // ふち（開放時はグロー）。
          if (migi) {
            ctx.save();
            ctx.shadowColor = "#ffcf33";
            ctx.shadowBlur = 12;
          }
          ctx.strokeStyle = migi ? "#ffcf33" : "#46566f";
          ctx.lineWidth = 2;
          rrect(ctx, ax, ay, aw, ah, 3);
          ctx.stroke();
          if (migi) ctx.restore();
          ctx.lineWidth = 1;
        }

        // 右打ち誘導は文字でなくシェブロン（▸）で示す（当たり中のみ）。
        if (migi) {
          ctx.fillStyle = "#ffcf33";
          for (let c = 0; c < 3; c++) {
            const cy = mY + 24 + c * 11;
            const cx = BOARD.rightLaneX - 12;
            ctx.beginPath();
            ctx.moveTo(cx - 4, cy - 4);
            ctx.lineTo(cx + 4, cy);
            ctx.lineTo(cx - 4, cy + 4);
            ctx.closePath();
            ctx.fill();
          }
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

        // 入賞口（ヘソ）＝光る吸い込み口。電サポ中は広がって金色に光る（文字なし）。
        {
          const hot = denchuRef.current;
          const half = BOARD.pocketW / 2 + (hot ? BOARD.denchuBonusHalf : 0);
          const px = BOARD.pocketX;
          const py = BOARD.pocketY;
          const ph = BOARD.pocketH;
          const cyc = py + ph / 2;
          // 放射グロー。
          const rg = ctx.createRadialGradient(px, cyc, 1, px, cyc, half + 9);
          rg.addColorStop(0, hot ? "rgba(255,207,51,.55)" : "rgba(124,92,255,.5)");
          rg.addColorStop(1, hot ? "rgba(255,207,51,0)" : "rgba(124,92,255,0)");
          ctx.fillStyle = rg;
          ctx.fillRect(px - half - 9, py - 7, (half + 9) * 2, ph + 16);
          // 吸い込み口（口が下に向かってすぼまる台形）。
          const topHalf = half;
          const botHalf = Math.max(4, half * 0.5);
          ctx.beginPath();
          ctx.moveTo(px - topHalf, py);
          ctx.lineTo(px + topHalf, py);
          ctx.lineTo(px + botHalf, py + ph);
          ctx.lineTo(px - botHalf, py + ph);
          ctx.closePath();
          const pg = ctx.createLinearGradient(0, py, 0, py + ph);
          pg.addColorStop(0, hot ? "rgba(255,207,51,.5)" : "rgba(124,92,255,.45)");
          pg.addColorStop(1, "rgba(0,0,0,.55)");
          ctx.fillStyle = pg;
          ctx.fill();
          ctx.strokeStyle = hot ? "#ffcf33" : "#7c5cff";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.lineWidth = 1;
          // 入口の左右ふち（受け皿）。
          ctx.strokeStyle = hot ? "#ffe9a3" : "#cdbcff";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(px - topHalf - 3, py - 1);
          ctx.lineTo(px - topHalf, py + 1);
          ctx.moveTo(px + topHalf + 3, py - 1);
          ctx.lineTo(px + topHalf, py + 1);
          ctx.stroke();
          ctx.lineWidth = 1;
          // 中心のきらめき。
          sparkle(ctx, px, cyc, hot ? "#fff6cf" : "#e7dcff", 3.4);
        }

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
          } else if (ev === "attacker") {
            onAttackerRef.current?.(); // 大入賞口入賞＝出玉(当たり中)
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
