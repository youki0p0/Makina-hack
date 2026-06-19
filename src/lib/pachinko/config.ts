// ===== パチンコ「奈落海 / Abyss Marine」 設定 =====
// 演出特化のゲーム内パチンコ。本物の賭博ではなく「気持ちよさ」の再現が目的。

/** 演出・パフォーマンスの上限値（仕様書準拠）。 */
export const PACHINKO_CONFIG = {
  /** 盤面を実際に転がる物理玉の最大数。 */
  maxPhysicsBalls: 50,
  /** 通常当たりの払い出し粒子（見た目用）最大数。 */
  maxPayoutParticles: 600,
  /** Jackpot 時の払い出し粒子最大数。 */
  jackpotMaxPayoutParticles: 800,
  /** 1フレームで放出する払い出し粒子数。 */
  payoutParticlesPerFrame: 12,
  /** 1フレームで増やす玉カウンタ量。 */
  counterIncrementPerFrame: 24,
  /** オート発射の間隔(ms)。 */
  launchIntervalMs: 250,
} as const;

/**
 * 盤面ジオメトリ（基準座標。Canvas へ等比スケールして描画）。
 * 本質は「中央モニターを見ながら、左上打ちした玉がモニター直下の入賞口に入るか」。
 * モニターは画面上で大きく主役にし、盤面はその直下の“帯”（横長）にする。
 * 入賞口(ヘソ)は中央＝モニター直下なので、視線はモニターに置いたまま入賞を見られる。
 */
export const BOARD = {
  width: 320,
  height: 240,
  ballRadius: 5,
  pegRadius: 2.6,
  /** 1ステップあたりの重力加速。 */
  gravity: 0.16,
  /** 衝突時の反発係数。 */
  bounce: 0.5,
  /** 速度減衰。 */
  friction: 0.995,
  /** 発射口（左上＝左上打ち）。 */
  launchX: 20,
  launchY: 12,
  /** 発射初速（右下へ流す＝左上打ち）。 */
  launchVX: 1.8,
  launchVY: 0.5,
  /** 発射初速のばらつき（打ち加減のブレ）。 */
  launchJitter: 0.6,
  /** スタートチャッカー（中央下の入賞口=ヘソ。モニター直下）。 */
  pocketX: 160,
  pocketY: 206,
  pocketW: 50,
  pocketH: 20,
  /** 1発の消費玉。 */
  startCost: 1,
} as const;

export type BoardGeom = typeof BOARD;
