import type { ClassId, DiceModifier, StatBonus } from "@/types/game";

export interface CharacterClass {
  id: ClassId;
  name: string;
  icon: string;
  description: string;
  /** Flat stat changes vs the base profile. */
  statMods: StatBonus;
  /** Dice rewrites applied BEFORE equipment (equipment can override). */
  diceModifiers: DiceModifier[];
}

/**
 * Classes fundamentally reshape the dice table and stat profile, changing how
 * the game plays. Their dice modifiers run before equipment, so gear can still
 * refine specific faces on top of the class.
 */
export const CLASSES: readonly CharacterClass[] = [
  {
    id: "adventurer",
    name: "冒険者",
    icon: "🧭",
    description: "クセのない基本形。初期クラス。",
    statMods: { attack: 0, defense: 0, maxHp: 0, reroll: 0 },
    diceModifiers: [],
  },
  {
    id: "warrior",
    name: "戦士",
    icon: "🛡️",
    description: "頑強。防御とHPが高く、ミスがなくなる。",
    statMods: { attack: 0, defense: 3, maxHp: 15, reroll: 0 },
    diceModifiers: [
      {
        faces: [1],
        effect: { kind: "small", damageMultiplier: 0.5, isMiss: false },
        label: "小攻撃",
        description: "1: ミスせず小攻撃",
      },
      {
        faces: [3],
        effect: { guard: 4 },
        description: "3: 攻撃しつつガード+4",
      },
    ],
  },
  {
    id: "rogue",
    name: "盗賊",
    icon: "🗡️",
    description: "手数とリロール。4以上で2回攻撃。",
    statMods: { attack: 1, defense: 0, maxHp: 0, reroll: 1 },
    diceModifiers: [
      {
        faces: [4, 5, 6],
        effect: { extraHits: 1 },
        description: "4以上: 2回攻撃",
      },
    ],
  },
  {
    id: "mage",
    name: "魔法使い",
    icon: "🔮",
    description: "一撃特化。6が強力な火球、防御は脆い。",
    statMods: { attack: 3, defense: -1, maxHp: -5, reroll: 0 },
    diceModifiers: [
      {
        faces: [5],
        effect: { kind: "skill", damageMultiplier: 2.2 },
        description: "5: 魔力の一撃",
      },
      {
        faces: [6],
        effect: { kind: "fireball", damageMultiplier: 3.2 },
        label: "大火球",
        description: "6: 大火球",
      },
    ],
  },
  {
    id: "berserker",
    name: "狂戦士",
    icon: "🪓",
    description: "ハイリスク。5〜6で大ダメージ、1〜2で自傷。",
    statMods: { attack: 4, defense: -2, maxHp: 0, reroll: 0 },
    diceModifiers: [
      {
        faces: [1, 2],
        effect: { kind: "selfDamage", damageMultiplier: 0, selfDamagePct: 0.25, isMiss: false },
        label: "自傷",
        description: "1〜2: 自傷",
      },
      {
        faces: [5, 6],
        effect: { kind: "critical", damageMultiplier: 2.8 },
        label: "大ダメージ",
        description: "5〜6: 大ダメージ",
      },
    ],
  },
];

const CLASS_MAP: Map<ClassId, CharacterClass> = new Map(CLASSES.map((c) => [c.id, c]));

export const DEFAULT_CLASS_ID: ClassId = "adventurer";

export function getClass(id: ClassId): CharacterClass {
  return CLASS_MAP.get(id) ?? CLASS_MAP.get(DEFAULT_CLASS_ID)!;
}

export function normalizeClassId(id?: ClassId): ClassId {
  return id && CLASS_MAP.has(id) ? id : DEFAULT_CLASS_ID;
}

export function classStatBonus(id: ClassId): StatBonus {
  return getClass(id).statMods;
}
