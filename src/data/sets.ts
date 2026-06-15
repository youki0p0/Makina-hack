// ===== Set items (infinite) =====
// Sets are build-defining. The four named sets are hand-tuned; beyond them,
// DEEPER sets are generated procedurally (forever) from a pool of bonus
// primitives, so set variety never runs out. Set GEAR is also tiered, so set
// pieces scale infinitely with depth (see genSetItem in data/items.ts).

import type {
  DiceModifier,
  Equipment,
  EquipmentSlot,
  EquippedItems,
  StatBonus,
} from "@/types/game";
import { EQUIP_SLOTS } from "@/lib/battle";

/** One tier (2/4/6 pieces) of a set bonus, expressed as effect primitives. */
export interface SetTierBonus {
  pieces: 2 | 4 | 6;
  desc: string;
  reroll?: number;
  lifestealAllPct?: number;
  lifestealHighFacePct?: number;
  highFaceDmgBonus?: number;
  sixDmgBonus?: number;
  extraHit?: boolean;
  executePct?: number;
  healOnReroll?: number;
  sixDouble?: boolean;
  rollTwoDice?: boolean;
  faceOneToTwo?: boolean;
  attack?: number;
  defense?: number;
  maxHp?: number;
}

export interface SetDef {
  key: string;
  name: string;
  icon: string;
  /** Whether this is a procedurally-generated (deep) set. */
  procedural?: boolean;
  bonuses: SetTierBonus[];
}

/** The four hand-tuned signature sets. */
export const SET_DEFS: readonly SetDef[] = [
  {
    key: "gambler",
    name: "賭博師",
    icon: "🎲",
    bonuses: [
      { pieces: 2, desc: "リロール +1", reroll: 1 },
      { pieces: 4, desc: "出目1が2(通常攻撃)になる", faceOneToTwo: true },
      { pieces: 6, desc: "出目6が2回発動する", sixDouble: true },
    ],
  },
  {
    key: "vampire",
    name: "吸血鬼",
    icon: "🦇",
    bonuses: [
      { pieces: 2, desc: "与ダメージの10%を吸血", lifestealAllPct: 0.1 },
      { pieces: 4, desc: "出目4以上で追加吸血(+15%)", lifestealHighFacePct: 0.15 },
      { pieces: 6, desc: "全ての攻撃が30%吸血", lifestealAllPct: 0.3 },
    ],
  },
  {
    key: "executioner",
    name: "処刑人",
    icon: "🪓",
    bonuses: [
      { pieces: 2, desc: "出目5・6の威力上昇(+30%)", highFaceDmgBonus: 0.3 },
      { pieces: 4, desc: "攻撃時に追撃(+1ヒット)", extraHit: true },
      { pieces: 6, desc: "敵HP15%以下を即死", executePct: 0.15 },
    ],
  },
  {
    key: "oracle",
    name: "神託",
    icon: "🔮",
    bonuses: [
      { pieces: 2, desc: "リロール時にHP回復", healOnReroll: 6 },
      { pieces: 4, desc: "出目6の威力上昇(+60%)", sixDmgBonus: 0.6 },
      { pieces: 6, desc: "ダイスを2個振り、高い方を使う", rollTwoDice: true },
    ],
  },
];

const FIXED_BY_KEY: Record<string, SetDef> = Object.fromEntries(
  SET_DEFS.map((s) => [s.key, s]),
);
/** Back-compat alias used by some UI. */
export const SET_BY_ID = FIXED_BY_KEY;
export const SETS = SET_DEFS;

// ===== Procedural set generation (infinite) =====

/** Pool of bonus primitives a procedural set can roll (label + payload). */
const PRIMS: { make: () => Omit<SetTierBonus, "pieces"> }[] = [
  { make: () => ({ desc: "リロール +1", reroll: 1 }) },
  { make: () => ({ desc: "与ダメージの10%を吸血", lifestealAllPct: 0.1 }) },
  { make: () => ({ desc: "出目4以上で追加吸血(+15%)", lifestealHighFacePct: 0.15 }) },
  { make: () => ({ desc: "出目5・6の威力上昇(+30%)", highFaceDmgBonus: 0.3 }) },
  { make: () => ({ desc: "出目6の威力上昇(+60%)", sixDmgBonus: 0.6 }) },
  { make: () => ({ desc: "攻撃時に追撃(+1ヒット)", extraHit: true }) },
  { make: () => ({ desc: "リロール時にHP回復", healOnReroll: 6 }) },
  { make: () => ({ desc: "敵HP12%以下を即死", executePct: 0.12 }) },
  { make: () => ({ desc: "出目6が2回発動する", sixDouble: true }) },
  { make: () => ({ desc: "ダイスを2個振り高い方を使う", rollTwoDice: true }) },
  { make: () => ({ desc: "攻撃 +8", attack: 8 }) },
  { make: () => ({ desc: "防御 +8 / HP +20", defense: 8, maxHp: 20 }) },
];

const SET_ADJ = ["深淵", "星霜", "虚空", "業火", "氷晶", "雷鳴", "黄昏", "暁", "幽幻", "永劫"];
const SET_NOUN = ["狂宴", "盟約", "残響", "輪舞", "祭祀", "誓い", "黙示", "葬列", "讃歌", "刻印"];
const SET_ICONS = ["🜲", "✶", "❖", "☄", "⚜", "🩸", "⟡", "🔱", "🜂", "🝮"];

/** Deterministic procedural set for index n (n = 0,1,2,…, forever). */
export function proceduralSetDef(n: number): SetDef {
  const a = SET_ADJ[n % SET_ADJ.length];
  const b = SET_NOUN[Math.floor(n / SET_ADJ.length) % SET_NOUN.length];
  // Pick three distinct primitives deterministically from n.
  const picks: number[] = [];
  let k = (n * 7 + 3) % PRIMS.length;
  while (picks.length < 3) {
    if (!picks.includes(k)) picks.push(k);
    k = (k + 5 + n) % PRIMS.length;
  }
  const tiers: (2 | 4 | 6)[] = [2, 4, 6];
  return {
    key: `gset${n}`,
    name: `${a}の${b}`,
    icon: SET_ICONS[n % SET_ICONS.length],
    procedural: true,
    bonuses: picks.map((p, i) => ({ pieces: tiers[i], ...PRIMS[p].make() })),
  };
}

/** Resolve any set key (fixed or `gset<n>`) into its definition. */
export function getSetDef(key: string): SetDef | null {
  if (FIXED_BY_KEY[key]) return FIXED_BY_KEY[key];
  const m = /^gset(\d+)$/.exec(key);
  if (m) return proceduralSetDef(Number(m[1]));
  return null;
}

/** First floor a procedural set index becomes available (one per 150 floors). */
export function proceduralSetFloor(n: number): number {
  return 150 + n * 150;
}

/** All set keys obtainable at a floor: the 4 named + unlocked procedural sets. */
export function availableSetKeys(floor: number): string[] {
  const keys: string[] = [];
  // Named sets unlock by depth so early floors aren't overwhelmed.
  const namedFloor: Record<string, number> = {
    gambler: 30,
    vampire: 60,
    executioner: 90,
    oracle: 120,
  };
  for (const s of SET_DEFS) if (floor >= (namedFloor[s.key] ?? 1)) keys.push(s.key);
  for (let n = 0; proceduralSetFloor(n) <= floor; n++) keys.push(`gset${n}`);
  return keys;
}

// ===== Aggregate set effects =====

export interface SetEffects {
  statBonus: StatBonus;
  diceModifiers: DiceModifier[];
  lifestealAllPct: number;
  lifestealHighFacePct: number;
  highFaceDmgBonus: number;
  sixDmgBonus: number;
  extraHit: boolean;
  executePct: number;
  healOnReroll: number;
  sixDouble: boolean;
  rollTwoDice: boolean;
  activeTiers: { key: string; name: string; pieces: number; icon: string }[];
}

const EMPTY_BONUS: StatBonus = { attack: 0, defense: 0, maxHp: 0, reroll: 0 };

function gamblerFaceOneToTwo(): DiceModifier {
  return {
    faces: [1],
    effect: { kind: "normal", isMiss: false, damageMultiplier: 1.0 },
    label: "2",
    description: "セット: 1の目が2(通常攻撃)になる",
  };
}

/** Count equipped pieces per set and resolve the combined bonus effects. */
export function computeSetEffects(equipped: EquippedItems): SetEffects {
  const counts: Record<string, number> = {};
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

  for (const [key, n] of Object.entries(counts)) {
    if (n < 2) continue;
    const def = getSetDef(key);
    if (!def) continue;
    eff.activeTiers.push({ key, name: def.name, pieces: n, icon: def.icon });
    for (const b of def.bonuses) {
      if (n < b.pieces) continue;
      if (b.reroll) eff.statBonus.reroll += b.reroll;
      if (b.attack) eff.statBonus.attack += b.attack;
      if (b.defense) eff.statBonus.defense += b.defense;
      if (b.maxHp) eff.statBonus.maxHp += b.maxHp;
      if (b.lifestealAllPct) eff.lifestealAllPct = Math.max(eff.lifestealAllPct, b.lifestealAllPct);
      if (b.lifestealHighFacePct) eff.lifestealHighFacePct = Math.max(eff.lifestealHighFacePct, b.lifestealHighFacePct);
      if (b.highFaceDmgBonus) eff.highFaceDmgBonus = Math.max(eff.highFaceDmgBonus, b.highFaceDmgBonus);
      if (b.sixDmgBonus) eff.sixDmgBonus = Math.max(eff.sixDmgBonus, b.sixDmgBonus);
      if (b.executePct) eff.executePct = Math.max(eff.executePct, b.executePct);
      if (b.healOnReroll) eff.healOnReroll = Math.max(eff.healOnReroll, b.healOnReroll);
      if (b.extraHit) eff.extraHit = true;
      if (b.sixDouble) eff.sixDouble = true;
      if (b.rollTwoDice) eff.rollTwoDice = true;
      if (b.faceOneToTwo) eff.diceModifiers.push(gamblerFaceOneToTwo());
    }
  }

  return eff;
}
