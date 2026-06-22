// ===== Pure store helpers =====
// Stateless helpers extracted from gameStore.ts so they can be unit-tested and
// reasoned about in isolation. Nothing here touches Zustand `set`/`get` or any
// mutable closure state — they are pure functions of their arguments.

import { artifactBonus } from "@/data/artifacts";
import { DEFAULT_CLASS_ID, classStatBonus, getClass } from "@/data/classes";
import { jobAttackMult } from "@/data/jobBalance";
import { computeSetEffects } from "@/data/sets";
import { FINAL_FLOOR } from "@/data/worlds";
import type { DailyBonus } from "@/lib/daily";
import { EQUIP_SLOTS, computeStats, expForLevel } from "@/lib/battle";
import { applyEquipmentModifiers } from "@/lib/dice";
import { SCRAP_VALUE } from "@/lib/loot";
import { itemKey } from "@/lib/ui";
import type {
  ActiveBuff,
  ArtifactLevels,
  BattleState,
  ClassId,
  ComputedStats,
  DiceFace,
  Equipment,
  EquipmentSlot,
  EquippedItems,
  Player,
  Progress,
  StatBonus,
} from "@/types/game";

/**
 * Sum of artifacts, the current class's mods, set bonuses, and the daily bonus.
 * Pure: callers pass the live values (the store wrapper supplies them from state).
 */
export function passiveBonus(
  artifacts: ArtifactLevels,
  classId: ClassId,
  equipped: EquippedItems,
  daily: DailyBonus,
): StatBonus {
  const a = artifactBonus(artifacts);
  const c = classStatBonus(classId);
  const set = computeSetEffects(equipped, classId).statBonus;
  const d: StatBonus = {
    attack: daily.stat === "attack" ? daily.value : 0,
    defense: daily.stat === "defense" ? daily.value : 0,
    maxHp: 0,
    reroll: daily.stat === "reroll" ? daily.value : 0,
  };
  return {
    attack: a.attack + c.attack + d.attack + set.attack,
    defense: a.defense + c.defense + d.defense + set.defense,
    maxHp: a.maxHp + c.maxHp + d.maxHp + set.maxHp,
    reroll: a.reroll + c.reroll + d.reroll + set.reroll,
  };
}

/**
 * Compute stats including artifact/class/set passive bonuses and the per-class
 * job attack multiplier. Pure: the `passive` bonus and `classId` are supplied
 * by the caller (the store wrapper reads them from live state).
 */
export function computePlayerStats(
  player: Player,
  equipped: EquippedItems,
  buffs: ActiveBuff[],
  classId: ClassId,
  passive: StatBonus,
): ComputedStats {
  const base = computeStats(player, equipped, buffs, passive);
  // 固有共鳴/セット集中の最終倍率(★スケール後に乗算)。装備IDからLIVE計算され
  // セーブ非互換にならない。
  const setEff = computeSetEffects(equipped, classId);
  // Job balance: per-class attack multiplier (centralized in jobBalance.ts).
  const attack = Math.round(base.attack * jobAttackMult(classId) * (1 + setEff.attackPct));
  const maxHp = Math.round(base.maxHp * (1 + setEff.maxHpPct));
  return { ...base, attack, maxHp };
}

/**
 * Resolve the player's final dice faces: class mods first, then each equipped
 * item (gear overrides class), then set-bonus rewrites last. This is the core
 * "equipment rewrites dice faces" mechanic — kept pure so it can be tested and
 * called from the store without touching `get`/`set`.
 */
export function buildFaces(equipped: EquippedItems, classId: ClassId): DiceFace[] {
  const cls = getClass(classId);
  const setEff = computeSetEffects(equipped, classId);
  return applyEquipmentModifiers([
    { name: cls.name, diceModifiers: cls.diceModifiers },
    ...EQUIP_SLOTS.map((s) => equipped[s]),
    { name: "セット", diceModifiers: setEff.diceModifiers },
  ]);
}

/** 1000階(DEUS EX MACHINA)を踏破済みか（到達 or エンディング視聴）。 */
export function isCleared1000(progress: Progress): boolean {
  return progress.highestFloorReached >= FINAL_FLOOR || progress.endingSeen;
}

/** セーブポイントの階層（1, 51, 101…）。ここでは転職を常に許可する。 */
export function isSavePointFloor(floor: number): boolean {
  return floor >= 1 && (floor - 1) % 50 === 0;
}

/** 転職可能か（初期クラス中・敗北直後・セーブポイント階のいずれか）。 */
export function canChangeClassNow(state: {
  classId: ClassId;
  battleState: BattleState;
  currentFloor: number;
}): boolean {
  return (
    state.classId === DEFAULT_CLASS_ID ||
    state.battleState === "lost" ||
    isSavePointFloor(state.currentFloor)
  );
}

export function createPlayer(): Player {
  return {
    level: 1,
    exp: 0,
    expToNext: expForLevel(1),
    maxHp: 50,
    hp: 50,
    baseAttack: 8,
    baseDefense: 2,
    gold: 0,
  };
}

export function emptyEquipped(): EquippedItems {
  return {
    weapon: null,
    helm: null,
    armor: null,
    gloves: null,
    boots: null,
    accessory: null,
  };
}

/** Add an id to a list if not already present (set-union). */
export function addUnique(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

/**
 * Record a *curated* item id for the collection (図鑑). Procedural gear
 * (`gen_*` / `setp_*`) is intentionally NOT tracked: the collection only counts
 * the finite curated registry, so storing infinite procedural ids just bloats the
 * save — at floor 700+ `discoveredItems` grew into thousands of entries, and
 * spreading/serializing it on every victory made the browser freeze and the save
 * slow to load. Skipping them keeps the array bounded to the curated set.
 */
export function discover(list: string[], id: string): string[] {
  if (id.startsWith("gen_") || id.startsWith("setp_")) return list;
  return addUnique(list, id);
}

/**
 * Hard cap on inventory size. With infinite drops over hundreds of floors the
 * inventory would balloon and make every save/render freeze the browser. When
 * it overflows we auto-dismantle the WEAKEST non-locked items into material —
 * locked/favorited and 神機マキナ are never touched.
 * 描画はInventoryList側でページング(50件ずつ)済みなので、上限を上げても初期描画は重くならない。
 * エンドレスの★上げ運用で枠が足りないため 150→300 に拡大。
 */
export const MAX_INVENTORY = 300;

export function capInventory(
  inv: Equipment[],
  favorites: string[],
): { kept: Equipment[]; material: number } {
  if (inv.length <= MAX_INVENTORY) return { kept: inv, material: 0 };
  const score = (it: Equipment) =>
    it.attack * 2 + it.defense * 1.5 + it.maxHp * 0.4 + (it.modTier ?? 0) * 5 + (it.forgeLevel ?? 0) * 8;
  const locked: Equipment[] = [];
  const removable: Equipment[] = [];
  for (const it of inv) {
    if (it.noSell || favorites.includes(itemKey(it))) locked.push(it);
    else removable.push(it);
  }
  removable.sort((a, b) => score(a) - score(b)); // weakest first
  const toRemove = Math.max(0, locked.length + removable.length - MAX_INVENTORY);
  let material = 0;
  const kept = [...locked];
  removable.forEach((it, i) => {
    if (i < toRemove) material += SCRAP_VALUE[it.rarity];
    else kept.push(it);
  });
  return { kept, material };
}

/** The emptiest/weakest equipped slot (for biasing "smart drops"). */
export function weakestSlot(eq: EquippedItems): EquipmentSlot {
  let worst: EquipmentSlot = EQUIP_SLOTS[0];
  let worstScore = Infinity;
  for (const slot of EQUIP_SLOTS) {
    const it = eq[slot];
    const score = it ? it.attack + it.defense + it.maxHp : -1;
    if (score < worstScore) {
      worstScore = score;
      worst = slot;
    }
  }
  return worst;
}

/** Sum status-resistance from equipped gear (clamped to 0.9). */
export function equippedResist(eq: EquippedItems): { poison: number; stun: number } {
  let poison = 0;
  let stun = 0;
  for (const slot of EQUIP_SLOTS) {
    const it = eq[slot];
    if (!it) continue;
    poison += it.poisonResist ?? 0;
    stun += it.stunResist ?? 0;
  }
  return { poison: Math.min(0.9, poison), stun: Math.min(0.9, stun) };
}
