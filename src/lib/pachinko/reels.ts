// ===== 図柄変動ロジック（純粋関数） =====
// 入賞のたびに spinReels() を呼び、結果を決める。7以外でも3つ揃えば当たり。

import { getSymbol, GROUP_KINDS, type GroupKind, type PayoutTier } from "./symbols";

/** 確変=Complete Mode。当たり確率が上がる。 */
export type Mode = "normal" | "complete";

export interface ReelResult {
  /** 停止する3図柄の id。 */
  symbols: [number, number, number];
  win: boolean;
  /** 当たり図柄 id（ハズレ時 null）。 */
  symbolId: number | null;
  tier: PayoutTier | "miss";
  payout: number;
  durationMs: number;
  /** 2つ揃いで最後の1つ待ち（テンパイ）。 */
  reach: boolean;
  /** 群予告（なし時 null）。makina は激熱/当確。 */
  group: GroupKind | null;
  /** この当たりで確変に入る/継続する。 */
  enterComplete: boolean;
  jackpot: boolean;
  /** 昇格チェイン（例: [3,6] や [3,6,7]）。先頭が初期図柄。 */
  promotion: number[];
  /**
   * ===== 海物語式リーチ演出メタ（信頼度の階段）。数値が高い/SP/プレミアほど当たり濃厚。 =====
   */
  /** SU予告（ステップアップ予告）の到達ステップ 0..4。高いほど信頼度↑。 */
  su: number;
  /** リーチ種別: none（テンパイなし）/ normal（ノーマル）/ sp（SP発展＝激アツ）。 */
  reachKind: "none" | "normal" | "sp";
  /** SPリーチ名（reachKind==="sp" のときのみ）。 */
  spName: string | null;
  /** チャンスアップ回数 0..3（多いほど信頼度↑）。 */
  chanceUp: number;
  /** プレミア演出（激レア・ほぼ当確）。 */
  premium: boolean;
}

type Rng = () => number;

// 初当たりは希少に（当たりづらく＝高ボラ）。確変中は当たりやすく＝連チャンが続く
// （跳ねたら止まらない）。確変の継続は page.tsx 側の ST リセットで制御し、RTP を有限化。
const WIN_CHANCE: Record<Mode, number> = { normal: 1 / 66, complete: 0.28 };

// 当たり図柄の重み（id 1..7）。上位ほどレア。complete では上位寄り。
const WEIGHTS: Record<Mode, number[]> = {
  normal: [24, 22, 18, 12, 10, 9, 5],
  complete: [10, 12, 14, 18, 18, 16, 12],
};

function pick(weights: number[], rng: Rng): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i + 1; // ids are 1-based
  }
  return weights.length;
}

function distinctPair(winId: number, rng: Rng): [number, number] {
  // 2つの異なる（互いに、かつ winId とも異なる）図柄を選ぶ。
  const a = ((Math.floor(rng() * 6) + winId) % 7) + 1;
  let b = ((Math.floor(rng() * 6) + a) % 7) + 1;
  if (b === a) b = (b % 7) + 1;
  return [a, b];
}

/** 当たり/ハズレ・テンパイ・群予告・昇格まで含めて1変動を決定する。 */
export function spinReels(mode: Mode, rng: Rng = Math.random): ReelResult {
  const win = rng() < WIN_CHANCE[mode];

  if (!win) {
    // ハズレ。一定確率でテンパイ（2つ揃い）を作って煽る（リーチは希少に）。
    const reach = rng() < 0.13;
    let symbols: [number, number, number];
    if (reach) {
      // 海物語式テンパイ: 左右が揃い、中図柄は「トリガーの±1コマ（隣の図柄）」で
      // 惜しく外す（[左, 中, 右] = [t, t±1, t]）。
      const t = pick(WEIGHTS[mode], rng);
      const step = rng() < 0.5 ? 1 : 6; // +1コマ or -1コマ（mod 7）
      const last = ((t - 1 + step) % 7) + 1;
      symbols = [t, last, t];
    } else {
      const [a, b] = distinctPair(Math.floor(rng() * 7) + 1, rng);
      let c = ((Math.floor(rng() * 6) + b) % 7) + 1;
      if (c === a || c === b) c = (c % 7) + 1;
      symbols = [a, b, c];
    }
    // リーチ演出: ハズレリーチは SP に発展しても外す“SP外し”（信頼度は低め）。
    const reachKind: ReelResult["reachKind"] = reach
      ? rng() < 0.3
        ? "sp"
        : "normal"
      : "none";
    return {
      symbols,
      win: false,
      symbolId: null,
      tier: "miss",
      payout: 0,
      durationMs: reach ? 2600 : 900,
      reach,
      group: groupForMiss(reach, rng),
      enterComplete: false,
      jackpot: false,
      promotion: [],
      su: suFor(false, reach, rng),
      reachKind,
      spName: reachKind === "sp" ? spNameFor(symbols[0]) : null,
      chanceUp: reachKind === "sp" ? chanceUpFor(false, rng) : 0,
      premium: false, // プレミアは当確の世界観＝ハズレでは出さない
    };
  }

  // 当たり。図柄を選び、昇格を抽選。
  let id = pick(WEIGHTS[mode], rng);
  const promotion = [id];

  // 昇格演出: 333 → 666、まれに 666 → 777。
  if (id === 3 && rng() < 0.22) {
    id = 6;
    promotion.push(6);
    if (rng() < 0.06) {
      id = 7;
      promotion.push(7);
    }
  } else if (id === 6 && rng() < 0.05) {
    id = 7;
    promotion.push(7);
  }

  const sym = getSymbol(id);
  // 当たりのリーチ演出: big/JP はほぼ SP 発展。プレミアは激レア（7はやや出やすい）。
  const isBig = id >= 4;
  const reachKind: ReelResult["reachKind"] = isBig || rng() < 0.6 ? "sp" : "normal";
  const premium = id === 7 ? rng() < 0.12 : rng() < 0.01;
  return {
    symbols: [id, id, id],
    win: true,
    symbolId: id,
    tier: sym.tier,
    payout: sym.payout,
    durationMs: sym.durationMs,
    reach: true,
    group: groupForWin(id, rng),
    enterComplete: sym.enterComplete,
    jackpot: id === 7,
    promotion,
    su: suFor(true, true, rng),
    reachKind,
    spName: reachKind === "sp" ? spNameFor(id) : null,
    chanceUp: reachKind === "sp" ? chanceUpFor(true, rng) : 0,
    premium,
  };
}

// 信頼度ピラミッド: 弱(武器/ダイス/歯車群)→激熱(神機マキナ群)。
// 神機マキナ群はほぼ当たり時に出し、ハズレでは“ガセ魚群”として極まれに出す
// （出たら基本勝てる＝出た瞬間に叫べる。たまに泣く＝裏切りで興奮が増す）。
function lowGroup(rng: Rng): GroupKind {
  return GROUP_KINDS[Math.floor(rng() * 3)]; // makina 以外の3種
}

function groupForMiss(reach: boolean, rng: Rng): GroupKind | null {
  // ガセ激アツ（神機マキナ群がハズレで出る）はごく低確率。
  if (rng() < (reach ? 0.04 : 0.004)) return "makina";
  // 弱群はそこそこ出る（弱予告は裏切り前提）。
  if (rng() < (reach ? 0.32 : 0.07)) return lowGroup(rng);
  return null;
}

function groupForWin(id: number, rng: Rng): GroupKind | null {
  if (id === 7) return "makina"; // JP当確
  if (id >= 4) return rng() < 0.62 ? "makina" : lowGroup(rng); // big はほぼ激アツ
  if (id >= 2) return rng() < 0.18 ? "makina" : rng() < 0.55 ? lowGroup(rng) : null;
  return rng() < 0.4 ? lowGroup(rng) : null; // 最小当たりは弱め
}

// ===== 海物語式リーチ演出の信頼度カーブ（当たりほど強い演出が出やすい） =====

/** SU予告（ステップアップ予告）の到達ステップ。当たり=高ステップ寄り、ガセは低ステップ。 */
function suFor(win: boolean, reach: boolean, rng: Rng): number {
  if (win) {
    const r = rng();
    return r < 0.5 ? 4 : r < 0.8 ? 3 : 2; // 当たりは 2〜4（高ステップ濃厚）
  }
  if (reach) {
    const r = rng();
    return r < 0.1 ? 4 : r < 0.4 ? 3 : r < 0.8 ? 2 : 1; // リーチハズレは 1〜3（まれに4=ガセ）
  }
  const r = rng();
  return r < 0.75 ? 0 : r < 0.95 ? 1 : 2; // 非リーチは基本なし、たまに弱い煽り
}

/** SP中のチャンスアップ回数。当たりほど多い（多いほど信頼度↑）。 */
function chanceUpFor(win: boolean, rng: Rng): number {
  if (win) {
    const r = rng();
    return r < 0.4 ? 2 : r < 0.7 ? 3 : r < 0.9 ? 1 : 0;
  }
  const r = rng();
  return r < 0.5 ? 0 : r < 0.85 ? 1 : 2;
}

/** SPリーチ名（テンパイ図柄の固有武器/神機にちなむ）。 */
function spNameFor(id: number): string {
  if (id === 7) return "神機降臨SPリーチ";
  return `${getSymbol(id).name}SPリーチ`;
}
