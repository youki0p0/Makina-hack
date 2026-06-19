// ===== 軽量物理（純粋関数 / Matter.js 不使用） =====
// 左上打ちした玉が釘を流れて中央下の入賞口(ヘソ)に入るかどうかが本質。
// 中央の大きなモニターは描画側のオーバーレイ。盤面はその直下の“帯”。
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

/**
 * ピン配置。千鳥格子で全体を流しつつ、ヘソ直上に「風車」釘を置いて中央へ寄せる。
 * 多くの玉は脇から零れて流れ、たまにヘソへ入る＝入賞のドキドキ。
 */
export function buildPegs(board: BoardGeom = BOARD): Peg[] {
  const pegs: Peg[] = [];
  const rows = 7;
  const top = 44;
  const bottom = board.pocketY - 30;
  const rowGap = (bottom - top) / (rows - 1);
  const colGap = 30;
  for (let r = 0; r < rows; r++) {
    const y = top + r * rowGap;
    const offset = r % 2 === 0 ? 0 : colGap / 2;
    for (let x = 20 + offset; x < board.width - 16; x += colGap) {
      const jitter = (((r * 7 + x) % 5) - 2) * 0.8;
      pegs.push({ x: x + jitter, y });
    }
  }
  // ヘソ直上の風車釘（最後の関門）。入口幅 = ヘソ幅。ここで多くが弾かれてハズレ、
  // たまにスッと入る＝入賞のドキドキ。
  pegs.push({ x: board.pocketX - board.pocketW / 2, y: board.pocketY - 12 });
  pegs.push({ x: board.pocketX + board.pocketW / 2, y: board.pocketY - 12 });
  return pegs;
}

/**
 * 1球を生成。左上打ちした玉はレール（描画演出）で盤面上部「天」へ運ばれ、そこから
 * 落下する。物理ドロップ位置は上部・中央寄り（打ち加減のブレを jitter で表現）。
 */
export function launchBall(board: BoardGeom = BOARD, rng: () => number = Math.random): Ball {
  const spread = 116;
  const dropX = board.pocketX - 8 + (rng() - 0.5) * spread;
  return {
    x: Math.max(14, Math.min(board.width - 14, dropX)),
    y: board.launchY,
    vx: (rng() - 0.5) * 0.8,
    vy: 0.4 + rng() * 0.3,
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
      ball.x = pegs[i].x + nx * minDist;
      ball.y = pegs[i].y + ny * minDist;
      const vDotN = ball.vx * nx + ball.vy * ny;
      ball.vx = (ball.vx - 2 * vDotN * nx) * board.bounce;
      ball.vy = (ball.vy - 2 * vDotN * ny) * board.bounce;
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
