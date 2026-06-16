// ===== Set items (infinite) =====
// Sets are build-defining. The four named sets are hand-tuned; beyond them,
// DEEPER sets are generated procedurally (forever) from a pool of bonus
// primitives, so set variety never runs out. Set GEAR is also tiered, so set
// pieces scale infinitely with depth (see genSetItem in data/items.ts).

import type {
  ClassId,
  DiceModifier,
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
  {
    key: "guardian",
    name: "守護者",
    icon: "🛡️",
    bonuses: [
      { pieces: 2, desc: "防御+6 / HP+20", defense: 6, maxHp: 20 },
      { pieces: 4, desc: "HP+40", maxHp: 40 },
      { pieces: 6, desc: "全ての攻撃が15%吸血", lifestealAllPct: 0.15 },
    ],
  },
  {
    key: "storm",
    name: "雷迅",
    icon: "⚡",
    bonuses: [
      { pieces: 2, desc: "リロール +1", reroll: 1 },
      { pieces: 4, desc: "攻撃時に追撃(+1ヒット)", extraHit: true },
      { pieces: 6, desc: "出目5・6の威力上昇(+35%)", highFaceDmgBonus: 0.35 },
    ],
  },
  {
    key: "inferno",
    name: "業火",
    icon: "🔥",
    bonuses: [
      { pieces: 2, desc: "出目5・6の威力上昇(+30%)", highFaceDmgBonus: 0.3 },
      { pieces: 4, desc: "出目6の威力上昇(+50%)", sixDmgBonus: 0.5 },
      { pieces: 6, desc: "出目6が2回発動する", sixDouble: true },
    ],
  },
  {
    key: "revenant",
    name: "不死",
    icon: "☠️",
    bonuses: [
      { pieces: 2, desc: "HP+30", maxHp: 30 },
      { pieces: 4, desc: "出目4以上で追加吸血(+20%)", lifestealHighFacePct: 0.2 },
      { pieces: 6, desc: "全ての攻撃が25%吸血", lifestealAllPct: 0.25 },
    ],
  },
  {
    key: "trickster",
    name: "幻惑",
    icon: "🃏",
    bonuses: [
      { pieces: 2, desc: "リロール +1", reroll: 1 },
      { pieces: 4, desc: "出目1が2(通常攻撃)になる", faceOneToTwo: true },
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

// Procedural set definitions are rebuilt (loop over primitives) on each call, yet
// getSetDef runs several times per turn via computeSetEffects. Cache by key so the
// build happens once per unique set (#perf).
const setDefCache = new Map<string, SetDef | null>();
const SETDEF_CACHE_MAX = 128;

/** Resolve any set key (fixed or `gset<n>`) into its definition. */
export function getSetDef(key: string): SetDef | null {
  if (FIXED_BY_KEY[key]) return FIXED_BY_KEY[key];
  const cached = setDefCache.get(key);
  if (cached !== undefined) return cached;
  const m = /^gset(\d+)$/.exec(key);
  const def = m ? proceduralSetDef(Number(m[1])) : null;
  setDefCache.set(key, def);
  // Bound the cache: deep Endless runs touch unboundedly many gset<n> keys.
  if (setDefCache.size > SETDEF_CACHE_MAX) {
    const oldest = setDefCache.keys().next().value;
    if (oldest !== undefined) setDefCache.delete(oldest);
  }
  return def;
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
    guardian: 45,
    vampire: 60,
    storm: 75,
    executioner: 90,
    inferno: 105,
    oracle: 120,
    revenant: 135,
    trickster: 150,
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
  /** Active set×job synergies (label + description) for the UI. */
  synergies: { name: string; desc: string }[];
}

// ===== Set × Job synergies =====
// Equipping a set (≥ N pieces) while playing a matching job unlocks an extra,
// build-defining bonus. This is what makes "this set + this job" feel special.

export interface Synergy {
  classId: ClassId;
  setKey: string;
  minPieces: number;
  name: string;
  desc: string;
  apply: (eff: SetEffects) => void;
}

export const SYNERGIES: readonly Synergy[] = [
  {
    classId: "rogue",
    setKey: "gambler",
    minPieces: 4,
    name: "連鎖の賭け",
    desc: "盗賊×賭博師4: リロール+1＆追撃",
    apply: (e) => {
      e.statBonus.reroll += 1;
      e.extraHit = true;
    },
  },
  {
    classId: "paladin",
    setKey: "vampire",
    minPieces: 4,
    name: "聖血の誓い",
    desc: "聖騎士×吸血鬼4: 全攻撃に+15%吸血",
    apply: (e) => {
      e.lifestealAllPct = Math.max(e.lifestealAllPct, 0.15);
    },
  },
  {
    classId: "mage",
    setKey: "oracle",
    minPieces: 4,
    name: "預言の業火",
    desc: "魔法使い×神託4: 出目6の威力+40%",
    apply: (e) => {
      e.sixDmgBonus += 0.4;
    },
  },
  {
    classId: "berserker",
    setKey: "executioner",
    minPieces: 4,
    name: "処刑の狂宴",
    desc: "狂戦士×処刑人4: 即死しきい値を20%に",
    apply: (e) => {
      e.executePct = Math.max(e.executePct, 0.2);
    },
  },
  {
    classId: "warrior",
    setKey: "gambler",
    minPieces: 4,
    name: "豪運の一撃",
    desc: "戦士×賭博師4: 出目5・6の威力+30%",
    apply: (e) => {
      e.highFaceDmgBonus = Math.max(e.highFaceDmgBonus, 0.3);
    },
  },
];

const EMPTY_BONUS: StatBonus = { attack: 0, defense: 0, maxHp: 0, reroll: 0 };

function gamblerFaceOneToTwo(): DiceModifier {
  return {
    faces: [1],
    effect: { kind: "normal", isMiss: false, damageMultiplier: 1.0 },
    label: "2",
    description: "セット: 1の目が2(通常攻撃)になる",
  };
}

/**
 * Count equipped pieces per set and resolve the combined bonus effects.
 * Passing `classId` also applies any matching set×job synergies.
 */
export function computeSetEffects(equipped: EquippedItems, classId?: ClassId): SetEffects {
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
    synergies: [],
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

  // Set × job synergies.
  if (classId) {
    for (const syn of SYNERGIES) {
      if (syn.classId === classId && (counts[syn.setKey] ?? 0) >= syn.minPieces) {
        syn.apply(eff);
        eff.synergies.push({ name: syn.name, desc: syn.desc });
      }
    }
  }

  return eff;
}
