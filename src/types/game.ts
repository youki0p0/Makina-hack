// ===== Core domain types =====

export type Rarity = "common" | "rare" | "epic" | "legendary" | "cursed";

export type EquipmentSlot = "weapon" | "armor" | "accessory";

export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * The "kind" of a dice face. Used purely for icons / colors in the UI.
 * The actual numeric behavior lives in {@link DiceFaceEffect}.
 */
export type DiceKind =
  | "miss"
  | "small"
  | "normal"
  | "strong"
  | "critical"
  | "skill"
  | "fireball"
  | "defend"
  | "selfDamage";

/**
 * Resolved numeric behavior of a single dice face.
 * Equipment modifiers merge into this object to "rewrite" what a face does.
 */
export interface DiceFaceEffect {
  kind: DiceKind;
  /** Multiplier applied to the player's attack. 0 means no attack damage. */
  damageMultiplier: number;
  /** Flat guard value subtracted from the enemy's next attack this turn. */
  guard: number;
  /** Fraction (0-1) of the player's attack dealt to the player as self damage. */
  selfDamagePct: number;
  /** Fraction (0-1) of damage dealt that heals the player. */
  lifestealPct: number;
  /** Extra hits beyond the first (1 => attack twice). */
  extraHits: number;
  /** True if the face misses entirely. */
  isMiss: boolean;
}

/**
 * A fully resolved dice face (base face + equipment modifiers applied).
 */
export interface DiceFace {
  value: DiceValue;
  name: string;
  description: string;
  effect: DiceFaceEffect;
  /** Names of equipment that changed this face (for UI highlight). */
  modifiedBy: string[];
}

/**
 * Declarative modifier carried by an equipment item.
 * It rewrites the effect of the listed dice {@link faces}.
 */
export interface DiceModifier {
  faces: DiceValue[];
  /** Partial override merged onto the matching faces' effect. */
  effect: Partial<DiceFaceEffect>;
  /** New short label for the face (optional). */
  label?: string;
  /** Human readable explanation shown in the UI. */
  description: string;
}

export interface Equipment {
  id: string;
  name: string;
  rarity: Rarity;
  slot: EquipmentSlot;
  attack: number;
  defense: number;
  maxHp: number;
  /** Change to the number of rerolls available per turn. */
  rerollModifier: number;
  description: string;
  diceModifiers: DiceModifier[];
}

export type EquippedItems = {
  [K in EquipmentSlot]: Equipment | null;
};

// ===== Player =====

export interface Player {
  level: number;
  exp: number;
  expToNext: number;
  maxHp: number;
  hp: number;
  baseAttack: number;
  baseDefense: number;
  gold: number;
}

/** Player stats after equipment bonuses are applied. */
export interface ComputedStats {
  maxHp: number;
  attack: number;
  defense: number;
  rerolls: number;
}

// ===== Enemies =====

export interface EnemyTemplate {
  id: string;
  name: string;
  emoji: string;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseExp: number;
  baseGold: number;
  /** Drop chance 0-1. */
  dropRate: number;
  isBoss: boolean;
}

export interface Enemy {
  id: string;
  name: string;
  emoji: string;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  exp: number;
  gold: number;
  dropRate: number;
  isBoss: boolean;
}

// ===== Battle =====

export type BattleState = "idle" | "player" | "won" | "lost";

export interface BattleLogEntry {
  id: number;
  text: string;
  tone: "neutral" | "good" | "bad";
}

export interface BattleResult {
  victory: boolean;
  expGained: number;
  goldGained: number;
  goldLost: number;
  drop: Equipment | null;
  leveledUp: boolean;
}

// ===== Persistence =====

export interface SaveData {
  player: Player;
  equippedIds: { [K in EquipmentSlot]: string | null };
  inventoryIds: string[];
  currentFloor: number;
}
