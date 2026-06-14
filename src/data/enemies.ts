import type { Enemy, EnemyAbility, EnemyTemplate } from "@/types/game";

/**
 * 50 normal enemy archetypes ordered weak → strong. Stats scale with the
 * index; abilities are sprinkled in. generateEnemy applies floor scaling on top.
 */
type EnemyDef = [id: string, name: string, emoji: string, ability: EnemyAbility | null];

const ENEMY_DEFS: EnemyDef[] = [
  ["slime", "スライム", "🟢", null],
  ["bat", "コウモリ", "🦇", null],
  ["rat", "大ネズミ", "🐀", null],
  ["goblin", "ゴブリン", "👺", null],
  ["spider", "毒グモ", "🕷️", "lifesteal"],
  ["snake", "大蛇", "🐍", "lifesteal"],
  ["wolf", "狼", "🐺", "multiAttack"],
  ["skeleton", "スケルトン", "💀", "defend"],
  ["zombie", "ゾンビ", "🧟", null],
  ["imp", "インプ", "😈", null],
  ["boar", "猪", "🐗", "fierce"],
  ["orc", "オーク", "👹", "multiAttack"],
  ["ghost", "亡霊", "👻", "guardBreak"],
  ["mushroom", "マッシュ", "🍄", "heal"],
  ["scorpion", "サソリ", "🦂", "lifesteal"],
  ["crab", "岩ガニ", "🦀", "defend"],
  ["bee", "殺人蜂", "🐝", "multiAttack"],
  ["mummy", "ミイラ", "🪦", "heal"],
  ["cyclops", "サイクロプス", "👁️", "fierce"],
  ["harpy", "ハーピー", "🦅", "multiAttack"],
  ["lizardman", "リザードマン", "🦎", null],
  ["gargoyle", "ガーゴイル", "🗿", "defend"],
  ["wraith", "レイス", "🌫️", "guardBreak"],
  ["werewolf", "人狼", "🐺", "fierce"],
  ["vampire", "吸血鬼", "🧛", "lifesteal"],
  ["golem", "ゴーレム", "🪨", "defend"],
  ["troll", "トロル", "👹", "heal"],
  ["minotaur", "ミノタウロス", "🐂", "fierce"],
  ["wisp", "ウィスプ", "✨", "guardBreak"],
  ["slimeking", "キングスライム", "🟩", "heal"],
  ["banshee", "バンシー", "💀", "guardBreak"],
  ["chimera", "キマイラ", "🦁", "multiAttack"],
  ["basilisk", "バジリスク", "🐲", "lifesteal"],
  ["wyvern", "ワイバーン", "🐉", "fierce"],
  ["ogremage", "オーガメイジ", "🧙", "heal"],
  ["darkknight", "暗黒騎士", "🗡️", "guardBreak"],
  ["lich", "リッチ", "☠️", "lifesteal"],
  ["behemoth", "ベヒモス", "🦏", "fierce"],
  ["kraken", "クラーケン", "🐙", "multiAttack"],
  ["phoenix", "フェニックス", "🔥", "heal"],
  ["cerberus", "ケルベロス", "🐕", "multiAttack"],
  ["manticore", "マンティコア", "🦂", "fierce"],
  ["djinn", "ジン", "🌀", "guardBreak"],
  ["hydra", "ヒュドラ", "🐍", "multiAttack"],
  ["titan", "タイタン", "🗿", "fierce"],
  ["specter", "スペクター", "👻", "guardBreak"],
  ["nightmare", "ナイトメア", "🌑", "lifesteal"],
  ["seraph", "堕天使", "😇", "heal"],
  ["leviathan", "リヴァイアサン", "🌊", "fierce"],
  ["voidlord", "虚無の王", "🕳️", "guardBreak"],
];

function buildEnemyTemplates(): EnemyTemplate[] {
  return ENEMY_DEFS.map(([id, name, emoji, ability], i) => ({
    id,
    name,
    emoji,
    baseHp: 16 + i * 5,
    baseAttack: 3 + Math.round(i * 0.9),
    baseDefense: Math.round(i * 0.5),
    baseExp: 5 + i * 2,
    baseGold: 4 + Math.round(i * 1.8),
    dropRate: Math.min(0.5, 0.22 + i * 0.006),
    isBoss: false,
    ...(ability ? { ability } : {}),
  }));
}

export const ENEMY_TEMPLATES: readonly EnemyTemplate[] = buildEnemyTemplates();

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
