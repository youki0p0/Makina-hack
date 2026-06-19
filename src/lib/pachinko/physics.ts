// ===== 軽量物理（純粋関数 / Matter.js 不使用） =====
// 球は左上から発射→重力でピンに当たりながら落下→中央下の入賞口 or ハズレ穴。
// スマホで動くことを最優先に、円-円反射のみの簡易物理。

import { BOARD, type BoardGeom } from "./config";

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

export interface Peg {
  x: number;
  y: number;
}

/** 入賞か落下か。null は継続中。 */
export type BallEvent = "pocket" | "fall" | null;

/** 盤面のピン配置を決定的に生成（千鳥格子＋わずかなジッタ）。 */
export function buildPegs(board: BoardGeom = BOARD): Peg[] {
  const pegs: Peg[] = [];
  const rows = 9;
  const top = 70;
  const bottom = board.pocketY - 36;
  const rowGap = (bottom - top) / (rows - 1);
  const colGap = 30;
  for (let r = 0; r < rows; r++) {
    const y = top + r * rowGap;
    const offset = r % 2 === 0 ? 0 : colGap / 2;
    for (let x = 20 + offset; x < board.width - 16; x += colGap) {
      // 決定的な微小ジッタ（行列から算出）で単調さを消す。
      const jitter = (((r * 7 + x) % 5) - 2) * 0.8;
      pegs.push({ x: x + jitter, y });
    }
  }
  // 入賞口の左右に「振り分け」ピンを置き、中央へ寄せる。
  pegs.push({ x: board.pocketX - board.pocketW, y: board.pocketY - 22 });
  pegs.push({ x: board.pocketX + board.pocketW, y: board.pocketY - 22 });
  return pegs;
}

/** 左上の発射口から1球を生成。 */
export function launchBall(board: BoardGeom = BOARD, rng: () => number = Math.random): Ball {
  return {
    x: board.launchX,
    y: board.launchY,
    vx: board.launchVX + (rng() - 0.5) * board.launchJitter,
    vy: board.launchVY + rng() * board.launchJitter,
    active: true,
  };
}

/**
 * 1ステップ進める。球の状態を破壊的に更新し、盤外/入賞でイベントを返す。
 * 戻り値が non-null のとき ball.active は false になる。
 */
export function stepBall(ball: Ball, pegs: Peg[], board: BoardGeom = BOARD): BallEvent {
  const r = board.ballRadius;
  const pr = board.pegRadius;

  ball.vy += board.gravity;
  ball.vx *= board.friction;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // 左右の壁で反射。
  if (ball.x < r) {
    ball.x = r;
    ball.vx = Math.abs(ball.vx) * board.bounce;
  } else if (ball.x > board.width - r) {
    ball.x = board.width - r;
    ball.vx = -Math.abs(ball.vx) * board.bounce;
  }

  // ピン衝突（円-円）。最初に当たった1本だけ解決すれば十分軽い。
  const minDist = r + pr;
  for (let i = 0; i < pegs.length; i++) {
    const dx = ball.x - pegs[i].x;
    const dy = ball.y - pegs[i].y;
    const d2 = dx * dx + dy * dy;
    if (d2 < minDist * minDist) {
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d;
      const ny = dy / d;
      // めり込み解消。
      ball.x = pegs[i].x + nx * minDist;
      ball.y = pegs[i].y + ny * minDist;
      // 法線方向の速度を反射。
      const vDotN = ball.vx * nx + ball.vy * ny;
      ball.vx = (ball.vx - 2 * vDotN * nx) * board.bounce;
      ball.vy = (ball.vy - 2 * vDotN * ny) * board.bounce;
      // 横方向に少しランダム性（決定的ジッタ）。
      ball.vx += nx * 0.3;
      break;
    }
  }

  // 入賞口の高さに達したか。
  if (ball.y >= board.pocketY) {
    const inPocket =
      ball.x >= board.pocketX - board.pocketW / 2 &&
      ball.x <= board.pocketX + board.pocketW / 2;
    if (inPocket) {
      ball.active = false;
      return "pocket";
    }
  }

  // 盤外（下）へ落下。
  if (ball.y >= board.height + r) {
    ball.active = false;
    return "fall";
  }
  return null;
}
