// ===== 今日のダイス（デイリーロール）=====
// タイトルで 1日1回だけ振れる運試し。3つの「目（face）」から1つだけ選び、
// 日付＋面をシードに決定論的に出目(1..6)→報酬を決める。同じ日・同じ面なら
// 結果が固定なので、振った後にリロードしても出目は変わらない（リロール不可）。
// 報酬は Reward 型なので、store の rewardPatch でそのまま付与できる。
//
// 面ごとに“もらえる通貨”が違う。各面は出目6に同価値の大当たりを1つだけ持ち
// （🎰コイン1000 ≒ 💠刻印1 ≒ 🪽魂1 が等価）、出目1〜5はその系統のおまけ。
// 3面が等価なので「今日はどの通貨が欲しい？」という純粋な好みの選択になる：
//   ⚔️ 攻めの目 … コイン/ゴールド（現金）。大当たり = 🎰コイン1000
//   🛡️ 守りの目 … ★アップ素材（🔹欠片/🔶核）。大当たり = 💠刻印1
//   ✦ 運の目   … ガチャ/コイン。大当たり = 🪽魂1
// ※💠刻印は★アップの最希少素材なので、ばら撒かないよう「守りの出目6」1枠だけに限定。

import type { Reward } from "@/types/game";

export type DiceFaceId = "atk" | "def" | "luck";

export interface DiceFaceDef {
  id: DiceFaceId;
  emoji: string;
  /** ボタンに出す短い名前。 */
  label: string;
  /** 何が出やすいかの一言ヒント。 */
  hint: string;
  /** 出目 1..6 に対応する報酬（index 0 = 出目1、index 5 = 出目6=大当たり）。 */
  rewards: readonly [Reward, Reward, Reward, Reward, Reward, Reward];
}

export const DICE_FACES: readonly DiceFaceDef[] = [
  {
    id: "atk",
    emoji: "⚔️",
    label: "攻めの目",
    hint: "コイン寄り",
    rewards: [
      { kind: "gold", amount: 300 },
      { kind: "gold", amount: 500 },
      { kind: "coins", amount: 100 },
      { kind: "gold", amount: 900 },
      { kind: "coins", amount: 300 },
      { kind: "coins", amount: 1000 }, // 大当たり（≒💠1・🪽1）
    ],
  },
  {
    id: "def",
    emoji: "🛡️",
    label: "守りの目",
    hint: "★素材寄り",
    rewards: [
      { kind: "gacha", amount: 40 },
      { kind: "shard", amount: 2 },
      { kind: "shard", amount: 4 },
      { kind: "core", amount: 1 },
      { kind: "core", amount: 2 },
      { kind: "sigil", amount: 1 }, // 大当たり（最希少素材・この1枠だけ）
    ],
  },
  {
    id: "luck",
    emoji: "✦",
    label: "運の目",
    hint: "魂・一発",
    rewards: [
      { kind: "gacha", amount: 30 },
      { kind: "coins", amount: 80 },
      { kind: "gacha", amount: 60 },
      { kind: "coins", amount: 150 },
      { kind: "gacha", amount: 120 },
      { kind: "souls", amount: 1 }, // 大当たり（≒💠1・🎰1000）
    ],
  },
];

/** id から面定義を引く。未知の id は null。 */
export function faceById(id: string): DiceFaceDef | null {
  return DICE_FACES.find((f) => f.id === id) ?? null;
}

/** 決定論ハッシュ（FNV-1a, daily.ts と同方式）。 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DiceResult {
  /** 出目(1..6)。 */
  value: number;
  /** その出目で得られる報酬。 */
  reward: Reward;
}

/**
 * その日・その面の出目と報酬を決定論的に返す。
 * シードに面idを混ぜるので、面を選び直すと出目も変わる（=面選択が意味を持つ）。
 */
export function spinDailyDice(faceId: DiceFaceId, seed: string): DiceResult {
  const face = faceById(faceId) ?? DICE_FACES[0];
  const value = (hash(`${seed}#${faceId}`) % 6) + 1; // 1..6
  return { value, reward: face.rewards[value - 1] };
}
