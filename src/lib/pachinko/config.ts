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
 * スマホ縦画面前提なので縦長。
 */
export const BOARD = {
  width: 320,
  height: 440,
  ballRadius: 5,
  pegRadius: 2.6,
  /** 1ステップあたりの重力加速。 */
  gravity: 0.16,
  /** 衝突時の反発係数。 */
  bounce: 0.52,
  /** 速度減衰。 */
  friction: 0.995,
  /** 発射口（左上）。 */
  launchX: 22,
  launchY: 16,
  /** 発射初速（右下方向へ）。 */
  launchVX: 1.7,
  launchVY: 0.6,
  /** 発射初速のばらつき。 */
  launchJitter: 0.5,
  /** スタートチャッカー（中央下の入賞口）。 */
  pocketX: 160,
  pocketY: 398,
  pocketW: 54,
  pocketH: 26,
  /** 1発の消費玉。 */
  startCost: 1,
} as const;

export type BoardGeom = typeof BOARD;
