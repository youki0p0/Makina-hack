// ===== Core domain types =====

export type Rarity = "common" | "rare" | "epic" | "legendary" | "cursed";

/** Optional item quality layered on top of rarity (rarer = stronger). */
export type Quality = "ancient" | "mythic" | "unique";

export type EquipmentSlot =
  | "weapon"
  | "helm"
  | "armor"
  | "gloves"
  | "boots"
  | "accessory";

/** Set identifiers for set-bonus gear. */
export type SetId = "gambler" | "vampire" | "executioner" | "oracle";

/** Equipment category used for class-based equip restrictions. */
export type EquipTag = "light" | "heavy" | "magic";

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
  | "stun"
  | "weaken";

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
  /** Amount to reduce the enemy's attack (weaken) for a few turns. */
  weaken?: number;
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
  /** Casino-exclusive: only awarded as a casino prize. */
  casinoOnly?: boolean;
  /** Random affix applied to this instance (id into the affix registry). */
  affixId?: string;
  /** Earliest dungeon floor this item starts dropping (default 1). */
  minFloor?: number;
  /** Category for class equip restrictions (undefined = any class). */
  equipTag?: EquipTag;
  /** Fraction (0-1) of enemy-inflicted poison damage reduced. */
  poisonResist?: number;
  /** Chance (0-1) to ignore enemy-inflicted stun. */
  stunResist?: number;
  /** Higher affix chance + wider affix range (bigger stat swings). */
  volatile?: boolean;
  /** Infinite ★ modifier tier (0 = none). Scales stats additively. */
  modTier?: number;
  /** Set membership key (named or procedural `gset<n>`); drives set bonuses. */
  setId?: string;
  /** Quality tier (ancient/mythic/unique) layered on rarity. */
  quality?: Quality;
  /** Never drops/gacha/shop — granted only by special events (e.g. 神機マキナ). */
  unique?: boolean;
  /** Cannot be sold or scrapped (the one-and-only 神機マキナ). */
  noSell?: boolean;
  /** ★ modifiers never apply to this item. */
  noModifier?: boolean;
  /** Dropped from an Echo Battle (slightly distinct icon, not stronger). */
  echo?: boolean;
  /** Blacksmith forge level (0 = none). Scales numbers, not dice faces. */
  forgeLevel?: number;
  /** Consecutive forge failures (pity counter). */
  forgeStreak?: number;
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

export type ClassId =
  | "adventurer"
  | "warrior"
  | "rogue"
  | "mage"
  | "berserker"
  | "paladin"
  | "hexer"
  // Upper jobs — unlocked at floor 200.
  | "swordsaint"
  | "archmage"
  | "warlord"
  // Elite white/black jobs — unlocked at floor 500.
  | "celestial"
  | "abyssal";

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
export type EnemyAbility =
  | "multiAttack"
  | "heal"
  | "defend"
  | "lifesteal"
  | "fierce"
  | "guardBreak"
  | "poison"
  | "shock";

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
  /** Flavor text shown in the bestiary. */
  desc?: string;
}

export interface Enemy {
  id: string;
  /** Stable template id (e.g. "slime", "boss") for collection tracking. */
  templateId: string;
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
  /** Attack reduction from weaken. */
  weakenAmount: number;
  /** Remaining turns of weaken. */
  weakenTurns: number;
  /** Boss gimmick: enraged (attack up below half HP). */
  enraged: boolean;
  /** Boss gimmick: charging a big attack next turn. */
  charging: boolean;
  /** Boss gimmick: turns counted toward the next charge. */
  chargeCounter: number;
  /** Infinite ★ modifier tier (0 = none). Boosts HP/attack/drops. */
  modTier: number;
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

export type BattleState = "idle" | "player" | "won" | "lost" | "shop";

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
  /** Consecutive-win count after this battle. */
  winStreak: number;
  /** Bonus percent applied to gold/exp from the win streak (0 = none). */
  streakBonusPct: number;
}

// ===== Progress / achievements =====

/** Cumulative run/meta progress used for achievements and unlocks. */
export interface Progress {
  maxFloor: number;
  kills: number;
  bossKills: number;
  rebirths: number;
  jackpots: number;
  maxStreak: number;
  /** Base ids of equipment ever obtained. */
  discoveredItems: string[];
  /** Template ids of enemies ever defeated. */
  defeatedEnemies: string[];
  /** Highest floor ever reached (drives rebirth-point milestones & gacha cap). */
  highestFloorReached: number;
  /** Milestone floors whose rebirth points have already been granted. */
  claimedMilestones: number[];
  /** Ids of floor achievements already claimed. */
  claimedFloorAchievements: string[];
  /** The 1000F DEUS EX MACHINA ending has been witnessed (one-time, unskippable). */
  endingSeen: boolean;
  /** New Game+ count (強くてニューゲーム). */
  ngPlus: number;
  /** 神機マキナ has been granted (so it is never duplicated). */
  makinaGranted: boolean;
  /** Endless-Abyss story floors already shown (1050/1100/…/1250). */
  claimedEndlessMessages: number[];
  /** Ranking points earned from Echo Battles. */
  rankPoints: number;
  /** Rough accumulated play time in seconds (incremented per battle). */
  playSeconds: number;
}

// ===== Persistence =====

/** A persisted equipment reference: base id plus an optional rolled affix. */
export interface SavedItem {
  id: string;
  affixId?: string;
  /** Infinite ★ modifier tier (0/undefined = none). */
  modTier?: number;
  /** Quality tier (ancient/mythic/unique). */
  quality?: Quality;
  /** Blacksmith forge level. */
  forgeLevel?: number;
  /** Forge pity streak. */
  forgeStreak?: number;
}

export interface SaveData {
  /** Schema version. Mismatched versions are discarded (debug-era reset). */
  saveVersion?: number;
  player: Player;
  /** Legacy: plain id arrays (read for old saves). */
  equippedIds?: { [K in EquipmentSlot]: string | null };
  inventoryIds?: string[];
  /** Current: item instances with optional affixes. */
  equippedItems?: { [K in EquipmentSlot]: SavedItem | null };
  inventoryItems?: SavedItem[];
  currentFloor: number;
  /** Gacha currency from scrapping equipment (optional for old saves). */
  gachaPoints?: number;
  /** Rebirth currency (optional for old saves). */
  souls?: number;
  /** Permanent artifact levels carried across rebirths (optional for old saves). */
  artifacts?: ArtifactLevels;
  /** Current character class (optional for old saves). */
  classId?: ClassId;
  /** Consecutive-win count (optional for old saves). */
  winStreak?: number;
  /** Cumulative progress for achievements/collection (optional for old saves). */
  progress?: Progress;
  /** Favorited item keys (id:affix) pinned to the top of the inventory. */
  favorites?: string[];
  /** Whether the first-run help has been dismissed. */
  seenHelp?: boolean;
  /** Selected title id shown next to the player's name. */
  titleId?: string;
  /** Difficulty id ("normal"|"hard"|"hell"). */
  difficulty?: string;
  /** Preferred hand for action buttons ("right"|"left"). */
  handedness?: string;
  /** Highest reached 50-floor checkpoint; defeat restarts here (default 1). */
  checkpoint?: number;
  /** Shop: buy by tapping the whole item row (one-tap purchase). */
  tapToBuy?: boolean;
  /** Last start-floor chosen in the title pulldown (restored on next visit). */
  startFloorPref?: number;
}
