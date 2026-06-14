import type { Enemy, EnemyTemplate } from "@/types/game";

export const ENEMY_TEMPLATES: readonly EnemyTemplate[] = [
  {
    id: "slime",
    name: "スライム",
    emoji: "🟢",
    baseHp: 18,
    baseAttack: 4,
    baseDefense: 0,
    baseExp: 6,
    baseGold: 5,
    dropRate: 0.25,
    isBoss: false,
  },
  {
    id: "goblin",
    name: "ゴブリン",
    emoji: "👺",
    baseHp: 26,
    baseAttack: 6,
    baseDefense: 1,
    baseExp: 9,
    baseGold: 8,
    dropRate: 0.3,
    isBoss: false,
  },
  {
    id: "skeleton",
    name: "スケルトン",
    emoji: "💀",
    baseHp: 34,
    baseAttack: 8,
    baseDefense: 2,
    baseExp: 13,
    baseGold: 12,
    dropRate: 0.35,
    isBoss: false,
    ability: "defend",
  },
  {
    id: "orc",
    name: "オーク",
    emoji: "👹",
    baseHp: 48,
    baseAttack: 11,
    baseDefense: 3,
    baseExp: 18,
    baseGold: 18,
    dropRate: 0.4,
    isBoss: false,
    ability: "multiAttack",
  },
];

export const BOSS_TEMPLATE: EnemyTemplate = {
  id: "boss",
  name: "ダンジョンボス",
  emoji: "🐲",
  baseHp: 90,
  baseAttack: 14,
  baseDefense: 4,
  baseExp: 50,
  baseGold: 60,
  dropRate: 1,
  isBoss: true,
  ability: "heal",
};

/**
 * Build an enemy scaled to the given floor.
 * Every 5th floor spawns the boss.
 */
export function generateEnemy(floor: number, enemyMult = 1): Enemy {
  const isBossFloor = floor % 5 === 0;
  const template = isBossFloor ? BOSS_TEMPLATE : pickNormalTemplate(floor);

  // Linear-ish scaling with floor. Bosses also scale with how many they've cleared.
  const tier = Math.floor(floor / 5);
  const hpScale = 1 + floor * 0.18;
  const atkScale = 1 + floor * 0.12;
  const defScale = 1 + floor * 0.08;

  const maxHp = Math.round((template.baseHp * hpScale + (isBossFloor ? tier * 30 : 0)) * enemyMult);
  const attack = Math.round((template.baseAttack * atkScale + (isBossFloor ? tier * 3 : 0)) * enemyMult);
  const defense = Math.round(template.baseDefense * defScale);
  const exp = Math.round(template.baseExp * (1 + floor * 0.15));
  const gold = Math.round(template.baseGold * (1 + floor * 0.15));

  return {
    id: `${template.id}_${floor}`,
    templateId: template.id,
    name: isBossFloor ? `${template.name} Lv${tier}` : template.name,
    emoji: template.emoji,
    maxHp,
    hp: maxHp,
    attack,
    defense,
    exp,
    gold,
    dropRate: template.dropRate,
    isBoss: template.isBoss,
    statuses: [],
    stunTurns: 0,
    ability: template.ability ?? null,
    bonusDefense: 0,
    bonusDefenseTurns: 0,
    weakenAmount: 0,
    weakenTurns: 0,
    enraged: false,
    charging: false,
    chargeCounter: 0,
  };
}

function pickNormalTemplate(floor: number): EnemyTemplate {
  // Unlock tougher enemies as floors increase, but keep variety.
  let pool = ENEMY_TEMPLATES.filter((_, idx) => idx <= Math.floor(floor / 2));
  if (pool.length === 0) pool = [ENEMY_TEMPLATES[0]];
  return pool[Math.floor(Math.random() * pool.length)];
}
