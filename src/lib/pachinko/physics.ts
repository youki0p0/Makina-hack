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
  /** 打ち分けレーンを降下中か（"left"=通常時左打ち / "right"=当たり時右打ち）。 */
  lane?: "left" | "right";
  /** ステージ上を転がっている最中か。 */
  onStage?: boolean;
  /** 左打ちの寄せスロープを滑走中か（レーン出口→中央ステージ手前）。 */
  chute?: boolean;
  /** 個体差（0..1）。スロープ放出時の勢いに反映し、ステージ入賞/こぼれを散らす。 */
  wobble?: number;
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
 * ピン配置（実機準拠の海物語レイアウト）。
 * - 寄せ釘ランプ：左レーン出口から中央ステージへ玉を振り分ける下り斜め釘列。
 * - 道釘の散らし：中央寄りの千鳥でステージ手前の出目を作る。
 * - こぼし釘：ステージ脇（端から落ちた玉を外へ＝ハズレ動線）。
 * - 命釘＋風車：ヘソ直上の最後の関門。ワープの中央落下だけが抜ける。
 * 役物(モニター)の裏は釘を置かず、玉はレーンと直下のプレイ領域だけを通る。
 */
export function buildPegs(board: BoardGeom = BOARD): Peg[] {
  const pegs: Peg[] = [];
  // ① 寄せ釘ランプ：左レーン出口の真下(≈16,186) → 中央上(≈150,236) への下り斜め釘列。
  //    レーンを降りた玉(x≈21)がランプ上面に乗り、間隔を詰めた“壁”で中央ヘソ方向へ滑る。
  //    （実際の左→中央の送りはスロープ物理が担うので、釘はまばらな“飾り”。密にすると
  //    放出後に左へ戻った玉が乗って詰まるため、間隔を空ける。）
  {
    const x0 = 24, y0 = 190, x1 = 110, y1 = 210;
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pegs.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
    }
  }
  // ② 道釘の散らし（中央を覆う千鳥2列。スロープ放出後の玉を散らし、命釘で絞る）。
  //    放出点(≈138,206)の真下は空けて“かご詰まり”を防ぐ。
  for (let r = 0; r < 2; r++) {
    const y = 222 + r * 16;
    const offset = r % 2 === 0 ? 0 : 16;
    for (let x = 86 + offset; x < 256; x += 32) {
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
  const gate = board.ballRadius + board.pegRadius + 0.0; // ≒7.6（玉が中央を通れるギリギリ）
  // 左右を上下にずらして対称な“挟み込み詰まり”を防ぐ（片方を先に当てて弾く）。
  pegs.push({ x: board.pocketX - gate, y: board.pocketY - 13 });
  pegs.push({ x: board.pocketX + gate, y: board.pocketY - 20 });
  // その外側に風車釘（散らし）。
  pegs.push({ x: board.pocketX - gate - 16, y: board.pocketY - 24 });
  pegs.push({ x: board.pocketX + gate + 16, y: board.pocketY - 24 });
  return pegs;
}

/**
 * 1球を生成。`migiUchi`=false（通常時=左打ち）は左の細い縦レーン上端から、
 * true（当たり時=右打ち）は右の細い縦レーン上端から発射。いずれもモニター裏は通らない。
 * rng は決定的テスト用に差し替え可能（第2引数で互換）。
 */
export function launchBall(
  board: BoardGeom = BOARD,
  rng: () => number = Math.random,
  migiUchi = false,
): Ball {
  const laneX = migiUchi ? board.rightLaneX : board.leftLaneX;
  return {
    x: laneX + (rng() - 0.5) * 4,
    y: board.launchY,
    vx: 0,
    vy: 0.5 + rng() * 0.3,
    active: true,
    onStage: false,
    lane: migiUchi ? "right" : "left",
    wobble: rng(),
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

  // ===== 打ち分けレーン（細い縦樋を降下。モニター裏は通らない） =====
  if (ball.lane) {
    const laneX = ball.lane === "left" ? board.leftLaneX : board.rightLaneX;
    ball.vy += board.gravity;
    ball.vx *= board.friction;
    ball.y += ball.vy;
    ball.x += ball.vx;
    // レーン壁で反射（樋を流れる）。
    const innerL = laneX - board.laneHalf + r;
    const innerR = laneX + board.laneHalf - r;
    if (ball.x < innerL) {
      ball.x = innerL;
      ball.vx = Math.abs(ball.vx) * 0.4 + 0.05;
    } else if (ball.x > innerR) {
      ball.x = innerR;
      ball.vx = -Math.abs(ball.vx) * 0.4 - 0.05;
    }
    if (ball.lane === "left") {
      if (ball.y >= board.laneExitY) {
        // レーン出口：寄せスロープに乗せる（寄せ釘ランプ沿いに中央へ滑走）。
        ball.lane = undefined;
        ball.chute = true;
        ball.x = board.chuteX0;
        ball.vx = 0.5;
      }
      return null;
    }
    // 右打ち：右下の大入賞口(アタッカー)へ吸い込む＝当たり中の出玉演出。
    if (ball.y >= board.attackerY) {
      ball.active = false;
      return "fall"; // ヘソではないので変動はしない（Makina はタイマー駆動）
    }
    return null;
  }

  // ===== 左打ちの寄せスロープ（傾斜を下り加速し、末端で中央ステージ手前へ放出） =====
  if (ball.chute) {
    ball.vx += board.chuteAccel; // 下り（右）加速
    ball.vx *= 0.99;
    ball.x += ball.vx;
    const t = (ball.x - board.chuteX0) / (board.chuteX1 - board.chuteX0);
    ball.y = board.chuteY0 + (board.chuteY1 - board.chuteY0) * Math.max(0, Math.min(1, t));
    if (ball.x >= board.chuteX1) {
      // 放出：個体差で左右へ散らす。道釘→命釘で絞られ、中央のステージ/ワープに
      // 乗れた玉だけがヘソ濃厚（多くは弾かれてハズレ）。
      ball.chute = false;
      ball.vx = 0.7 + 1.8 * (ball.wobble ?? 0.5); // 必ず右へ散らす（左の飾り釘へ戻さない）
      ball.vy = 0.5;
    }
    return null;
  }

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
