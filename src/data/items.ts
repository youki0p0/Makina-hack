import { applyAffix, getAffixById } from "@/data/affixes";
import { applyForge } from "@/data/forge";
import { applyModifier } from "@/data/modifiers";
import { applyQuality } from "@/data/quality";
import { availableSetKeys, getSetDef } from "@/data/sets";
import type {
  ClassId,
  DiceValue,
  EquipTag,
  Equipment,
  EquipmentSlot,
  Quality,
  Rarity,
} from "@/types/game";

/**
 * Hand-crafted "signature" items — the ones with dice-rewrite effects.
 * Combined with the generated progression items below into {@link ITEMS}.
 *
 * IMPORTANT: only item *ids* are persisted to localStorage. Items are always
 * rehydrated from this registry by id, so the dice-rewrite data here is the
 * single source of truth.
 */
const SIGNATURE_ITEMS: readonly Equipment[] = [
  // ===== weapons =====
  {
    id: "rusty_sword",
    name: "錆びた剣",
    rarity: "common",
    slot: "weapon",
    equipTag: "light",
    attack: 2,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    description: "攻撃力+2。なまくらだがないよりはマシ。",
    diceModifiers: [],
  },
  {
    id: "iron_sword",
    name: "鉄の剣",
    rarity: "common",
    slot: "weapon",
    equipTag: "light",
    attack: 4,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    description: "攻撃力+4。1のミスを小攻撃に変える。",
    diceModifiers: [
      {
        faces: [1],
        effect: { kind: "small", damageMultiplier: 0.5, isMiss: false },
        label: "小攻撃",
        description: "1: ミス → 小攻撃",
      },
    ],
  },
  {
    id: "thief_dagger",
    name: "盗賊の短剣",
    rarity: "rare",
    slot: "weapon",
    equipTag: "light",
    attack: 3,
    defense: 0,
    maxHp: 0,
    rerollModifier: 1,
    description: "攻撃力+3、リロール+1。5以上で2回攻撃。",
    diceModifiers: [
      {
        faces: [5, 6],
        effect: { extraHits: 1 },
        description: "5以上: 2回攻撃",
      },
    ],
  },
  {
    id: "vampiric_sword",
    name: "吸血の剣",
    rarity: "epic",
    slot: "weapon",
    equipTag: "light",
    signature: true,
    attack: 8,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 6,
    description: "【固有】攻撃力+8。4以上で与ダメージの25%回復。",
    diceModifiers: [
      {
        faces: [4, 5, 6],
        effect: { lifestealPct: 0.25 },
        description: "4以上: 与ダメージ25%回復",
      },
    ],
  },
  // ===== クラス限定「ロマン装備」=====
  // 装備制限の多い職業へのご褒美。classLock で本人だけ装備でき、効果は同格よりやや強め。
  // 通常ドロップ対象外で、該当クラスで深層ボスを倒したときに低確率でのみ出る（loot.ts）。
  {
    id: "rogue_twin_fang",
    name: "宵闇の双牙",
    rarity: "legendary",
    slot: "weapon",
    classLock: "rogue",
    signature: true,
    attack: 14,
    defense: 0,
    maxHp: 0,
    rerollModifier: 1,
    minFloor: 20,
    description: "【盗賊専用】攻撃+14・リロール+1。2以上で2回、6で4回攻撃＋10%吸命。",
    diceModifiers: [
      {
        faces: [2, 3, 4, 5],
        effect: { extraHits: 1, lifestealPct: 0.1 },
        description: "2以上: 2回攻撃 (10%吸命)",
      },
      {
        faces: [6],
        effect: { extraHits: 3, lifestealPct: 0.1 },
        label: "百花繚乱",
        description: "6: 4回攻撃 (10%吸命)",
      },
    ],
  },
  {
    id: "mage_truth_staff",
    name: "真理の天杖",
    rarity: "legendary",
    slot: "weapon",
    classLock: "mage",
    signature: true,
    attack: 12,
    defense: 0,
    maxHp: 10,
    rerollModifier: 0,
    minFloor: 20,
    description: "【魔法使い専用】攻撃+12・HP+10。4で魔撃、5で大魔撃、6で極大火球＋12%吸命。",
    diceModifiers: [
      {
        faces: [4],
        effect: { kind: "skill", damageMultiplier: 2.2, lifestealPct: 0.12 },
        description: "4: 魔力の一撃 (12%吸命)",
      },
      {
        faces: [5],
        effect: { kind: "skill", damageMultiplier: 2.8, lifestealPct: 0.12 },
        label: "大魔撃",
        description: "5: 大魔撃 (12%吸命)",
      },
      {
        faces: [6],
        effect: { kind: "fireball", damageMultiplier: 4.2, lifestealPct: 0.12 },
        label: "極大火球",
        description: "6: 極大火球 (12%吸命)",
      },
    ],
  },
  {
    id: "hexer_grimoire",
    name: "呪詛の魔典",
    rarity: "legendary",
    slot: "weapon",
    classLock: "hexer",
    signature: true,
    attack: 12,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 20,
    description: "【呪術師専用】攻撃+12。2以上で強毒(5T)、4以上で敵攻-35%、6で大呪火。",
    diceModifiers: [
      {
        faces: [2, 3],
        effect: { statusEffect: { kind: "poison", damagePerTurnMultiplier: 0.5, turns: 5 } },
        label: "猛呪毒",
        description: "2〜3: 強毒を付与 (5T)",
      },
      {
        faces: [4, 5],
        effect: {
          kind: "weaken",
          weakenPct: 0.35,
          statusEffect: { kind: "poison", damagePerTurnMultiplier: 0.5, turns: 5 },
        },
        label: "大呪詛",
        description: "4〜5: 敵の攻撃-35%＋強毒",
      },
      {
        faces: [6],
        effect: {
          kind: "fireball",
          damageMultiplier: 3.4,
          statusEffect: { kind: "poison", damagePerTurnMultiplier: 0.5, turns: 5 },
        },
        label: "大呪火",
        description: "6: 大呪火＋強毒",
      },
    ],
  },
  {
    id: "archmage_finale",
    name: "叡智の終焉",
    rarity: "legendary",
    slot: "weapon",
    classLock: "archmage",
    signature: true,
    attack: 16,
    defense: 0,
    maxHp: 12,
    rerollModifier: 0,
    minFloor: 220,
    description: "【大魔道士専用】攻撃+16・HP+12。4/5で魔技、6で災禍級の特大火球＋12%吸命。",
    diceModifiers: [
      {
        faces: [4],
        effect: { kind: "skill", damageMultiplier: 2.8, lifestealPct: 0.12 },
        description: "4: 魔技 ×2.8 (12%吸命)",
      },
      {
        faces: [5],
        effect: { kind: "skill", damageMultiplier: 3.4, lifestealPct: 0.12 },
        label: "大魔技",
        description: "5: 大魔技 ×3.4 (12%吸命)",
      },
      {
        faces: [6],
        effect: { kind: "fireball", damageMultiplier: 5.0, lifestealPct: 0.12 },
        label: "災禍の火球",
        description: "6: 特大火球 ×5.0 (12%吸命)",
      },
    ],
  },
  {
    id: "cursed_axe",
    name: "呪いの斧",
    rarity: "cursed",
    slot: "weapon",
    equipTag: "heavy",
    attack: 10,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 9,
    description: "攻撃力+10。1〜2で自傷、5〜6で大ダメージ。",
    diceModifiers: [
      {
        faces: [1, 2],
        effect: { kind: "selfDamage", damageMultiplier: 0, selfDamagePct: 0.3, isMiss: false },
        label: "自傷",
        description: "1〜2: 自分にダメージ",
      },
      {
        faces: [5, 6],
        effect: { kind: "critical", damageMultiplier: 2.8 },
        label: "大ダメージ",
        description: "5〜6: 大ダメージ",
      },
    ],
  },
  {
    id: "venom_fang",
    name: "毒牙の短剣",
    rarity: "epic",
    slot: "weapon",
    equipTag: "light",
    signature: true,
    attack: 5,
    defense: 0,
    maxHp: 0,
    rerollModifier: 1,
    description: "【固有】攻撃力+5、リロール+1。2以上で強毒を付与(継続ダメージ・累積)。",
    diceModifiers: [
      {
        faces: [2, 3, 4, 5, 6],
        effect: {
          // DoT延命: 継続ダメージ倍率を 0.2→0.3 に強化。
          statusEffect: { kind: "poison", damagePerTurnMultiplier: 0.3, turns: 4 },
        },
        description: "2以上: 強毒を付与 (4T・累積)",
      },
    ],
  },
  {
    id: "flame_brand",
    name: "業火の剣",
    rarity: "legendary",
    slot: "weapon",
    equipTag: "heavy",
    signature: true,
    attack: 9,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 8,
    description: "【固有】攻撃力+9。4以上で燃焼(強力な継続ダメージ)を付与。",
    diceModifiers: [
      {
        faces: [4, 5, 6],
        effect: {
          kind: "fireball",
          // DoT延命: 燃焼倍率を 0.45→0.55 に強化。
          statusEffect: { kind: "burn", damagePerTurnMultiplier: 0.55, turns: 3 },
        },
        label: "業火",
        description: "4以上: 燃焼を付与 (3T)",
      },
    ],
  },
  {
    id: "thunder_hammer",
    name: "雷神の鎚",
    rarity: "epic",
    slot: "weapon",
    equipTag: "heavy",
    signature: true,
    attack: 8,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    description: "【固有】攻撃力+8。6で敵をスタン(1ターン行動不能)。",
    diceModifiers: [
      {
        faces: [6],
        effect: { kind: "stun", stun: 1 },
        label: "雷撃",
        description: "6: 敵をスタン(1T)",
      },
    ],
  },
  {
    id: "hex_rod",
    name: "呪詛のロッド",
    rarity: "rare",
    slot: "weapon",
    equipTag: "magic",
    signature: true,
    attack: 5,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    description: "【固有】攻撃力+5。2〜3で敵を弱体化(攻撃-10%)。",
    diceModifiers: [
      {
        faces: [2, 3],
        effect: { kind: "weaken", weakenPct: 0.1 },
        label: "弱体化",
        description: "2〜3: 敵の攻撃-10%",
      },
    ],
  },
  {
    id: "glacial_spear",
    name: "氷結の槍",
    rarity: "epic",
    slot: "weapon",
    equipTag: "magic",
    signature: true,
    attack: 7,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 14,
    description: "【固有】攻撃力+7。6で敵を凍結(2ターン行動不能)。",
    diceModifiers: [
      {
        faces: [6],
        effect: { kind: "stun", stun: 2 },
        label: "凍結",
        description: "6: 敵を凍結(2T)",
      },
    ],
  },
  {
    id: "gale_rapier",
    name: "疾風のレイピア",
    rarity: "rare",
    slot: "weapon",
    equipTag: "light",
    signature: true,
    attack: 5,
    defense: 0,
    maxHp: 0,
    rerollModifier: 2,
    minFloor: 8,
    description: "【固有】攻撃力+5、リロール+2。4以上で2回攻撃。",
    diceModifiers: [
      {
        faces: [4, 5, 6],
        effect: { extraHits: 1 },
        description: "4以上: 2回攻撃",
      },
    ],
  },
  {
    id: "assassin_kris",
    name: "暗殺者の小刀",
    rarity: "epic",
    slot: "weapon",
    equipTag: "light",
    signature: true,
    attack: 6,
    defense: 0,
    maxHp: 0,
    rerollModifier: 1,
    minFloor: 12,
    description: "【固有】攻撃力+6、リロール+1。6で3回攻撃。",
    diceModifiers: [
      {
        faces: [6],
        effect: { extraHits: 2 },
        label: "連刃",
        description: "6: 3回攻撃",
      },
    ],
  },
  {
    id: "plague_scepter",
    name: "疫病の杖",
    rarity: "epic",
    slot: "weapon",
    equipTag: "magic",
    signature: true,
    attack: 6,
    defense: 0,
    maxHp: 0,
    rerollModifier: 1,
    minFloor: 13,
    description: "【固有】攻撃力+6、リロール+1。3以上で猛毒(継続ダメージ・5T・累積)。",
    diceModifiers: [
      {
        faces: [3, 4, 5, 6],
        effect: {
          statusEffect: { kind: "poison", damagePerTurnMultiplier: 0.4, turns: 5 },
        },
        description: "3以上: 猛毒を付与 (5T・累積)",
      },
    ],
  },
  {
    id: "guardian_halberd",
    name: "守護の戦斧",
    rarity: "epic",
    slot: "weapon",
    equipTag: "heavy",
    signature: true,
    attack: 6,
    defense: 4,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 11,
    description: "【固有】攻撃力+6 / 防御+4。3以下で大ガード(+12)。",
    diceModifiers: [
      {
        faces: [1, 2, 3],
        effect: { guard: 12 },
        description: "3以下: ガード+12",
      },
    ],
  },
  {
    id: "mirror_edge",
    name: "鏡写しの剣",
    rarity: "epic",
    slot: "weapon",
    equipTag: "light",
    signature: true,
    attack: 7,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 15,
    description: "【固有】攻撃力+7。出目1のミスを通常攻撃に変える。",
    diceModifiers: [
      {
        faces: [1],
        effect: { kind: "normal", damageMultiplier: 1, isMiss: false },
        label: "反射",
        description: "1: ミス → 通常攻撃",
      },
    ],
  },
  {
    id: "berserker_cleaver",
    name: "狂戦士の大斧",
    rarity: "legendary",
    slot: "weapon",
    equipTag: "heavy",
    signature: true,
    attack: 12,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 16,
    description: "【固有】攻撃力+12。1〜2で自傷、5以上で超特大ダメージ。",
    diceModifiers: [
      {
        faces: [1, 2],
        effect: { kind: "selfDamage", damageMultiplier: 0, selfDamagePct: 0.25, isMiss: false },
        label: "自傷",
        description: "1〜2: 自分にダメージ",
      },
      {
        faces: [5, 6],
        effect: { kind: "critical", damageMultiplier: 3.2 },
        label: "狂乱",
        description: "5以上: 超特大ダメージ",
      },
    ],
  },
  {
    id: "inferno_glaive",
    name: "獄炎の薙刀",
    rarity: "legendary",
    slot: "weapon",
    equipTag: "heavy",
    signature: true,
    attack: 11,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 17,
    description: "【固有】攻撃力+11。4以上で獄炎(強烈な燃焼・4T)を付与。",
    diceModifiers: [
      {
        faces: [4, 5, 6],
        effect: {
          kind: "fireball",
          statusEffect: { kind: "burn", damagePerTurnMultiplier: 0.65, turns: 4 },
        },
        label: "獄炎",
        description: "4以上: 燃焼を付与 (4T)",
      },
    ],
  },
  {
    id: "soul_reaver",
    name: "魂喰らいの鎌",
    rarity: "legendary",
    slot: "weapon",
    equipTag: "heavy",
    signature: true,
    attack: 10,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 18,
    description: "【固有】攻撃力+10。4以上で与ダメージの40%回復。",
    diceModifiers: [
      {
        faces: [4, 5, 6],
        effect: { lifestealPct: 0.4 },
        description: "4以上: 与ダメージ40%回復",
      },
    ],
  },
  {
    id: "doom_bringer",
    name: "終焉をもたらす者",
    rarity: "cursed",
    slot: "weapon",
    equipTag: "heavy",
    signature: true,
    attack: 14,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 22,
    description: "【固有】攻撃力+14。1で大きく自傷、6で超特大ダメージ＋スタン。",
    diceModifiers: [
      {
        faces: [1],
        effect: { kind: "selfDamage", damageMultiplier: 0, selfDamagePct: 0.3, isMiss: false },
        label: "自傷",
        description: "1: 自分に大ダメージ",
      },
      {
        faces: [6],
        effect: { kind: "critical", damageMultiplier: 3.5, stun: 1 },
        label: "終焉",
        description: "6: 超特大ダメージ＋スタン",
      },
    ],
  },

  // ===== armor =====
  {
    id: "leather_armor",
    name: "革の鎧",
    rarity: "common",
    slot: "armor",
    equipTag: "light",
    attack: 0,
    defense: 2,
    maxHp: 0,
    rerollModifier: 0,
    description: "防御+2。軽くて動きやすい。",
    diceModifiers: [],
  },
  {
    id: "iron_armor",
    name: "鉄の鎧",
    rarity: "rare",
    slot: "armor",
    equipTag: "heavy",
    attack: 0,
    defense: 5,
    maxHp: 5,
    rerollModifier: 0,
    description: "防御+5。3以下でガード(防御バフ)。",
    diceModifiers: [
      {
        faces: [1, 2, 3],
        effect: { guard: 6 },
        description: "3以下: ガード+6",
      },
    ],
  },
  {
    id: "heavy_armor",
    name: "重装鎧",
    rarity: "epic",
    slot: "armor",
    equipTag: "heavy",
    signature: true,
    attack: 0,
    defense: 13,
    maxHp: 22,
    rerollModifier: -1,
    minFloor: 7,
    description: "【固有】防御+13 / HP+22、リロール-1。1〜3でもガード効果。",
    diceModifiers: [
      {
        faces: [1, 2, 3],
        effect: { guard: 10 },
        description: "1〜3: ガード+10",
      },
    ],
  },

  // ===== signature helm / gloves / boots (固有6部位を成立させるための名前付き防具) =====
  {
    id: "sentinel_helm",
    name: "番人の兜",
    rarity: "epic",
    slot: "helm",
    equipTag: "heavy",
    signature: true,
    attack: 0,
    defense: 8,
    maxHp: 22,
    rerollModifier: 0,
    minFloor: 12,
    description: "【固有】防+8 / HP+22。揺るがぬ守りの兜。",
    diceModifiers: [],
  },
  {
    id: "duelist_gloves",
    name: "決闘者の篭手",
    rarity: "epic",
    slot: "gloves",
    equipTag: "light",
    signature: true,
    attack: 6,
    defense: 4,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 12,
    description: "【固有】攻+6 / 防+4。手数を支える篭手。",
    diceModifiers: [],
  },
  {
    id: "windstep_boots",
    name: "疾風の脚甲",
    rarity: "epic",
    slot: "boots",
    equipTag: "light",
    signature: true,
    attack: 0,
    defense: 6,
    maxHp: 18,
    rerollModifier: 1,
    minFloor: 12,
    description: "【固有】防+6 / HP+18、リロール+1。風を駆ける脚甲。",
    diceModifiers: [],
  },

  {
    id: "antibody_robe",
    name: "抗体のローブ",
    rarity: "epic",
    slot: "armor",
    equipTag: "light",
    attack: 0,
    defense: 2,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 7,
    poisonResist: 0.35,
    stunResist: 0.2,
    volatile: true,
    description: "防御は低いが毒35%・麻痺20%軽減。性能のブレが大きい。",
    diceModifiers: [],
  },

  // ===== accessory =====
  {
    id: "lucky_ring",
    name: "幸運の指輪",
    rarity: "rare",
    slot: "accessory",
    attack: 0,
    defense: 0,
    maxHp: 0,
    rerollModifier: 1,
    description: "リロール+1。運を手繰り寄せる。",
    diceModifiers: [],
  },
  {
    id: "gambler_ring",
    name: "賭博師の指輪",
    rarity: "epic",
    slot: "accessory",
    signature: true,
    attack: 4,
    defense: 0,
    maxHp: 12,
    rerollModifier: 0,
    description: "【固有】攻+4 / HP+12。1で自傷、6で超火力。一か八か。",
    diceModifiers: [
      {
        faces: [1],
        effect: { kind: "selfDamage", damageMultiplier: 0, selfDamagePct: 0.5, isMiss: false },
        label: "自傷",
        description: "1: 大きく自傷",
      },
      {
        faces: [6],
        effect: { kind: "critical", damageMultiplier: 3.5 },
        label: "超火力",
        description: "6: 超火力",
      },
    ],
  },
  {
    id: "grimoire",
    name: "魔導書",
    rarity: "rare",
    slot: "accessory",
    attack: 0,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    description: "6を火球スキルに変更。",
    diceModifiers: [
      {
        faces: [6],
        effect: { kind: "fireball", damageMultiplier: 2.6 },
        label: "火球",
        description: "6: 火球スキル",
      },
    ],
  },

  {
    id: "antidote_charm",
    name: "抗毒の護符",
    rarity: "rare",
    slot: "accessory",
    attack: 0,
    defense: 0,
    maxHp: 3,
    rerollModifier: 0,
    minFloor: 6,
    poisonResist: 0.5,
    volatile: true,
    description: "基礎性能は低いが毒を50%軽減。ブレが大きい。",
    diceModifiers: [],
  },
  {
    id: "ward_ring",
    name: "耐雷の指輪",
    rarity: "rare",
    slot: "accessory",
    attack: 0,
    defense: 0,
    maxHp: 2,
    rerollModifier: 0,
    minFloor: 8,
    stunResist: 0.5,
    volatile: true,
    description: "基礎性能は低いが麻痺を50%の確率で無効。ブレが大きい。",
    diceModifiers: [],
  },

  // ===== gacha-exclusive (never drops from enemies) =====
  {
    id: "dragon_slayer",
    name: "竜殺しの大剣",
    rarity: "legendary",
    slot: "weapon",
    equipTag: "heavy",
    attack: 8,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    gachaOnly: true,
    description: "【限定】攻撃力+8。1のミスを通常攻撃に、4以上で2回攻撃。",
    diceModifiers: [
      {
        faces: [1],
        effect: { kind: "normal", damageMultiplier: 1, isMiss: false },
        label: "通常攻撃",
        description: "1: ミス → 通常攻撃",
      },
      {
        faces: [4, 5, 6],
        effect: { extraHits: 1 },
        description: "4以上: 2回攻撃",
      },
    ],
  },
  {
    id: "fortune_amulet",
    name: "幸運の護符",
    rarity: "epic",
    slot: "accessory",
    attack: 0,
    defense: 0,
    maxHp: 8,
    rerollModifier: 2,
    gachaOnly: true,
    description: "【限定】HP+8、リロール+2。引き直しの鬼。",
    diceModifiers: [],
  },

  // ===== casino-exclusive prizes (only from the casino) =====
  {
    id: "golden_die",
    name: "黄金のダイス",
    rarity: "legendary",
    slot: "weapon",
    attack: 6,
    defense: 0,
    maxHp: 0,
    rerollModifier: 1,
    casinoOnly: true,
    description: "【カジノ景品】攻撃力+6、リロール+1。1〜2を強攻撃に変える。",
    diceModifiers: [
      {
        faces: [1, 2],
        effect: { kind: "strong", damageMultiplier: 1.5, isMiss: false },
        label: "強攻撃",
        description: "1〜2: 強攻撃",
      },
    ],
  },
  {
    id: "gamblers_crown",
    name: "賭博王の王冠",
    rarity: "legendary",
    slot: "accessory",
    attack: 0,
    defense: 0,
    maxHp: 12,
    rerollModifier: 1,
    casinoOnly: true,
    description: "【カジノ景品】HP+12、リロール+1。6で超火力。",
    diceModifiers: [
      {
        faces: [6],
        effect: { kind: "critical", damageMultiplier: 3.5 },
        label: "超火力",
        description: "6: 超火力",
      },
    ],
  },

  // ===== build-defining uniques (droppable; reshape the whole dice table) =====
  {
    id: "berserker_greatsword",
    name: "狂戦の大剣",
    rarity: "legendary",
    slot: "weapon",
    equipTag: "heavy",
    signature: true,
    attack: 24,
    defense: 0,
    maxHp: 0,
    rerollModifier: -1,
    minFloor: 20,
    description: "【固有】攻+24、リロール-1。全出目が強攻撃になるが反動で自傷する。",
    diceModifiers: [
      {
        faces: [1, 2, 3, 4, 5, 6],
        effect: { kind: "strong", damageMultiplier: 1.6, isMiss: false, selfDamagePct: 0.08 },
        label: "強攻撃",
        description: "全出目: 強攻撃 (反動8%)",
      },
    ],
  },
  {
    id: "fate_blade",
    name: "運命の片刃",
    rarity: "legendary",
    slot: "weapon",
    equipTag: "light",
    signature: true,
    attack: 14,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 18,
    description: "【固有】攻+14。偶数の出目が会心、奇数は小攻撃になる。",
    diceModifiers: [
      {
        faces: [1, 3, 5],
        effect: { kind: "small", damageMultiplier: 0.5, isMiss: false },
        label: "小攻撃",
        description: "奇数: 小攻撃",
      },
      {
        faces: [2, 4, 6],
        effect: { kind: "critical", damageMultiplier: 2.2, isMiss: false },
        label: "会心",
        description: "偶数: 会心",
      },
    ],
  },
  {
    id: "reapers_scythe",
    name: "死神の大鎌",
    rarity: "legendary",
    slot: "weapon",
    equipTag: "heavy",
    signature: true,
    attack: 18,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 30,
    description: "【固有】攻+18。6で会心の2連撃。",
    diceModifiers: [
      {
        faces: [6],
        effect: { kind: "critical", damageMultiplier: 3.0, extraHits: 1 },
        label: "処刑",
        description: "6: 会心2連撃",
      },
    ],
  },
  {
    id: "plague_censer",
    name: "疫病の香炉",
    rarity: "epic",
    slot: "weapon",
    equipTag: "magic",
    signature: true,
    attack: 10,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 14,
    description: "【固有】攻+10。3以上で猛毒を付与する。",
    diceModifiers: [
      {
        faces: [3, 4, 5, 6],
        // DoT延命: 継続ダメージ倍率を 0.25→0.35 に強化。
        effect: { statusEffect: { kind: "poison", damagePerTurnMultiplier: 0.35, turns: 3 } },
        description: "3以上: 猛毒 (3T)",
      },
    ],
  },
  {
    id: "storm_rod",
    name: "雷霆の杖",
    rarity: "legendary",
    slot: "weapon",
    equipTag: "magic",
    signature: true,
    attack: 12,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 24,
    description: "【固有】攻+12。5でスタン、6で火球。",
    diceModifiers: [
      {
        faces: [5],
        effect: { kind: "stun", stun: 1, damageMultiplier: 1.0, isMiss: false },
        label: "麻痺",
        description: "5: スタン",
      },
      {
        faces: [6],
        effect: { kind: "fireball", damageMultiplier: 3.0 },
        label: "火球",
        description: "6: 火球",
      },
    ],
  },
  {
    id: "fates_dice",
    name: "運命のダイス",
    rarity: "legendary",
    slot: "accessory",
    signature: true,
    attack: 0,
    defense: 4,
    maxHp: 24,
    rerollModifier: 2,
    minFloor: 16,
    description: "【固有】防+4 / HP+24、リロール+2。1の目を通常攻撃に変える。",
    diceModifiers: [
      {
        faces: [1],
        effect: { kind: "normal", damageMultiplier: 1.0, isMiss: false },
        label: "通常",
        description: "1: 通常攻撃",
      },
    ],
  },
  {
    id: "guardian_aegis",
    name: "守護の盟約",
    rarity: "legendary",
    slot: "armor",
    equipTag: "heavy",
    signature: true,
    attack: 0,
    defense: 12,
    maxHp: 50,
    rerollModifier: 0,
    minFloor: 22,
    description: "【固有】防+12、HP+50。1〜3で大ガード＋回復。",
    diceModifiers: [
      {
        faces: [1, 2, 3],
        effect: { kind: "defend", guard: 12, lifestealPct: 0.1, isMiss: false },
        label: "鉄壁",
        description: "1〜3: 大ガード＋回復",
      },
    ],
  },
];

// ===== generated progression items (weak → strong, floor-gated) =====
// A broad pool of plain stat items so drops scale with depth and the
// collection has ~200 entries. Signature items above carry the dice effects.

const MATERIALS = [
  "木", "銅", "青銅", "鉄", "鋼", "銀", "金剛", "ミスリル", "アダマント", "竜骨", "星鉄", "神鉄",
];
const WEAPON_NOUNS = ["短剣", "剣", "槍", "斧", "大剣", "杖"];
const HELM_NOUNS = ["帽子", "兜", "鉢金", "面甲", "頭巾"];
const ARMOR_NOUNS = ["布鎧", "革鎧", "鎖鎧", "板鎧", "重鎧"];
const GLOVE_NOUNS = ["手袋", "篭手", "拳甲", "腕輪", "指甲"];
const BOOT_NOUNS = ["靴", "革靴", "鉄靴", "軍靴", "脚甲"];
const ACC_NOUNS = ["指輪", "首飾り", "護符", "宝珠", "耳飾り"];

const WEAPON_TAG: Record<string, EquipTag> = {
  短剣: "light", 剣: "light", 槍: "heavy", 斧: "heavy", 大剣: "heavy", 杖: "magic",
};
const ARMOR_TAG: Record<string, EquipTag> = {
  布鎧: "magic", 革鎧: "light", 鎖鎧: "heavy", 板鎧: "heavy", 重鎧: "heavy",
};

/** The six defensive/utility slots and the noun list each one draws from. */
const SLOT_NOUNS: Record<EquipmentSlot, string[]> = {
  weapon: WEAPON_NOUNS,
  helm: HELM_NOUNS,
  armor: ARMOR_NOUNS,
  gloves: GLOVE_NOUNS,
  boots: BOOT_NOUNS,
  accessory: ACC_NOUNS,
  emblem: ["紋章", "紋章", "エンブレム", "紋章"],
};

export function rarityForTier(t: number): Rarity {
  if (t <= 15) return "common";
  if (t <= 30) return "rare";
  if (t <= 45) return "epic";
  return "legendary";
}

/** The six equipment slots, in display order. */
export const SLOT_LIST: EquipmentSlot[] = [
  "weapon",
  "helm",
  "armor",
  "gloves",
  "boots",
  "accessory",
];

/** Top base tier referenced for the unique weapon's stat anchor. */
export const GEN_MAX_TIER = 60;

/** Material name for a tier — extends past the base list for infinite depth. */
function materialFor(t: number): string {
  const idx = Math.floor((t - 1) / 5);
  if (idx < MATERIALS.length) return MATERIALS[idx];
  // Deep tiers keep producing distinct names beyond the base materials.
  return `${MATERIALS[MATERIALS.length - 1]}・改${idx - MATERIALS.length + 1}`;
}

/**
 * Procedurally build a "plain" stat item for a slot/tier. These are NEVER stored
 * in a registry — the id (`gen_<slot>_<tier>`) is enough to reconstruct them, so
 * the entity count stays flat no matter how many slots, sets, or floors exist.
 * Tiers are UNBOUNDED, so gear scales infinitely with depth.
 */
export function genItem(slot: EquipmentSlot, tier: number): Equipment {
  const t = Math.max(1, Math.round(tier));
  const noun = SLOT_NOUNS[slot][(t - 1) % SLOT_NOUNS[slot].length];
  const mat = materialFor(t);
  const item: Equipment = {
    id: `gen_${slot}_${t}`,
    name: `${mat}の${noun}`,
    rarity: rarityForTier(t),
    slot,
    attack: 0,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    description: "",
    diceModifiers: [],
    minFloor: t,
  };
  if (slot === "weapon") {
    item.attack = Math.round(2 + t * 0.9);
    item.equipTag = WEAPON_TAG[noun];
    item.description = `攻撃+${item.attack}`;
  } else if (slot === "armor") {
    item.defense = Math.round(1 + t * 0.7);
    item.maxHp = Math.round(t * 1.5);
    item.equipTag = ARMOR_TAG[noun];
    item.description = `防御+${item.defense} / HP+${item.maxHp}`;
  } else if (slot === "helm") {
    item.defense = Math.round(1 + t * 0.4);
    item.maxHp = Math.round(t * 1.1);
    item.equipTag = t % 2 === 0 ? "heavy" : "light";
    item.description = `防御+${item.defense} / HP+${item.maxHp}`;
  } else if (slot === "gloves") {
    item.attack = Math.round(t * 0.35);
    item.defense = Math.round(1 + t * 0.3);
    item.equipTag = "light";
    item.description = `攻+${item.attack} / 防+${item.defense}`;
  } else if (slot === "boots") {
    item.defense = Math.round(1 + t * 0.35);
    item.maxHp = Math.round(t * 0.9);
    item.equipTag = "light";
    item.description = `防御+${item.defense} / HP+${item.maxHp}`;
  } else {
    item.maxHp = Math.round(t * 1.2);
    item.attack = Math.round(t * 0.3);
    item.defense = Math.round(t * 0.3);
    if (t % 8 === 0) item.rerollModifier = 1;
    item.description =
      `HP+${item.maxHp} / 攻+${item.attack} / 防+${item.defense}` +
      (item.rerollModifier ? ` / リロール+${item.rerollModifier}` : "");
  }
  return item;
}

/**
 * 紋章(emblem)を生成する。3000階+のボスからのみドロップする上位部位。
 * セット効果の数値を深層ほど増幅する setAmplifier を持つ（倍率は装備時に階層から算出）。
 * ベースステは accessory 相当（genItem の汎用分岐）＋レジェ確定で品質ロールにも乗る。
 */
export function genEmblem(floor: number): Equipment {
  const t = genTierForFloor(floor);
  const base = genItem("emblem", t);
  return {
    ...base,
    id: `emblem_${t}`,
    name: `共鳴の紋章`,
    rarity: "legendary",
    equipTag: undefined, // どのジョブでも装備可
    setAmplifier: true,
    minFloor: 3000,
    description: `${base.description} ／ セット効果の数値を深層ほど増幅`,
  };
}

const randInt = (lo: number, hi: number) =>
  lo + Math.floor(Math.random() * (hi - lo + 1));

/** The base tier appropriate for a floor (unbounded — gear scales forever). */
export function genTierForFloor(floor: number): number {
  return Math.max(1, floor);
}

/** Parse a procedural id back into its slot + tier (null if not a gen id). */
export function parseGenId(id: string): { slot: EquipmentSlot; tier: number } | null {
  const m = /^gen_([a-z]+)_(\d+)$/.exec(id);
  if (!m) return null;
  const slot = m[1] as EquipmentSlot;
  if (!SLOT_LIST.includes(slot)) return null;
  return { slot, tier: Number(m[2]) };
}

/** Tier range (inclusive) for a rarity band, clamped to a max tier. */
function bandRange(band: Rarity, maxTier: number): [number, number] {
  const ranges: Partial<Record<Rarity, [number, number]>> = {
    common: [1, 15],
    rare: [16, 30],
    epic: [31, 45],
    legendary: [46, GEN_MAX_TIER],
  };
  const [lo, hi] = ranges[band] ?? [1, GEN_MAX_TIER];
  return [Math.min(lo, maxTier), Math.min(hi, maxTier)];
}

/**
 * Roll a floor-appropriate procedural drop. `rareBias` (0+) nudges the tier
 * upward (= rarer). `slot` forces a slot (used for "smart drops").
 */
export function rollGenDrop(floor: number, rareBias = 0, slot?: EquipmentSlot): Equipment {
  const top = genTierForFloor(floor);
  const lo = Math.max(1, top - 15);
  let tier = randInt(lo, top);
  // Difficulty/boss rare bias: chance to pull the tier toward the top band.
  if (Math.random() < Math.min(0.6, rareBias / 60)) tier = randInt(Math.max(lo, top - 4), top);
  return genItem(slot ?? SLOT_LIST[randInt(0, SLOT_LIST.length - 1)], tier);
}

/** A plain Common procedural item (the 10/100 gacha). */
export function genCommon(): Equipment {
  const [lo, hi] = bandRange("common", GEN_MAX_TIER);
  return genItem(SLOT_LIST[randInt(0, SLOT_LIST.length - 1)], randInt(lo, hi));
}

/** A Rare-or-above procedural item of a given slot (the 250 targeted gacha). */
export function genRarePlus(slot: EquipmentSlot): Equipment {
  // Tiers 16+ are Rare/Epic/Legendary; bias toward the middle for fairness.
  const tier = randInt(16, GEN_MAX_TIER);
  return genItem(slot, tier);
}

/** Rough power tier of any item (for "pull near my current best" gacha). */
export function estimateTier(item: Equipment): number {
  const parsed = parseGenId(item.id);
  if (parsed) return parsed.tier;
  const sp = parseSetPieceId(item.id);
  if (sp) return sp.tier;
  // Signature/other: estimate from raw numbers.
  return Math.max(
    1,
    Math.round(item.attack / 0.9),
    Math.round(item.defense / 0.7),
    Math.round(item.maxHp / 1.5),
  );
}

/**
 * A Rare+ item of a slot, scaled to sit AROUND a reference tier (the player's
 * current best for that slot) so targeted pulls are a meaningful side/up-grade
 * instead of a random low roll. Returns the item already ★-modified.
 */
export function genRarePlusNear(slot: EquipmentSlot, refTier: number, refMod: number): Equipment {
  const tier = Math.max(16, Math.min(GEN_MAX_TIER, Math.round(refTier) + randInt(-3, 4)));
  const base = genItem(slot, tier);
  const mod = Math.max(0, Math.round(refMod) + randInt(-1, 1));
  return mod > 0 ? applyModifier(base, mod) : base;
}

// ===== Set items (tiered & infinite) =====
// Set pieces are generated procedurally and tiered, so they scale with depth
// forever. The set itself (named or procedural) is resolved via getSetDef.
const SET_SLOT_NOUN: Record<EquipmentSlot, string> = {
  weapon: "刃", helm: "兜", armor: "鎧", gloves: "篭手", boots: "靴", accessory: "印", emblem: "紋章",
};
const SET_SLOT_TAG: Record<EquipmentSlot, EquipTag | undefined> = {
  weapon: "light", helm: "heavy", armor: "heavy", gloves: "light", boots: "light", accessory: undefined, emblem: undefined,
};

/** Stable id for a set piece (key + slot + tier), reconstructable on load. */
export function setPieceId(key: string, slot: EquipmentSlot, tier: number): string {
  return `setp_${key}_${slot}_${Math.max(1, Math.round(tier))}`;
}

export function parseSetPieceId(
  id: string,
): { key: string; slot: EquipmentSlot; tier: number } | null {
  const m = /^setp_([a-z0-9]+)_([a-z]+)_(\d+)$/.exec(id);
  if (!m) return null;
  const slot = m[2] as EquipmentSlot;
  if (!SLOT_LIST.includes(slot)) return null;
  return { key: m[1], slot, tier: Number(m[3]) };
}

/** Build a tiered set piece for a set key / slot / tier. */
export function genSetItem(key: string, slot: EquipmentSlot, tier: number): Equipment {
  const t = Math.max(1, Math.round(tier));
  const def = getSetDef(key);
  const name = def ? def.name : "謎";
  const isWeapon = slot === "weapon";
  const isAcc = slot === "accessory";
  return {
    id: setPieceId(key, slot, t),
    name: `${name}の${SET_SLOT_NOUN[slot]}`,
    rarity: t > 60 ? "legendary" : "epic",
    slot,
    attack: isWeapon ? Math.round(6 + t * 0.85) : isAcc ? Math.round(2 + t * 0.35) : Math.round(t * 0.4),
    defense: isWeapon ? 0 : Math.round(2 + t * 0.55),
    maxHp: isWeapon ? 0 : Math.round(6 + t * 1.1),
    rerollModifier: 0,
    description: `${name}セット装備`,
    diceModifiers: [],
    setId: key,
    equipTag: SET_SLOT_TAG[slot],
    minFloor: t,
  };
}

/** Roll a floor-appropriate set piece (random available set + slot + tier). */
export function rollSetDrop(floor: number): Equipment {
  const keys = availableSetKeys(floor);
  const key = keys.length ? keys[randInt(0, keys.length - 1)] : "gambler";
  const slot = SLOT_LIST[randInt(0, SLOT_LIST.length - 1)];
  const top = genTierForFloor(floor);
  return genSetItem(key, slot, randInt(Math.max(1, top - 10), top));
}

// ===== 神機マキナ (the one-and-only unique weapon) =====
// Granted only by the 1000F ending (YES route) or by reaching floor 1250 (NO
// route). Every face becomes a plain normal attack ("Complete").
// 全出目が通常攻撃(×1.0)で会心・追撃・特大火球を一切持たないぶん、ベース攻撃を
// 大きく(約3倍)盛る。高倍率が無いので壊れず、「事故らない安定火力」に全振りした
// 最終武器という位置づけ。
const MAKINA_ATTACK_MULT = 3;
function makinaAttackValue(): number {
  // 最強ベース武器(最上位ティア)の92% × 安定特化ボーナス。
  const strongest = genItem("weapon", GEN_MAX_TIER).attack;
  return Math.round(strongest * 0.92 * MAKINA_ATTACK_MULT);
}

export const MAKINA_ID = "makina_god";

export function makeMakina(): Equipment {
  const normalAll = {
    faces: [1, 2, 3, 4, 5, 6] as DiceValue[],
    effect: {
      kind: "normal" as const,
      isMiss: false,
      damageMultiplier: 1.0,
      selfDamagePct: 0,
      extraHits: 0,
      guard: 0,
      lifestealPct: 0,
    },
    label: "通常",
    description: "Complete: 全ての出目が通常攻撃になる",
  };
  return {
    id: MAKINA_ID,
    name: "神機マキナ",
    rarity: "legendary",
    quality: "unique",
    slot: "weapon",
    attack: makinaAttackValue(),
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    description:
      "終わりを見届けた者だけが手にすることを許された武器。何度失われても、必ずここへ帰ってくる。最強ではない。ただ、もう迷う必要はない。",
    diceModifiers: [normalAll],
    unique: true,
    noSell: true,
    noModifier: true,
    equipTag: "light",
  };
}

/**
 * Curated registry: hand-made signature items only. Procedural "gen_*" stat gear
 * and "setp_*" set gear are reconstructed on demand (see getItemById), so adding
 * slots, sets, or going deeper never grows this array. This is what the codex
 * tracks as individually-collectible.
 */
export const ITEMS: readonly Equipment[] = [...SIGNATURE_ITEMS];

/**
 * 固有(signature)武器の id 一覧。カジノコイン交換所などで「固有武器を1つ付与」する
 * 抽選母集団に使う。神機マキナ(unique)は通常入手から除外する。
 */
export const SIGNATURE_WEAPON_IDS: readonly string[] = SIGNATURE_ITEMS.filter(
  (i) => i.signature && i.slot === "weapon" && !i.unique,
).map((i) => i.id);

const ITEM_MAP: Map<string, Equipment> = new Map(ITEMS.map((i) => [i.id, i]));

/** Get a fresh copy of an item by id, or null if unknown. */
export function getItemById(id: string): Equipment | null {
  if (id === MAKINA_ID) return makeMakina();
  const gen = parseGenId(id);
  if (gen) return genItem(gen.slot, gen.tier);
  const setp = parseSetPieceId(id);
  if (setp) return genSetItem(setp.key, setp.slot, setp.tier);
  const item = ITEM_MAP.get(id);
  return item ? { ...item } : null;
}

/** Rehydrate an item instance from a base id plus optional affix + ★ tier + quality. */
export function getItemInstance(
  id: string,
  affixId?: string,
  modTier?: number,
  quality?: Quality,
  forgeLevel?: number,
  forgeStreak?: number,
): Equipment | null {
  const base = getItemById(id);
  if (!base) return null;
  // 神機マキナ is fixed — never re-rolls affix/modifier/quality.
  if (base.unique) return base;
  let item = base;
  if (affixId) {
    const affix = getAffixById(affixId);
    if (affix) item = applyAffix(base, affix);
  }
  if (modTier && modTier > 0 && !item.noModifier) item = applyModifier(item, modTier);
  if (quality) item = applyQuality(item, quality);
  if (forgeLevel && forgeLevel > 0) item = applyForge(item, forgeLevel);
  if (forgeStreak) item = { ...item, forgeStreak };
  return item;
}

export const STARTER_WEAPON_ID = "rusty_sword";
