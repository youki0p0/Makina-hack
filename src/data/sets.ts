// ===== Set items =====
// Dice Ex Machina's build-defining gear. Set bonuses aren't just numbers — they
// reshape how the dice play, unlocking at 2 / 4 / 6 equipped pieces.

import type {
  DiceModifier,
  Equipment,
  EquipmentSlot,
  EquippedItems,
  SetId,
  StatBonus,
} from "@/types/game";
import { EQUIP_SLOTS } from "@/lib/battle";

export interface SetBonusTier {
  pieces: 2 | 4 | 6;
  desc: string;
}

export interface SetDef {
  id: SetId;
  name: string;
  icon: string;
  bonuses: SetBonusTier[];
}

export const SETS: readonly SetDef[] = [
  {
    id: "gambler",
    name: "賭博師",
    icon: "🎲",
    bonuses: [
      { pieces: 2, desc: "リロール +1" },
      { pieces: 4, desc: "出目1が2として扱われる" },
      { pieces: 6, desc: "出目6が2回発動する" },
    ],
  },
  {
    id: "vampire",
    name: "吸血鬼",
    icon: "🦇",
    bonuses: [
      { pieces: 2, desc: "与ダメージの10%を吸血" },
      { pieces: 4, desc: "出目4以上で追加吸血(+15%)" },
      { pieces: 6, desc: "全ての攻撃が30%吸血" },
    ],
  },
  {
    id: "executioner",
    name: "処刑人",
    icon: "🪓",
    bonuses: [
      { pieces: 2, desc: "出目5・6の威力上昇(+30%)" },
      { pieces: 4, desc: "攻撃時に追撃(+1ヒット)" },
      { pieces: 6, desc: "敵HP15%以下を即死させる" },
    ],
  },
  {
    id: "oracle",
    name: "神託",
    icon: "🔮",
    bonuses: [
      { pieces: 2, desc: "リロール時にHP回復" },
      { pieces: 4, desc: "出目6の威力上昇(+60%)" },
      { pieces: 6, desc: "ダイスを2個振り、高い方を使う" },
    ],
  },
];

export const SET_BY_ID: Record<SetId, SetDef> = Object.fromEntries(
  SETS.map((s) => [s.id, s]),
) as Record<SetId, SetDef>;

/** Stable id for a given set's piece in a slot. */
export function setPieceId(setId: SetId, slot: EquipmentSlot): string {
  return `set_${setId}_${slot}`;
}

/** Combined, resolved set effects for the currently-equipped gear. */
export interface SetEffects {
  /** Stat bonuses (currently just reroll from gambler 2pc). */
  statBonus: StatBonus;
  /** Dice-face rewrites contributed by sets (e.g. gambler 1→2). */
  diceModifiers: DiceModifier[];
  /** Flat lifesteal fraction applied to ALL attack damage. */
  lifestealAllPct: number;
  /** Extra lifesteal on faces ≥ 4 (vampire 4pc). */
  lifestealHighFacePct: number;
  /** Bonus damage fraction on faces 5/6 (executioner 2pc). */
  highFaceDmgBonus: number;
  /** Bonus damage fraction on face 6 (oracle 4pc). */
  sixDmgBonus: number;
  /** Add one extra attack hit (executioner 4pc). */
  extraHit: boolean;
  /** Execute enemies at/below this HP fraction (executioner 6pc). */
  executePct: number;
  /** HP healed each reroll (oracle 2pc). */
  healOnReroll: number;
  /** Face 6 triggers twice (gambler 6pc). */
  sixDouble: boolean;
  /** Roll two dice and keep the higher (oracle 6pc). */
  rollTwoDice: boolean;
  /** Active tiers for the UI: which set, name, and piece count reached. */
  activeTiers: { id: SetId; name: string; pieces: number; icon: string }[];
}

const EMPTY_BONUS: StatBonus = { attack: 0, defense: 0, maxHp: 0, reroll: 0 };

function gamblerFaceOneToTwo(): DiceModifier {
  return {
    faces: [1],
    effect: { kind: "normal", isMiss: false, damageMultiplier: 1.0 },
    label: "2",
    description: "賭博師セット: 1の目が2(通常攻撃)になる",
  };
}

/** Count equipped pieces per set and resolve the combined bonus effects. */
export function computeSetEffects(equipped: EquippedItems): SetEffects {
  const counts: Partial<Record<SetId, number>> = {};
  for (const slot of EQUIP_SLOTS) {
    const it = equipped[slot];
    if (it?.setId) counts[it.setId] = (counts[it.setId] ?? 0) + 1;
  }

  const eff: SetEffects = {
    statBonus: { ...EMPTY_BONUS },
    diceModifiers: [],
    lifestealAllPct: 0,
    lifestealHighFacePct: 0,
    highFaceDmgBonus: 0,
    sixDmgBonus: 0,
    extraHit: false,
    executePct: 0,
    healOnReroll: 0,
    sixDouble: false,
    rollTwoDice: false,
    activeTiers: [],
  };

  for (const set of SETS) {
    const n = counts[set.id] ?? 0;
    if (n < 2) continue;
    eff.activeTiers.push({ id: set.id, name: set.name, pieces: n, icon: set.icon });

    if (set.id === "gambler") {
      if (n >= 2) eff.statBonus.reroll += 1;
      if (n >= 4) eff.diceModifiers.push(gamblerFaceOneToTwo());
      if (n >= 6) eff.sixDouble = true;
    } else if (set.id === "vampire") {
      if (n >= 2) eff.lifestealAllPct = Math.max(eff.lifestealAllPct, 0.1);
      if (n >= 4) eff.lifestealHighFacePct = 0.15;
      if (n >= 6) eff.lifestealAllPct = Math.max(eff.lifestealAllPct, 0.3);
    } else if (set.id === "executioner") {
      if (n >= 2) eff.highFaceDmgBonus = 0.3;
      if (n >= 4) eff.extraHit = true;
      if (n >= 6) eff.executePct = 0.15;
    } else if (set.id === "oracle") {
      if (n >= 2) eff.healOnReroll = 6;
      if (n >= 4) eff.sixDmgBonus = 0.6;
      if (n >= 6) eff.rollTwoDice = true;
    }
  }

  return eff;
}
