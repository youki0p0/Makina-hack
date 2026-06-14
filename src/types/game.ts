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
  | "selfDamage"
  | "stun";

/** Continuous status the dice can inflict on the enemy. */
export type StatusKind = "poison" | "burn";

/**
 * A status-over-time the face applies to the enemy when confirmed.
 * Equipment declares this on a face via diceModifiers.
 */
export interface StatusEffect {
  kind: StatusKind;
  /** Per-turn damage as a fraction (0-1) of the player's attack at apply time. */
  damagePerTurnMultiplier: number;
  /** How many enemy turns it lasts. */
  turns: number;
}

/** A status currently active on the enemy (damage frozen at apply time). */
export interface ActiveStatus {
  kind: StatusKind;
  /** Flat per-turn damage, ignores defense. */
  damagePerTurn: number;
  remainingTurns: number;
}

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
  /** Status-over-time inflicted on the enemy when this face is confirmed. */
  statusEffect?: StatusEffect;
  /** Number of enemy turns to stun (skip its attack). */
  stun?: number;
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
  /** Gacha-exclusive: never drops from enemies, only from the equipment gacha. */
  gachaOnly?: boolean;
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

// ===== Character classes (転職) =====

export type ClassId = "adventurer" | "warrior" | "rogue" | "mage" | "berserker";

// ===== Artifacts (rebirth meta-progression) =====

export type ArtifactId = "might" | "guard" | "vitality" | "fortune";

/** Owned level of each artifact (persists across rebirths). */
export type ArtifactLevels = Record<ArtifactId, number>;

/** A flat stat bonus contributed by artifacts. */
export interface StatBonus {
  attack: number;
  defense: number;
  maxHp: number;
  reroll: number;
}

// ===== Enemies =====

/** Special enemy behaviors that can fire on the enemy's turn. */
export type EnemyAbility = "multiAttack" | "heal" | "defend";

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
  /** Optional special action. */
  ability?: EnemyAbility;
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
  /** Active status-over-time effects (poison/burn). */
  statuses: ActiveStatus[];
  /** Remaining enemy turns to skip due to stun. */
  stunTurns: number;
  /** Special action this enemy can perform (null if none). */
  ability: EnemyAbility | null;
  /** Temporary defense bonus from the "defend" ability. */
  bonusDefense: number;
  /** Remaining turns of the defense bonus. */
  bonusDefenseTurns: number;
}

// ===== Consumables =====

/**
 * Consumables are auto-used the instant they drop.
 * - "heal": instantly restore HP.
 * - "attack"/"defense"/"reroll": temporary buff lasting `battles` battles.
 * - "luck": dice manipulation — the die rolls at least `value` for `battles` battles.
 */
export type ConsumableKind = "heal" | "attack" | "defense" | "reroll" | "luck";

export interface Consumable {
  id: string;
  name: string;
  rarity: Rarity;
  kind: ConsumableKind;
  /** Heal HP, buff magnitude, or minimum die value (luck). */
  value: number;
  /** Duration in battles for buffs (0 for instant heal). */
  battles: number;
  description: string;
}

/** A temporary buff currently in effect, counting down per battle. */
export interface ActiveBuff {
  kind: Exclude<ConsumableKind, "heal">;
  value: number;
  battlesLeft: number;
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
  /** Consumable that dropped and was auto-used this victory. */
  consumable: Consumable | null;
  /** HP restored by an auto-used heal consumable. */
  healed: number;
}

// ===== Persistence =====

export interface SaveData {
  player: Player;
  equippedIds: { [K in EquipmentSlot]: string | null };
  inventoryIds: string[];
  currentFloor: number;
  /** Gacha currency from scrapping equipment (optional for old saves). */
  gachaPoints?: number;
  /** Rebirth currency (optional for old saves). */
  souls?: number;
  /** Permanent artifact levels carried across rebirths (optional for old saves). */
  artifacts?: ArtifactLevels;
  /** Current character class (optional for old saves). */
  classId?: ClassId;
}
