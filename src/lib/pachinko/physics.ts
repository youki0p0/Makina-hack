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
  /** ステージ滞留フレーム数（詰まり防止の強制排出に使う）。 */
  stageFrames?: number;
  /** ヘソ吸い込みアニメの進捗（0→1）。描画用。 */
  sinking?: number;
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
  // ヘソ直上の命釘2本（最後の関門）。間隔は玉が中央を通れるギリギリに絞り、
  // 中央でないズレた玉(=道釘ルート)はここで弾かれて入らない。ワープの中央落下だけが抜ける。
  const gate = board.ballRadius + board.pegRadius + 1.6; // ≒9.2
  pegs.push({ x: board.pocketX - gate, y: board.pocketY - 13 });
  pegs.push({ x: board.pocketX + gate, y: board.pocketY - 13 });
  // その外側に風車釘（散らし）。
  pegs.push({ x: board.pocketX - gate - 16, y: board.pocketY - 24 });
  pegs.push({ x: board.pocketX + gate + 16, y: board.pocketY - 24 });
  return pegs;
}

/** 1球を生成。左上打ち→レール(描画演出)で天へ→中央寄りに落下。 */
export function launchBall(board: BoardGeom = BOARD, rng: () => number = Math.random): Ball {
  const spread = 240; // 広めに散らし、中央のステージ/命釘へ集まる玉を絞る（≈20%入賞）
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

  // ===== ステージ＆ワープ（減衰振り子。中央でヌルッと吸い込むか、勢い余って前にこぼれる） =====
  if (ball.onStage) {
    ball.stageFrames = (ball.stageFrames ?? 0) + 1;
    ball.vx += -(ball.x - board.pocketX) * board.stageRestoreK; // 中央への弱い復元力
    ball.vx *= board.stageDamp; // 強めの減衰でゆっくり泳ぐ
    ball.x += ball.vx;
    ball.y = board.stageY;
    const centered = Math.abs(ball.x - board.pocketX) < board.warpHalf;
    if (centered && Math.abs(ball.vx) < board.warpVGate) {
      // 減速しきって中央通過＝ワープ吸い込み（ヘソ濃厚）。
      ball.onStage = false;
      ball.x = board.pocketX;
      ball.vx = 0;
      ball.vy = 1.3;
      ball.y = board.stageY + 10;
    } else if (
      ball.x < board.pocketX - board.stageHalf ||
      ball.x > board.pocketX + board.stageHalf
    ) {
      // 勢い余って端からこぼれる＝ほぼハズレ（惜しい）。
      ball.onStage = false;
      ball.vy = 0.5;
    } else if (ball.stageFrames > board.stageMaxFrames) {
      // 滞留しすぎ＝強制排出（詰まり防止）。
      ball.onStage = false;
      ball.vx = (ball.x < board.pocketX ? -1 : 1) * 0.6;
      ball.vy = 0.5;
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
    ball.stageFrames = 0;
    ball.y = board.stageY;
    ball.vy = 0;
    ball.vx *= 0.7; // 進入速度を残す（速いと泳いで前にこぼれ、遅いと中央へ）
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
