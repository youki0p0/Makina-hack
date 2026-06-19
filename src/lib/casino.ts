import { ITEMS } from "@/data/items";
import { rollDice } from "@/lib/dice";
import type { DiceValue, Equipment } from "@/types/game";

// ===== prizes =====

const CASINO_PRIZES = ITEMS.filter((i) => i.casinoOnly);

export function randomCasinoPrize(): Equipment {
  const pick = CASINO_PRIZES[Math.floor(Math.random() * CASINO_PRIZES.length)];
  return { ...pick };
}

// ===== 9-symbol dice slot (パチスロ4号機フレーバー) =====
// 出目は 1〜9。内部抽選で結果を先に決め、リールはそれに合わせて止める（実機準拠）。
// コイン(メダル)で回し、リプレイ・ベル等の小役、レギュラー/ビッグの当たり、
// 約3秒のリーチ演出(信頼度差つき10種)を備える。

/** Coin (medal) economy: cash OUT rate (1 coin → this many gold). */
export const COIN_VALUE = 20;
/** Coins consumed per spin (3枚掛け). */
export const SLOT_BET = 3;

/** How many held coins doubles the buy price (買いづらさのスケール). */
export const COIN_BUY_SCALE = 200;

/**
 * Gold cost to BUY `amount` coins. Deliberately gets pricier the more coins you
 * already hold, so you can't cheaply stockpile — slotで稼ぐのが本筋(買いづらく)。
 * 単価 = COIN_VALUE × (1 + 所持コイン / COIN_BUY_SCALE)。
 */
export function coinBuyCost(amount: number, held: number): number {
  const mult = 1 + Math.max(0, held) / COIN_BUY_SCALE;
  return Math.ceil(Math.max(0, amount) * COIN_VALUE * mult);
}

/** Max coins buyable for `gold`, at the current (held-scaled) price. */
export function coinBuyMax(gold: number, held: number): number {
  const unit = COIN_VALUE * (1 + Math.max(0, held) / COIN_BUY_SCALE);
  let amt = Math.floor(Math.max(0, gold) / unit);
  while (amt > 0 && coinBuyCost(amt, held) > gold) amt--; // guard ceil rounding
  return Math.max(0, amt);
}

export type SlotOutcome =
  | "big" // ビッグボーナス(7・7・7) → ダイスラッシュ突入
  | "reg" // レギュラーボーナス
  | "replay" // リプレイ(次回無料)
  | "watermelon" // スイカ
  | "cherry" // チェリー
  | "bell" // ベル
  | "at" // ダイスラッシュ(AT)中の無料ゲーム
  | "miss"; // ハズレ

/** Which die face (1–9) represents each role on the reels. */
export const SLOT_SYMBOL: Record<string, number> = {
  seven: 7, // BIG
  bar: 4, // REGULAR
  replay: 1,
  bell: 2,
  melon: 5,
  cherry: 9,
};

// Per-spin odds tuned to a 4号機 feel (big≈1/240, reg≈1/360, replay≈1/7.3,
// bell≈1/6 …). The remainder is a miss. `bonusMult` boosts BIG/REG odds — used by
// 設定差 (machine setting) and 連チャンゾーン (post-AT high-prob), both deliberately
// addictive 4号機-era mechanics.
/** Global luck factor on BIG/REG base odds (≈1.3× easier to hit). */
export const SLOT_LUCK = 1.3;

export function drawSlotOutcome(bonusMult = 1): SlotOutcome {
  const big = Math.min(0.45, (SLOT_LUCK / 240) * bonusMult);
  const reg = Math.min(0.45, (SLOT_LUCK / 360) * bonusMult);
  const odds: { outcome: SlotOutcome; p: number }[] = [
    { outcome: "big", p: big },
    { outcome: "reg", p: reg },
    { outcome: "watermelon", p: 1 / 128 },
    { outcome: "cherry", p: 1 / 51 },
    { outcome: "replay", p: 1 / 7.3 },
    { outcome: "bell", p: 1 / 6 },
  ];
  const r = Math.random();
  let acc = 0;
  for (const o of odds) {
    acc += o.p;
    if (r < acc) return o.outcome;
  }
  return "miss";
}

// ===== 設定差・台・天井・連チャンゾーン (4号機の"中毒"システム) =====
// 現代の規則で禁止/規制された射幸性の高い仕組みを再現:
//  - 設定差: 台ごとに隠し設定(1-6)で機械割が変わる(設定看破の沼)。
//  - 天井: ハマるほど近づく救済 → 天井狙いの中毒。
//  - 連チャンゾーン: AT後の高確率で連チャン(ストック機的な出玉の波)。
//  - 青天井AT: 出玉上限なし(コンプリート機能なし)。
export const MACHINE_COUNT = 4;
export const SHUFFLE_MS = 6 * 60 * 60 * 1000; // 設定は6時間ごとにシャッフル

/** Current 6-hour bucket (machine settings reshuffle each bucket). */
export function settingBucket(now = Date.now()): number {
  return Math.floor(now / SHUFFLE_MS);
}

/** Deterministic hidden settings (1–6) for the 4 machines, per time bucket. */
export function machineSettings(bucket: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < MACHINE_COUNT; i++) {
    const h = Math.abs(Math.sin((bucket + 1) * 12.9898 + (i + 1) * 78.233) * 43758.5453);
    out.push(1 + Math.floor((h % 1) * 6)); // 1..6
  }
  return out;
}

/** Bonus-odds multiplier for a setting (higher setting ⇒ better machine割). */
export function settingMult(setting: number): number {
  return 0.8 + Math.max(1, Math.min(6, setting)) * 0.08; // 1→0.88 … 6→1.28
}

/** 天井: a BIG is forced after this many spins without one (lower at high設定). */
export function ceilingSpins(setting: number): number {
  return 900 - Math.max(1, Math.min(6, setting)) * 60; // 1→840 … 6→540
}

/** 連チャンゾーン: length and BIG/REG odds boost right after an AT ends.
 * 連チャン率は控えめに(倍率・長さを下げた)。 */
export const ZONE_SPINS = 24;
export const ZONE_MULT = 3;

/** Rolling window for the "直近の当たり回数" data counter. */
export const HIT_WINDOW_MS = 4 * 60 * 60 * 1000; // 4時間

/** 台パン: how many hits before being thrown out + banned. */
export const DAIPAN_LIMIT = 10;
/** 出禁: bosses you must defeat to be allowed back into the casino. */
export const BAN_BOSSES = 10;

// ===== カジノコイン交換所 =====
// 超高額のカジノコインで強力なセット武器・転生ポイントと交換できる(射幸性の出口)。
/** Coins to exchange for one set-piece weapon. */
export const SET_WEAPON_COIN = 8000;
/** Coins per 転生ポイント (deliberately pricier). */
export const SOULS_COIN = 3000;
/** Coins to exchange for one random 固有(signature) weapon. */
export const SIGNATURE_WEAPON_COIN = 2000;

/**
 * Coin payout for an outcome (replay pays 0 — next spin is free instead).
 * BIG pays 0 here: it triggers ダイスラッシュ (an AT), whose coins come from
 * rollRush() instead — a looping, big-payout bonus (4号機 AT機のフロー参考)。
 */
export function slotPayout(outcome: SlotOutcome): number {
  switch (outcome) {
    case "reg":
      return 60;
    case "watermelon":
      return 8;
    case "bell":
      return 5;
    case "cherry":
      return 1;
    case "big":
    default:
      return 0;
  }
}

// ===== ダイスラッシュ (AT) =====
// 4号機AT機(獣王のサバンナチャンス)のゲームフロー参考。BIG成立で突入し、約100G続く
// AT(無料ゲーム)を消化しながら出玉が伸びる。AT中はまれに「上乗せ」で延長(夢)。
// テーマはダイス×RPG。

/** Games (rotations) granted when a BIG kicks off ダイスラッシュ. */
export const AT_GAMES = 100;

/** Coins paid out by a single AT game (avg ≈ 3.6; rare big hits). */
export function atSpinPayout(): number {
  const r = Math.random();
  if (r < 0.55) return 1 + Math.floor(Math.random() * 2); // 1–2
  if (r < 0.85) return 3 + Math.floor(Math.random() * 3); // 3–5
  if (r < 0.97) return 7 + Math.floor(Math.random() * 4); // 7–10
  return 15 + Math.floor(Math.random() * 11); // 15–25 (big hit)
}

/**
 * Chance per AT game of an 上乗せ (extra games). Returns the games added (0=none).
 * 重要: 1ゲームの期待上乗せが消化(-1G)を下回らないとATが発散して「終わらない」。
 * 通常上乗せ 2%×平均10 + 特大上乗せ 0.05%×平均475 = 約0.44G/G ＜ 1 なので必ず収束。
 * ただし特大上乗せ(+350〜600G)は約1割のATで降ってくるので、運がいいと700G級まで伸びる。
 */
export const AT_RENSHO_CHANCE = 0.02;
/** 特大上乗せ(運がいいと700G級)の発生率。 */
export const AT_JACKPOT_CHANCE = 0.0005;
export function atRensho(): number {
  const r = Math.random();
  if (r < AT_JACKPOT_CHANCE) return 350 + Math.floor(Math.random() * 251); // +350–600G(特大)
  if (r < AT_JACKPOT_CHANCE + AT_RENSHO_CHANCE) return 5 + Math.floor(Math.random() * 11); // +5–15G
  return 0;
}

const MISS_POOL = [2, 3, 4, 5, 6, 8]; // excludes 7(seven) & 9(cherry) to avoid fake hits
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** The reel symbols (1–9) to display for an outcome. `reach` near-misses on 7. */
export function slotReels(outcome: SlotOutcome, reach: boolean): [number, number, number] {
  switch (outcome) {
    case "big":
      return [7, 7, 7];
    case "reg":
      return [4, 4, 4];
    case "replay":
      return [1, 1, 1];
    case "bell":
      return [2, 2, 2];
    case "watermelon":
      return [5, 5, 5];
    case "cherry":
      return [9, pick(MISS_POOL), pick(MISS_POOL)];
    default: {
      if (reach) return [7, 7, pick([3, 5, 6, 8, 9])]; // 7・7・? の煽り
      let a = pick(MISS_POOL);
      let b = pick(MISS_POOL);
      let c = pick(MISS_POOL);
      if (a === b && b === c) c = c === 8 ? 6 : 8; // never an accidental triple
      return [a, b, c];
    }
  }
}

// ===== リーチ演出 (信頼度差つき) =====

export interface ReachDef {
  id: string;
  name: string;
  /** Animation length in ms (~3s). */
  ms: number;
  /** 熱さ 1(弱)〜5(激アツ). */
  tier: number;
  /** 当たり確定のリーチ(画面が虹色に明滅する). tier5はガセに出ないので確定。 */
  guaranteed?: boolean;
}

export const SLOT_REACHES: ReachDef[] = [
  { id: "normal", name: "ノーマルリーチ", ms: 2200, tier: 1 },
  { id: "slow", name: "スロウリーチ", ms: 2600, tier: 1 },
  { id: "reverse", name: "逆回転リーチ", ms: 2800, tier: 2 },
  { id: "double", name: "ダブルリーチ", ms: 3000, tier: 2 },
  { id: "long", name: "ロングリーチ", ms: 3400, tier: 3 },
  { id: "group", name: "群予告リーチ", ms: 3000, tier: 3 },
  { id: "cutin", name: "カットイン", ms: 3200, tier: 4 },
  { id: "allspin", name: "全回転リーチ", ms: 3600, tier: 5, guaranteed: true },
  { id: "rainbow", name: "虹リーチ", ms: 3600, tier: 5, guaranteed: true },
  { id: "premium", name: "プレミアリーチ", ms: 3800, tier: 5, guaranteed: true },
];

/**
 * Per-tier weight for gase (losing) reaches. Tapers steeply but reaches tier4 —
 * so カットイン rarely fires on a loss, landing its 信頼度 around 57% instead of a
 * dead 100%. tier5 (guaranteed) は除外され確定枠のまま。
 * 結果の信頼度ラダー: t1≈0.4% / t2≈2.6% / t3≈19% / t4(カットイン)≈57% / t5=確定。
 * 11%→100% の崖を埋め、「本物かガセか分からない」わんちゃん帯を作る。
 */
const REACH_LOSE_WEIGHT: Record<number, number> = { 1: 8, 2: 5, 3: 1.3, 4: 0.4 };

/**
 * Pick a reach pattern. Wins lean toward hotter (high-tier) reaches; gase (loss)
 * reaches taper toward weak tiers and never use guaranteed (tier5) productions —
 * so a hotter reach genuinely means higher 信頼度.
 */
export function pickReach(win: boolean): ReachDef {
  const pool = win ? SLOT_REACHES : SLOT_REACHES.filter((r) => !r.guaranteed);
  const weight = (t: number) => (win ? t * t : (REACH_LOSE_WEIGHT[t] ?? 0));
  const total = pool.reduce((s, r) => s + weight(r.tier), 0);
  let r = Math.random() * total;
  for (const def of pool) {
    r -= weight(def.tier);
    if (r < 0) return def;
  }
  return pool[0];
}

/** Chance a losing spin still shows a (gase) reach, for tension. */
export const GASE_REACH_CHANCE = 0.1;

// ===== dice blackjack =====

export const BJ_TARGET = 21;
export const DEALER_STAND = 17;

export function bjTotal(dice: number[]): number {
  return dice.reduce((sum, d) => sum + d, 0);
}

export function drawDie(): DiceValue {
  return rollDice();
}

/** Dealer draws until reaching DEALER_STAND or busting. */
export function dealerPlay(start: number[]): number[] {
  const dice = [...start];
  while (bjTotal(dice) < DEALER_STAND) {
    dice.push(rollDice());
  }
  return dice;
}

export type BjOutcome = "win" | "lose" | "push";

export function bjResolve(player: number[], dealer: number[]): BjOutcome {
  const p = bjTotal(player);
  const d = bjTotal(dealer);
  if (p > BJ_TARGET) return "lose";
  if (d > BJ_TARGET) return "win";
  if (p > d) return "win";
  if (p < d) return "lose";
  return "push";
}

/** Double-up: true if a die roll matches the player's hi/lo guess. */
export function doubleUp(guessHigh: boolean): { die: DiceValue; won: boolean } {
  const die = rollDice();
  const isHigh = die >= 4;
  return { die, won: guessHigh ? isHigh : !isHigh };
}
