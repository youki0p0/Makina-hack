import type { DiceFace, DiceValue } from "@/types/game";

/**
 * The initial dice table, before any equipment is applied.
 *
 *   1: ミス
 *   2: 小攻撃
 *   3: 通常攻撃
 *   4: 強攻撃
 *   5: クリティカル
 *   6: スキル攻撃
 *
 * Equipment rewrites these via applyEquipmentModifiers().
 */
export const baseDiceFaces: readonly DiceFace[] = [
  {
    value: 1,
    name: "ミス",
    description: "攻撃が外れる",
    modifiedBy: [],
    effect: {
      kind: "miss",
      damageMultiplier: 0,
      guard: 0,
      selfDamagePct: 0,
      lifestealPct: 0,
      extraHits: 0,
      isMiss: true,
    },
  },
  {
    value: 2,
    name: "小攻撃",
    description: "弱い一撃",
    modifiedBy: [],
    effect: {
      kind: "small",
      damageMultiplier: 0.5,
      guard: 0,
      selfDamagePct: 0,
      lifestealPct: 0,
      extraHits: 0,
      isMiss: false,
    },
  },
  {
    value: 3,
    name: "通常攻撃",
    description: "普通の一撃",
    modifiedBy: [],
    effect: {
      kind: "normal",
      damageMultiplier: 1,
      guard: 0,
      selfDamagePct: 0,
      lifestealPct: 0,
      extraHits: 0,
      isMiss: false,
    },
  },
  {
    value: 4,
    name: "強攻撃",
    description: "強めの一撃",
    modifiedBy: [],
    effect: {
      kind: "strong",
      damageMultiplier: 1.5,
      guard: 0,
      selfDamagePct: 0,
      lifestealPct: 0,
      extraHits: 0,
      isMiss: false,
    },
  },
  {
    value: 5,
    name: "クリティカル",
    description: "会心の一撃",
    modifiedBy: [],
    effect: {
      kind: "critical",
      damageMultiplier: 2,
      guard: 0,
      selfDamagePct: 0,
      lifestealPct: 0,
      extraHits: 0,
      isMiss: false,
    },
  },
  {
    value: 6,
    name: "スキル攻撃",
    description: "強力なスキル",
    modifiedBy: [],
    effect: {
      kind: "skill",
      damageMultiplier: 2.5,
      guard: 0,
      selfDamagePct: 0,
      lifestealPct: 0,
      extraHits: 0,
      isMiss: false,
    },
  },
];

/** Emoji / glyph shown for each dice kind. */
export const diceKindIcon: Record<string, string> = {
  miss: "💨",
  small: "🗡️",
  normal: "⚔️",
  strong: "💥",
  critical: "✨",
  skill: "🌟",
  fireball: "🔥",
  defend: "🛡️",
  selfDamage: "🩸",
  stun: "⚡",
};

export function faceByValue(faces: readonly DiceFace[], value: DiceValue): DiceFace {
  const found = faces.find((f) => f.value === value);
  // baseDiceFaces always covers 1-6, so this is safe.
  return found ?? (faces[0] as DiceFace);
}
