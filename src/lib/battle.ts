import type {
  ActiveStatus,
  ComputedStats,
  DiceFace,
  Enemy,
  EquippedItems,
  Player,
  StatusEffect,
  StatusKind,
} from "@/types/game";

const BASE_REROLLS = 1;
const MAX_REROLLS = 3;

export const EQUIP_SLOTS: ReadonlyArray<keyof EquippedItems> = [
  "weapon",
  "armor",
  "accessory",
];

/** Aggregate base player stats with equipment bonuses. */
export function computeStats(player: Player, equipped: EquippedItems): ComputedStats {
  let attack = player.baseAttack;
  let defense = player.baseDefense;
  let maxHp = player.maxHp;
  let rerollMod = 0;

  for (const slot of EQUIP_SLOTS) {
    const item = equipped[slot];
    if (!item) continue;
    attack += item.attack;
    defense += item.defense;
    maxHp += item.maxHp;
    rerollMod += item.rerollModifier;
  }

  // Spec: base 1 reroll, equipment shifts it; clamp to a sane range.
  const rerolls = clamp(BASE_REROLLS + rerollMod, 0, MAX_REROLLS);

  return { attack, defense, maxHp, rerolls };
}

export interface PlayerActionOutcome {
  enemyDamage: number;
  selfDamage: number;
  heal: number;
  guard: number;
  hits: number;
  logs: string[];
  /** Status to apply to the enemy this turn (null if none). */
  status: ActiveStatus | null;
}

export const STATUS_LABEL: Record<StatusKind, string> = {
  poison: "毒",
  burn: "燃焼",
};

/** Build a concrete ActiveStatus from a face's StatusEffect at the current attack. */
function buildStatus(effect: StatusEffect, attack: number): ActiveStatus {
  return {
    kind: effect.kind,
    damagePerTurn: Math.max(1, Math.round(attack * effect.damagePerTurnMultiplier)),
    remainingTurns: effect.turns,
  };
}

/**
 * Resolve the effect of confirming the current dice face.
 * Returns the deltas; the caller applies them to state.
 */
export function resolvePlayerAction(
  face: DiceFace,
  stats: ComputedStats,
  enemy: Enemy,
): PlayerActionOutcome {
  const logs: string[] = [];
  const e = face.effect;

  if (e.isMiss) {
    return {
      enemyDamage: 0,
      selfDamage: 0,
      heal: 0,
      guard: 0,
      hits: 0,
      logs: ["攻撃を外した！"],
      status: null,
    };
  }

  const hits = 1 + Math.max(0, e.extraHits);
  let enemyDamage = 0;

  if (e.damageMultiplier > 0) {
    const perHit = Math.max(1, Math.round(stats.attack * e.damageMultiplier) - enemy.defense);
    enemyDamage = perHit * hits;
    if (hits > 1) {
      logs.push(`${face.name}！ ${hits}回攻撃で ${enemyDamage} ダメージ`);
    } else {
      logs.push(`${face.name}！ ${enemyDamage} ダメージ`);
    }
  }

  const selfDamage = e.selfDamagePct > 0 ? Math.max(1, Math.round(stats.attack * e.selfDamagePct)) : 0;
  if (selfDamage > 0) {
    logs.push(`反動で ${selfDamage} の自傷ダメージ`);
  }

  const heal = e.lifestealPct > 0 && enemyDamage > 0 ? Math.round(enemyDamage * e.lifestealPct) : 0;
  if (heal > 0) {
    logs.push(`${heal} 回復した`);
  }

  const guard = e.guard > 0 ? e.guard : 0;
  if (guard > 0) {
    logs.push(`ガード態勢 (防御+${guard})`);
  }

  const status = e.statusEffect ? buildStatus(e.statusEffect, stats.attack) : null;
  if (status) {
    logs.push(`${STATUS_LABEL[status.kind]}を付与！ (${status.damagePerTurn}/T × ${status.remainingTurns}T)`);
  }

  return { enemyDamage, selfDamage, heal, guard, hits, logs, status };
}

export interface StatusTickResult {
  damage: number;
  statuses: ActiveStatus[];
  logs: string[];
}

/**
 * Resolve one turn of the enemy's status-over-time effects.
 * Deals defense-ignoring damage and decrements remaining turns.
 */
export function tickEnemyStatuses(enemy: Enemy): StatusTickResult {
  let damage = 0;
  const logs: string[] = [];
  const next: ActiveStatus[] = [];
  for (const s of enemy.statuses ?? []) {
    damage += s.damagePerTurn;
    logs.push(`${enemy.name} は${STATUS_LABEL[s.kind]}で ${s.damagePerTurn} ダメージ`);
    if (s.remainingTurns - 1 > 0) {
      next.push({ ...s, remainingTurns: s.remainingTurns - 1 });
    }
  }
  return { damage, statuses: next, logs };
}

/** Append a freshly applied status to the enemy's existing stack. */
export function addStatus(statuses: ActiveStatus[], status: ActiveStatus): ActiveStatus[] {
  return [...statuses, status];
}

/** Enemy attack damage after the player's guard for this turn. */
export function resolveEnemyAttack(
  enemy: Enemy,
  stats: ComputedStats,
  guard: number,
): { damage: number; log: string } {
  const damage = Math.max(1, enemy.attack - stats.defense - guard);
  return { damage, log: `${enemy.name} の攻撃！ ${damage} ダメージ` };
}

// ===== leveling =====

export function expForLevel(level: number): number {
  return Math.round(20 * Math.pow(1.35, level - 1));
}

export interface LevelUpResult {
  player: Player;
  leveledUp: boolean;
  levelsGained: number;
}

/** Apply exp and level up the player. Heals fully on level up. */
export function applyExp(player: Player, expGained: number): LevelUpResult {
  let next: Player = { ...player, exp: player.exp + expGained };
  let levelsGained = 0;

  while (next.exp >= next.expToNext) {
    next = {
      ...next,
      exp: next.exp - next.expToNext,
      level: next.level + 1,
      maxHp: next.maxHp + 8,
      hp: next.maxHp + 8, // full heal on level up
      baseAttack: next.baseAttack + 2,
      baseDefense: next.baseDefense + 1,
      expToNext: expForLevel(next.level + 1),
    };
    levelsGained += 1;
  }

  return { player: next, leveledUp: levelsGained > 0, levelsGained };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
