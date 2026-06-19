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
  height: 372,
  ballRadius: 5,
  pegRadius: 2.6,
  /** 1ステップあたりの重力加速。 */
  gravity: 0.16,
  /** 衝突時の反発係数。 */
  bounce: 0.5,
  /** 速度減衰。 */
  friction: 0.995,
  /** 発射口（左下のレール基点。描画演出用）。 */
  launchX: 10,
  launchY: 12,
  /**
   * 中央モニター（主役のセンター役物）。盤面の上半分を大きく占有し、ここに図柄
   * オーバーレイを重ねる。玉は天から落ちて“役物の裏”を通り、下のステージから出る
   * （実機の見え方）。盤面はこの周囲を囲む。
   */
  monitorX: 38,
  monitorY: 10,
  monitorW: 244,
  monitorH: 172,
  /** スタートチャッカー（中央下の入賞口=ヘソ。モニター直下）。 */
  pocketX: 160,
  pocketY: 300,
  pocketW: 50,
  pocketH: 20,
  /**
   * ステージ＆ワープ（海物語の肝）。モニター直下の舞台に玉が乗り、中央へ転がって
   * ワープから落ちるとヘソに吸い込まれやすい。
   */
  stageY: 244,
  /** ステージの左右半幅（pocketX ± stageHalf に乗る＝ワープ入口は狭い）。 */
  stageHalf: 16,
  /** 中央ワープの半幅（|x-pocketX| < warpHalf で吸い込み落下）。 */
  warpHalf: 12,
  /** 電サポ(確変/時短=Makina Mode)時に広がるヘソ実効半幅の加算。 */
  denchuBonusHalf: 18,
  /** 1発の消費玉。 */
  startCost: 1,
} as const;

export type BoardGeom = typeof BOARD;
