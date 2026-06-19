// ===== 軽量物理（純粋関数 / Matter.js 不使用） =====
// 玉は天(上部)から落ち、大きなセンター役物(モニター)の裏を通って、その直下の
// ステージ＆ワープへ。中央ワープに乗るとヘソ(入賞口)へ吸い込み濃厚＝海物語の肝。
// 役物の周りを盤面の釘が囲む。スマホ最優先で円-円反射のみの簡易物理。

import { BOARD, type BoardGeom } from "./config";

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  /** ステージ上を転がっている最中か。 */
  onStage?: boolean;
}

export interface Peg {
  x: number;
  y: number;
}

/** 入賞か落下か。null は継続中。 */
export type BallEvent = "pocket" | "fall" | null;

/**
 * ピン配置。役物直下〜ヘソの「見えるプレイ領域」に道釘の千鳥格子、ステージ脇の
 * こぼし釘、ヘソ直上の風車釘を置く。役物の上(天)は空けて玉を落とす。
 */
export function buildPegs(board: BoardGeom = BOARD): Peg[] {
  const pegs: Peg[] = [];
  const monBottom = board.monitorY + board.monitorH;
  // 道釘（役物直下からステージ手前まで）。
  const top = monBottom + 8;
  const bottom = board.stageY - 16;
  const rows = 3;
  const rowGap = (bottom - top) / (rows - 1);
  const colGap = 30;
  for (let r = 0; r < rows; r++) {
    const y = top + r * rowGap;
    const offset = r % 2 === 0 ? 0 : colGap / 2;
    for (let x = 24 + offset; x < board.width - 18; x += colGap) {
      const jitter = (((r * 7 + x) % 5) - 2) * 0.8;
      pegs.push({ x: x + jitter, y });
    }
  }
  // ステージ両脇のこぼし釘（端から落ちた玉を外へ＝ハズレ動線）。
  pegs.push({ x: board.pocketX - board.stageHalf - 18, y: board.stageY + 18 });
  pegs.push({ x: board.pocketX + board.stageHalf + 18, y: board.stageY + 18 });
  pegs.push({ x: board.pocketX - board.stageHalf - 34, y: board.stageY + 40 });
  pegs.push({ x: board.pocketX + board.stageHalf + 34, y: board.stageY + 40 });
  // ヘソ直上の風車釘（最後の関門・少し広め＝直撃は渋い）。
  pegs.push({ x: board.pocketX - board.pocketW / 2 - 9, y: board.pocketY - 12 });
  pegs.push({ x: board.pocketX + board.pocketW / 2 + 9, y: board.pocketY - 12 });
  return pegs;
}

/** 1球を生成。左上打ち→レール(描画演出)で天へ→中央寄りに落下。 */
export function launchBall(board: BoardGeom = BOARD, rng: () => number = Math.random): Ball {
  const spread = 150;
  const dropX = board.pocketX - 6 + (rng() - 0.5) * spread;
  return {
    x: Math.max(14, Math.min(board.width - 14, dropX)),
    y: board.launchY,
    vx: (rng() - 0.5) * 0.9,
    vy: 0.4 + rng() * 0.3,
    active: true,
    onStage: false,
  };
}

/**
 * 1ステップ進める。`denchu`=true（電サポ/Makina Mode）でヘソ実効幅が広がる。
 * 戻り値が non-null のとき ball.active は false。
 */
export function stepBall(
  ball: Ball,
  pegs: Peg[],
  board: BoardGeom = BOARD,
  denchu = false,
): BallEvent {
  const r = board.ballRadius;
  const pr = board.pegRadius;

  // ===== ステージ＆ワープ =====
  if (ball.onStage) {
    const dir = ball.x < board.pocketX ? 1 : -1;
    ball.vx += dir * 0.07;
    ball.vx *= 0.95;
    ball.x += ball.vx;
    ball.y = board.stageY;
    if (Math.abs(ball.x - board.pocketX) < board.warpHalf) {
      ball.onStage = false;
      ball.x = board.pocketX;
      ball.vx = 0;
      ball.vy = 1.3;
      ball.y = board.stageY + 10;
    } else if (
      ball.x < board.pocketX - board.stageHalf ||
      ball.x > board.pocketX + board.stageHalf
    ) {
      ball.onStage = false;
      ball.vy = 0.4;
    }
    return null;
  }

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

  // ステージへの着地（上から落ちて中央帯に入ったら乗る）。
  if (
    ball.vy > 0 &&
    ball.y >= board.stageY &&
    ball.y <= board.stageY + 7 &&
    ball.x >= board.pocketX - board.stageHalf &&
    ball.x <= board.pocketX + board.stageHalf
  ) {
    ball.onStage = true;
    ball.y = board.stageY;
    ball.vy = 0;
    ball.vx *= 0.5;
    return null;
  }

  // ピン衝突（円-円）。最初に当たった1本だけ解決。
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
      // 真上に乗ってバランスするのを防ぐため必ず左右へ蹴り出す。
      const sign = nx >= 0 ? 1 : -1;
      ball.vx += nx * 0.3 + sign * 0.25;
      break;
    }
  }

  // 入賞口（電サポ時は実効幅が広がる）。
  const half = board.pocketW / 2 + (denchu ? board.denchuBonusHalf : 0);
  if (ball.y >= board.pocketY) {
    if (ball.x >= board.pocketX - half && ball.x <= board.pocketX + half) {
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
