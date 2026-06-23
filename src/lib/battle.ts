import type {
  ActiveBuff,
  ActiveStatus,
  ComputedStats,
  DiceFace,
  Enemy,
  EquippedItems,
  Player,
  StatBonus,
  StatusEffect,
  StatusKind,
} from "@/types/game";

const BASE_REROLLS = 1;
const MAX_REROLLS = 3;

export const EQUIP_SLOTS: ReadonlyArray<keyof EquippedItems> = [
  "weapon",
  "helm",
  "armor",
  "gloves",
  "boots",
  "accessory",
  "emblem",
];

const NO_BONUS: StatBonus = { attack: 0, defense: 0, maxHp: 0, reroll: 0 };

/** Aggregate base player stats with equipment, temporary buffs, and artifacts. */
export function computeStats(
  player: Player,
  equipped: EquippedItems,
  buffs: ReadonlyArray<ActiveBuff> = [],
  artifacts: StatBonus = NO_BONUS,
): ComputedStats {
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

  // Temporary consumable buffs stack on top of equipment.
  let buffAttack = 0;
  let buffDefense = 0;
  let buffReroll = 0;
  for (const b of buffs) {
    if (b.kind === "attack") buffAttack += b.value;
    else if (b.kind === "defense") buffDefense += b.value;
    else if (b.kind === "reroll") buffReroll += b.value;
  }

  // Spec: base 1 reroll, equipment shifts it; clamp. Buff/artifact rerolls add on top.
  const rerolls = clamp(BASE_REROLLS + rerollMod, 0, MAX_REROLLS) + buffReroll + artifacts.reroll;

  return {
    attack: attack + buffAttack + artifacts.attack,
    defense: defense + buffDefense + artifacts.defense,
    maxHp: maxHp + artifacts.maxHp,
    rerolls,
  };
}

/** The minimum die value forced by active "luck" buffs (1 if none). */
export function luckFloor(buffs: ReadonlyArray<ActiveBuff>): number {
  let min = 1;
  for (const b of buffs) {
    if (b.kind === "luck") min = Math.max(min, b.value);
  }
  return Math.min(6, min);
}

/** Count down buffs by one battle, dropping any that expire. */
export function tickBuffs(buffs: ReadonlyArray<ActiveBuff>): ActiveBuff[] {
  const next: ActiveBuff[] = [];
  for (const b of buffs) {
    if (b.battlesLeft - 1 > 0) next.push({ ...b, battlesLeft: b.battlesLeft - 1 });
  }
  return next;
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
  /** Enemy turns to stun this turn (0 if none). */
  stun: number;
  /** Attack reduction to apply to the enemy (0 if none). */
  weaken: number;
}

/** How many enemy turns a weaken lasts. */
export const WEAKEN_TURNS = 3;

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
      stun: 0,
      weaken: 0,
    };
  }

  const hits = 1 + Math.max(0, e.extraHits);
  let enemyDamage = 0;

  if (e.damageMultiplier > 0) {
    const enemyDef = enemy.defense + (enemy.bonusDefense ?? 0);
    const perHit = Math.max(1, Math.round(stats.attack * e.damageMultiplier) - enemyDef);
    // 多段耐性: 2ヒット目以降は40%に減衰(手数ビルドの天敵)。
    if (hits > 1 && enemy.multiHitResist) {
      enemyDamage = perHit + (hits - 1) * Math.round(perHit * 0.4);
      logs.push(`${face.name}！ ${hits}回攻撃 (多段耐性で減衰) ${enemyDamage} ダメージ`);
    } else {
      enemyDamage = perHit * hits;
      if (hits > 1) {
        logs.push(`${face.name}！ ${hits}回攻撃で ${enemyDamage} ダメージ`);
      } else {
        logs.push(`${face.name}！ ${enemyDamage} ダメージ`);
      }
    }
  }

  const selfDamage = e.selfDamagePct > 0 ? Math.max(1, Math.round(stats.attack * e.selfDamagePct)) : 0;
  if (selfDamage > 0) {
    logs.push(`反動で ${selfDamage} の自傷ダメージ`);
  }

  // 吸血無効の敵には回復しない(純サステインビルドの天敵)。
  let heal = e.lifestealPct > 0 && enemyDamage > 0 ? Math.round(enemyDamage * e.lifestealPct) : 0;
  if (heal > 0 && enemy.lifestealImmune) {
    heal = 0;
    logs.push("吸血が効かない！");
  } else if (heal > 0) {
    logs.push(`${heal} 回復した`);
  }

  const guard = e.guard > 0 ? e.guard : 0;
  if (guard > 0) {
    logs.push(`ガード態勢 (防御+${guard})`);
  }

  // 状態異常耐性の敵には毒/燃焼を付与できない(DoTビルドの天敵)。
  let status = e.statusEffect ? buildStatus(e.statusEffect, stats.attack) : null;
  if (status && enemy.statusResist) {
    status = null;
    logs.push("状態異常が効かない！");
  } else if (status) {
    logs.push(`${STATUS_LABEL[status.kind]}を付与！ (${status.damagePerTurn}/T × ${status.remainingTurns}T)`);
  }

  const stun = e.stun && e.stun > 0 ? e.stun : 0;
  if (stun > 0) {
    logs.push(`スタン！ 敵は${stun}ターン動けない`);
  }

  // 弱体は固定値(weaken)と割合(weakenPct×付与時の敵攻撃)の高い方。割合は深層でもスケールする。
  const flatWeaken = e.weaken && e.weaken > 0 ? e.weaken : 0;
  const pctWeaken = e.weakenPct && e.weakenPct > 0 ? Math.round(enemy.attack * e.weakenPct) : 0;
  const weaken = Math.max(flatWeaken, pctWeaken);
  if (weaken > 0) {
    logs.push(`弱体化！ 敵の攻撃-${weaken} (${WEAKEN_TURNS}T)`);
  }

  return { enemyDamage, selfDamage, heal, guard, hits, logs, status, stun, weaken };
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

/** Chance per turn that an enemy uses its special ability. */
const ABILITY_CHANCE = 0.35;

export interface EnemyTurnResult {
  playerDamage: number;
  enemyHeal: number;
  /** If > 0, set the enemy's bonus defense to this value. */
  defendValue: number;
  /** If > 0, inflict poison on the player (damage per turn, lasts a few turns). */
  playerPoison: number;
  /** If > 0, stun the player (loses rerolls) for this many turns. */
  playerStun: number;
  logs: string[];
}

/** How many turns enemy-inflicted player poison lasts. */
export const PLAYER_POISON_TURNS = 3;

/**
 * Decide and resolve the enemy's turn: either a special ability or a normal
 * attack. Pure function — caller applies the deltas.
 */
export function resolveEnemyTurn(
  enemy: Enemy,
  stats: ComputedStats,
  guard: number,
): EnemyTurnResult {
  const atk = Math.max(
    1,
    enemy.attack - (enemy.weakenTurns > 0 ? enemy.weakenAmount : 0),
  );
  const normal = () => Math.max(1, atk - stats.defense - guard);
  const base = (): EnemyTurnResult => ({
    playerDamage: 0,
    enemyHeal: 0,
    defendValue: 0,
    playerPoison: 0,
    playerStun: 0,
    logs: [],
  });

  if (enemy.ability && Math.random() < ABILITY_CHANCE) {
    if (enemy.ability === "multiAttack") {
      const per = Math.max(1, Math.round(atk * 0.7) - stats.defense - guard);
      const damage = per * 2;
      return { ...base(), playerDamage: damage, logs: [`${enemy.name} の連続攻撃！ ${damage} ダメージ`] };
    }
    if (enemy.ability === "heal") {
      const heal = Math.max(1, Math.round(enemy.maxHp * 0.2));
      return { ...base(), enemyHeal: heal, logs: [`${enemy.name} は回復した！ (+${heal})`] };
    }
    if (enemy.ability === "defend") {
      const defendValue = Math.max(3, Math.round(enemy.attack * 0.8));
      return { ...base(), defendValue, logs: [`${enemy.name} は身を固めた！ (防御+${defendValue})`] };
    }
    if (enemy.ability === "lifesteal") {
      const damage = normal();
      const heal = Math.max(1, Math.round(damage * 0.5));
      return {
        ...base(),
        playerDamage: damage,
        enemyHeal: heal,
        logs: [`${enemy.name} は吸血！ ${damage} ダメージ (自身 +${heal})`],
      };
    }
    if (enemy.ability === "fierce") {
      const damage = Math.max(1, Math.round(atk * 1.8) - stats.defense - guard);
      return { ...base(), playerDamage: damage, logs: [`${enemy.name} の渾身の一撃！ ${damage} ダメージ`] };
    }
    if (enemy.ability === "guardBreak") {
      const damage = Math.max(1, atk - stats.defense);
      return { ...base(), playerDamage: damage, logs: [`${enemy.name} の防御無視攻撃！ ${damage} ダメージ`] };
    }
    if (enemy.ability === "poison") {
      const damage = normal();
      const poison = Math.max(1, Math.round(atk * 0.3));
      return {
        ...base(),
        playerDamage: damage,
        playerPoison: poison,
        logs: [`${enemy.name} の毒撃！ ${damage} ダメージ＋毒`],
      };
    }
    if (enemy.ability === "shock") {
      const damage = normal();
      return {
        ...base(),
        playerDamage: damage,
        playerStun: 1,
        logs: [`${enemy.name} の麻痺攻撃！ ${damage} ダメージ＋スタン`],
      };
    }
  }

  const damage = normal();
  return { ...base(), playerDamage: damage, logs: [`${enemy.name} の攻撃！ ${damage} ダメージ`] };
}

export interface BossTurnResult {
  playerDamage: number;
  enemyHeal: number;
  charging: boolean;
  chargeCounter: number;
  /** Final boss can disrupt the player's dice (lose rerolls next turn). */
  playerStun?: number;
  logs: string[];
}

/** Turns between a boss's telegraphed charge attacks. */
const CHARGE_EVERY = 3;

/**
 * Boss turn with gimmicks: enrage (attack up when enraged), a telegraphed
 * charge → devastating hit cycle, and occasional self-heal.
 */
export function resolveBossTurn(
  enemy: Enemy,
  stats: ComputedStats,
  guard: number,
): BossTurnResult {
  const weaken = enemy.weakenTurns > 0 ? enemy.weakenAmount : 0;
  // DPS関門(緩和版): 12ターンを超えると攻撃が毎ターン+20%加速。猶予を広げることで
  // バースト/グラスキャノン系も間に合えば突破でき、単一耐久ビルドへの収束を防ぐ。
  const ramp = 1 + Math.max(0, (enemy.bossTurns ?? 0) - 12) * 0.2;
  const eatk = Math.max(1, Math.round(enemy.attack * (enemy.enraged ? 1.5 : 1) * ramp) - weaken);

  // Unleash the charged attack.
  if (enemy.charging) {
    const damage = Math.max(1, Math.round(eatk * 2.5) - stats.defense - guard);
    return {
      playerDamage: damage,
      enemyHeal: 0,
      charging: false,
      chargeCounter: 0,
      logs: [`${enemy.name} の渾身の一撃！ ${damage} ダメージ`],
    };
  }

  // Time to start charging (telegraph).
  const counter = enemy.chargeCounter + 1;
  if (counter >= CHARGE_EVERY) {
    return {
      playerDamage: 0,
      enemyHeal: 0,
      charging: true,
      chargeCounter: 0,
      logs: [`${enemy.name} が力を溜め始めた…（次のターンに大技！）`],
    };
  }

  // Occasional heal.
  if (Math.random() < 0.2) {
    const heal = Math.max(1, Math.round(enemy.maxHp * 0.12));
    return {
      playerDamage: 0,
      enemyHeal: heal,
      charging: false,
      chargeCounter: counter,
      logs: [`${enemy.name} は回復した！ (+${heal})`],
    };
  }

  const damage = Math.max(1, eatk - stats.defense - guard);
  return {
    playerDamage: damage,
    enemyHeal: 0,
    charging: false,
    chargeCounter: counter,
    logs: [`${enemy.name} の攻撃！ ${damage} ダメージ`],
  };
}

/**
 * 1000F final boss (機神デウス＝エクス＝マキナ) — a JRPG-style "last boss" pattern:
 * HP-based phases, multi-action in later phases, a telegraphed charge → ultimate,
 * and self-repair. All moves are original (dice × machine-god themed).
 *  - Phase 1 (>66% HP): 1 action.
 *  - Phase 2 (33–66%):  sometimes 2 actions; can disrupt the player's dice.
 *  - Phase 3 (<33%):    always 2 actions, charges more often.
 */
export function resolveFinalBossTurn(
  enemy: Enemy,
  stats: ComputedStats,
  guard: number,
): BossTurnResult {
  const weaken = enemy.weakenTurns > 0 ? enemy.weakenAmount : 0;
  const ramp = 1 + Math.max(0, (enemy.bossTurns ?? 0) - 8) * 0.3; // DPS関門は維持
  const eatk = Math.max(1, Math.round(enemy.attack * (enemy.enraged ? 1.4 : 1) * ramp) - weaken);
  const hpFrac = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
  const phase = hpFrac > 0.66 ? 1 : hpFrac > 0.33 ? 2 : 3;
  const base = (): BossTurnResult => ({
    playerDamage: 0,
    enemyHeal: 0,
    charging: false,
    chargeCounter: enemy.chargeCounter,
    logs: [],
  });

  // Unleash the charged ultimate.
  if (enemy.charging) {
    const damage = Math.max(1, Math.round(eatk * 2.6) - stats.defense - guard);
    return {
      ...base(),
      playerDamage: damage,
      charging: false,
      chargeCounter: 0,
      logs: [`${enemy.name} の【終焉のサイコロ】！ 全運命を断つ一撃 — ${damage} ダメージ`],
    };
  }

  // Telegraph the charge (sooner in the final phase).
  const counter = enemy.chargeCounter + 1;
  if (counter >= (phase === 3 ? 3 : 4)) {
    return {
      ...base(),
      charging: true,
      chargeCounter: 0,
      logs: [`${enemy.name} は無数の歯車を逆回転させ、力を凝縮し始めた…（次のターンに大技！）`],
    };
  }

  // 1–2 actions depending on phase.
  const acts = phase === 3 ? 2 : phase === 2 && Math.random() < 0.5 ? 2 : 1;
  let damage = 0;
  let heal = 0;
  let stun = 0;
  const logs: string[] = [];
  for (let k = 0; k < acts; k++) {
    const r = Math.random();
    if (phase <= 2 && r < 0.18) {
      const h = Math.max(1, Math.round(enemy.maxHp * 0.1));
      heal += h;
      logs.push(`${enemy.name} は自己修復した！ (+${h})`);
    } else if (r < 0.4) {
      // 次元崩壊砲: 防御を貫通する重い一撃(ガードは効く)。
      const d = Math.max(1, Math.round(eatk * 1.5) - guard);
      damage += d;
      logs.push(`${enemy.name} の【次元崩壊砲】！ ${d} ダメージ`);
    } else if (phase >= 2 && r < 0.55) {
      // 狂気のダイス: 通常ダメージ＋次ターンの出目を乱す(リロール不可)。
      const d = Math.max(1, eatk - stats.defense - guard);
      damage += d;
      stun = 1;
      logs.push(`${enemy.name} は【狂気のダイス】を振った！ ${d} ダメージ＋出目が乱れる`);
    } else {
      const d = Math.max(1, eatk - stats.defense - guard);
      damage += d;
      logs.push(`${enemy.name} の機神の打撃！ ${d} ダメージ`);
    }
  }
  return { ...base(), playerDamage: damage, enemyHeal: heal, chargeCounter: counter, playerStun: stun, logs };
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
      maxHp: next.maxHp + 11,
      hp: next.maxHp + 11, // full heal on level up
      baseAttack: next.baseAttack + 3,
      baseDefense: next.baseDefense + 2,
      expToNext: expForLevel(next.level + 1),
    };
    levelsGained += 1;
  }

  return { player: next, leveledUp: levelsGained > 0, levelsGained };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
