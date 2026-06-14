import type { Enemy, EnemyAbility, EnemyTemplate } from "@/types/game";

/**
 * 50 normal enemy archetypes ordered weak → strong. Stats scale with the
 * index; abilities are sprinkled in. generateEnemy applies floor scaling on top.
 */
type EnemyDef = [
  id: string,
  name: string,
  emoji: string,
  ability: EnemyAbility | null,
  desc: string,
];

/** Labels for enemy abilities (shared by the battle UI and bestiary). */
export const ENEMY_ABILITY_LABEL: Record<EnemyAbility, string> = {
  multiAttack: "連撃",
  heal: "回復",
  defend: "防御",
  lifesteal: "吸血",
  fierce: "剛撃",
  guardBreak: "防御無視",
};

const ENEMY_DEFS: EnemyDef[] = [
  ["slime", "スライム", "🟢", null, "弱いが数が多い"],
  ["bat", "コウモリ", "🦇", null, "素早く飛び回る"],
  ["rat", "大ネズミ", "🐀", null, "群れで現れる"],
  ["goblin", "ゴブリン", "👺", null, "ずる賢い小鬼"],
  ["spider", "毒グモ", "🕷️", "lifesteal", "毒の牙を持つ"],
  ["snake", "大蛇", "🐍", "lifesteal", "獲物に巻きつく"],
  ["wolf", "狼", "🐺", "multiAttack", "群れで狩る"],
  ["skeleton", "スケルトン", "💀", "defend", "朽ちぬ骸骨兵"],
  ["zombie", "ゾンビ", "🧟", null, "のろのろ歩く死者"],
  ["imp", "インプ", "😈", null, "いたずら好きの小悪魔"],
  ["boar", "猪", "🐗", "fierce", "まっすぐ猛進する"],
  ["orc", "オーク", "👹", "multiAttack", "力自慢の戦士"],
  ["ghost", "亡霊", "👻", "guardBreak", "防御をすり抜ける"],
  ["mushroom", "マッシュ", "🍄", "heal", "胞子で回復する"],
  ["scorpion", "サソリ", "🦂", "lifesteal", "猛毒の尾を持つ"],
  ["crab", "岩ガニ", "🦀", "defend", "硬い甲羅で守る"],
  ["bee", "殺人蜂", "🐝", "multiAttack", "鋭い針で連撃"],
  ["mummy", "ミイラ", "🪦", "heal", "古の呪術師"],
  ["cyclops", "サイクロプス", "👁️", "fierce", "一つ目の巨人"],
  ["harpy", "ハーピー", "🦅", "multiAttack", "空から急襲する"],
  ["lizardman", "リザードマン", "🦎", null, "沼地の戦士"],
  ["gargoyle", "ガーゴイル", "🗿", "defend", "石の守護者"],
  ["wraith", "レイス", "🌫️", "guardBreak", "怨念の塊"],
  ["werewolf", "人狼", "🐺", "fierce", "月夜に荒ぶる"],
  ["vampire", "吸血鬼", "🧛", "lifesteal", "血を糧とする"],
  ["golem", "ゴーレム", "🪨", "defend", "動く岩の像"],
  ["troll", "トロル", "👹", "heal", "再生する巨体"],
  ["minotaur", "ミノタウロス", "🐂", "fierce", "迷宮の番人"],
  ["wisp", "ウィスプ", "✨", "guardBreak", "人を惑わす光"],
  ["slimeking", "キングスライム", "🟩", "heal", "王たる粘体"],
  ["banshee", "バンシー", "💀", "guardBreak", "死を告げる叫び"],
  ["chimera", "キマイラ", "🦁", "multiAttack", "三つの獣の合成"],
  ["basilisk", "バジリスク", "🐲", "lifesteal", "石化の魔眼"],
  ["wyvern", "ワイバーン", "🐉", "fierce", "獰猛な飛竜"],
  ["ogremage", "オーガメイジ", "🧙", "heal", "魔を操る鬼"],
  ["darkknight", "暗黒騎士", "🗡️", "guardBreak", "堕ちた騎士"],
  ["lich", "リッチ", "☠️", "lifesteal", "不死の魔道士"],
  ["behemoth", "ベヒモス", "🦏", "fierce", "大地の獣王"],
  ["kraken", "クラーケン", "🐙", "multiAttack", "深海の触手"],
  ["phoenix", "フェニックス", "🔥", "heal", "蘇る不死鳥"],
  ["cerberus", "ケルベロス", "🐕", "multiAttack", "冥府の番犬"],
  ["manticore", "マンティコア", "🦂", "fierce", "人面の獅子"],
  ["djinn", "ジン", "🌀", "guardBreak", "嵐の精霊"],
  ["hydra", "ヒュドラ", "🐍", "multiAttack", "八つ首の竜"],
  ["titan", "タイタン", "🗿", "fierce", "古の巨神"],
  ["specter", "スペクター", "👻", "guardBreak", "実体なき影"],
  ["nightmare", "ナイトメア", "🌑", "lifesteal", "悪夢の化身"],
  ["seraph", "堕天使", "😇", "heal", "堕ちた天使"],
  ["leviathan", "リヴァイアサン", "🌊", "fierce", "海の覇者"],
  ["voidlord", "虚無の王", "🕳️", "guardBreak", "虚無を統べる者"],
];

function buildEnemyTemplates(): EnemyTemplate[] {
  return ENEMY_DEFS.map(([id, name, emoji, ability, desc], i) => ({
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
    desc,
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
  desc: "階層を統べる強大な存在。激昂し大技を放つ。",
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
