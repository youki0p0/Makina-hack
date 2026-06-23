// ===== 今日のダイス（デイリーロール）=====
// タイトルで 1日1回だけ振れる運試し。3つの「目（face）」から1つだけ選び、
// 日付＋面をシードに決定論的に出目(1..6)→報酬を決める。同じ日・同じ面なら
// 結果が固定なので、振った後にリロードしても出目は変わらない（リロール不可）。
// 報酬は Reward 型なので、store の rewardPatch でそのまま付与できる。
//
// 面ごとに報酬の“寄り”が違う：
//   ⚔️ 攻めの目 … コイン/ゴールド寄り（手堅い）
//   🛡️ 守りの目 … ★アップ素材寄り（コツコツ）
//   ✦ 運の目   … 魂・レア刻印寄り（ハイリスク・ハイリターン）

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
      { kind: "gold", amount: 200 },
      { kind: "gold", amount: 350 },
      { kind: "coins", amount: 30 },
      { kind: "gold", amount: 600 },
      { kind: "coins", amount: 60 },
      { kind: "gold", amount: 1200 },
    ],
  },
  {
    id: "def",
    emoji: "🛡️",
    label: "守りの目",
    hint: "★素材寄り",
    rewards: [
      { kind: "gacha", amount: 20 },
      { kind: "shard", amount: 2 },
      { kind: "shard", amount: 3 },
      { kind: "gacha", amount: 50 },
      { kind: "shard", amount: 6 },
      { kind: "core", amount: 2 },
    ],
  },
  {
    id: "luck",
    emoji: "✦",
    label: "運の目",
    hint: "魂・レア寄り",
    rewards: [
      { kind: "gacha", amount: 30 },
      { kind: "coins", amount: 40 },
      { kind: "souls", amount: 1 },
      { kind: "gacha", amount: 80 },
      { kind: "souls", amount: 2 },
      { kind: "sigil", amount: 1 },
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
