import { applyAffix, getAffixById } from "@/data/affixes";
import { applyModifier } from "@/data/modifiers";
import { applyQuality } from "@/data/quality";
import { setPieceId } from "@/data/sets";
import type {
  DiceValue,
  EquipTag,
  Equipment,
  EquipmentSlot,
  Quality,
  Rarity,
  SetId,
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
    attack: 5,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 6,
    description: "攻撃力+5。4以上で与ダメージの25%回復。",
    diceModifiers: [
      {
        faces: [4, 5, 6],
        effect: { lifestealPct: 0.25 },
        description: "4以上: 与ダメージ25%回復",
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
    attack: 3,
    defense: 0,
    maxHp: 0,
    rerollModifier: 1,
    description: "攻撃力+3、リロール+1。2以上で毒を付与(継続ダメージ・累積)。",
    diceModifiers: [
      {
        faces: [2, 3, 4, 5, 6],
        effect: {
          statusEffect: { kind: "poison", damagePerTurnMultiplier: 0.2, turns: 4 },
        },
        description: "2以上: 毒を付与 (4T・累積)",
      },
    ],
  },
  {
    id: "flame_brand",
    name: "業火の剣",
    rarity: "legendary",
    slot: "weapon",
    equipTag: "heavy",
    attack: 6,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    minFloor: 8,
    description: "攻撃力+6。4以上で燃焼(強力な継続ダメージ)を付与。",
    diceModifiers: [
      {
        faces: [4, 5, 6],
        effect: {
          kind: "fireball",
          statusEffect: { kind: "burn", damagePerTurnMultiplier: 0.45, turns: 3 },
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
    attack: 5,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    description: "攻撃力+5。6で敵をスタン(1ターン行動不能)。",
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
    attack: 3,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    description: "攻撃力+3。2〜3で敵を弱体化(攻撃ダウン)。",
    diceModifiers: [
      {
        faces: [2, 3],
        effect: { kind: "weaken", weaken: 2 },
        label: "弱体化",
        description: "2〜3: 敵の攻撃-2",
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
    attack: 0,
    defense: 9,
    maxHp: 10,
    rerollModifier: -1,
    minFloor: 7,
    description: "防御+9、リロール-1。1〜3でもガード効果。",
    diceModifiers: [
      {
        faces: [1, 2, 3],
        effect: { guard: 10 },
        description: "1〜3: ガード+10",
      },
    ],
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
    attack: 0,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    description: "1で自傷、6で超火力。一か八か。",
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
};

function rarityForTier(t: number): Rarity {
  if (t <= 15) return "common";
  if (t <= 30) return "rare";
  if (t <= 45) return "epic";
  return "legendary";
}

function generatedItem(slot: EquipmentSlot, t: number, noun: string): Equipment {
  const mat = MATERIALS[Math.min(MATERIALS.length - 1, Math.floor((t - 1) / 5))];
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
    item.attack = Math.round(2 + t * 0.8);
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

function buildGenerated(): Equipment[] {
  const out: Equipment[] = [];
  const slots: EquipmentSlot[] = ["weapon", "helm", "armor", "gloves", "boots", "accessory"];
  for (let t = 1; t <= 61; t++) {
    for (const slot of slots) {
      const nouns = SLOT_NOUNS[slot];
      out.push(generatedItem(slot, t, nouns[(t - 1) % nouns.length]));
    }
  }
  return out;
}

// ===== Set items (4 sets × 6 slots) =====
const SET_SLOT_NOUN: Record<EquipmentSlot, string> = {
  weapon: "刃", helm: "兜", armor: "鎧", gloves: "篭手", boots: "靴", accessory: "印",
};
const SET_META: { id: SetId; name: string; minFloor: number; tag: EquipTag }[] = [
  { id: "gambler", name: "賭博師", minFloor: 30, tag: "light" },
  { id: "vampire", name: "吸血鬼", minFloor: 60, tag: "light" },
  { id: "executioner", name: "処刑人", minFloor: 90, tag: "heavy" },
  { id: "oracle", name: "神託", minFloor: 120, tag: "magic" },
];

function buildSetItems(): Equipment[] {
  const out: Equipment[] = [];
  const slots: EquipmentSlot[] = ["weapon", "helm", "armor", "gloves", "boots", "accessory"];
  for (const set of SET_META) {
    for (const slot of slots) {
      const isWeapon = slot === "weapon";
      const isAcc = slot === "accessory";
      out.push({
        id: setPieceId(set.id, slot),
        name: `${set.name}の${SET_SLOT_NOUN[slot]}`,
        rarity: "epic",
        slot,
        attack: isWeapon ? 14 : isAcc ? 5 : 4,
        defense: isWeapon ? 0 : 6,
        maxHp: isWeapon ? 0 : 14,
        rerollModifier: 0,
        description: `${set.name}セット装備`,
        diceModifiers: [],
        setId: set.id,
        equipTag: isAcc ? undefined : set.tag,
        minFloor: set.minFloor,
      });
    }
  }
  return out;
}

// ===== 神機マキナ (the one-and-only unique weapon) =====
// Granted only by the 1000F ending (YES route) or by reaching floor 1250 (NO
// route). Stats are 92% of the strongest droppable weapon; every face becomes a
// plain normal attack ("Complete").
function makinaAttackValue(): number {
  const strongest = Math.max(
    0,
    ...buildGenerated().filter((i) => i.slot === "weapon").map((i) => i.attack),
  );
  return Math.round(strongest * 0.92);
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

/** Full registry: signature + generated + set items. (神機マキナ is special.) */
export const ITEMS: readonly Equipment[] = [
  ...SIGNATURE_ITEMS,
  ...buildGenerated(),
  ...buildSetItems(),
];

const ITEM_MAP: Map<string, Equipment> = new Map(ITEMS.map((i) => [i.id, i]));

/** Get a fresh copy of an item by id, or null if unknown. */
export function getItemById(id: string): Equipment | null {
  if (id === MAKINA_ID) return makeMakina();
  const item = ITEM_MAP.get(id);
  return item ? { ...item } : null;
}

/** Rehydrate an item instance from a base id plus optional affix + ★ tier + quality. */
export function getItemInstance(
  id: string,
  affixId?: string,
  modTier?: number,
  quality?: Quality,
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
  return item;
}

export const STARTER_WEAPON_ID = "rusty_sword";
