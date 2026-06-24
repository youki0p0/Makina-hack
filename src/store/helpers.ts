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
  floor = 0,
): StatBonus {
  const a = artifactBonus(artifacts);
  const c = classStatBonus(classId);
  const set = computeSetEffects(equipped, classId, floor).statBonus;
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
  floor = 0,
): ComputedStats {
  const base = computeStats(player, equipped, buffs, passive);
  // 固有共鳴/セット集中の最終倍率(★スケール後に乗算)。装備IDからLIVE計算され
  // セーブ非互換にならない。紋章のセット増幅も floor から反映。
  const setEff = computeSetEffects(equipped, classId, floor);
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

// ===== 魂の祭壇（Soul Altar）=====
// 称号・マイルストーンで貯まる転生ポイント(souls)の“無限の使い道”。アーティファクトを
// 上限まで上げ切った後も souls が死蔵されない受け皿。戦闘バランスには触れず、ゴールド/EXP
// 取得を伸ばす経済アップグレードに限定（「登れる無限」の難度カーブを再調整しない）。

/** 祭壇を現在Lvから次Lvへ上げる魂コスト（逓増・無限）。 */
export function soulAltarCost(level: number): number {
  return 10 * (Math.max(0, level) + 1);
}

/** 祭壇Lvによるゴールド・EXP取得倍率（+3% / Lv）。Lv0 で 1.0。 */
export function soulAltarMult(level: number): number {
  return 1 + 0.03 * Math.max(0, level);
}

/**
 * 深淵到達補正（Endless Ascension）: 1000階を超えてからのみ効く、攻撃・最大HPへの
 * 複利的なスケール。敵は1000階超で線形成長に抑えた（modifiers.ts のランプ頭打ち）ので、
 * プレイヤー側もここで線形の伸び軸を持たせ、「登れる無限」を成立させる。
 * 1000階以下は常に 1.0（本編バランスは不変）。tier = floor/50。
 */
export function endlessAscension(floor: number): number {
  const tier = Math.floor(floor / 50);
  return 1 + 0.05 * Math.max(0, tier - 20);
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
    emblem: null,
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
  if (id.startsWith("gen_") || id.startsWith("setp_") || id.startsWith("emblem_")) return list;
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
/** 紋章(emblem)専用ストックの上限。装備ストックとは別枠で、自動分解の巻き添えにしない。 */
export const MAX_EMBLEMS = 30;

/** 上限超過時に弱い方から自動分解する汎用ロジック（装備/紋章で共用）。 */
function capStock(
  items: Equipment[],
  favorites: string[],
  max: number,
): { kept: Equipment[]; material: number } {
  if (items.length <= max) return { kept: items, material: 0 };
  const score = (it: Equipment) =>
    it.attack * 2 + it.defense * 1.5 + it.maxHp * 0.4 + (it.modTier ?? 0) * 5 + (it.forgeLevel ?? 0) * 8;
  const locked: Equipment[] = [];
  const removable: Equipment[] = [];
  for (const it of items) {
    if (it.noSell || favorites.includes(itemKey(it))) locked.push(it);
    else removable.push(it);
  }
  removable.sort((a, b) => score(a) - score(b)); // weakest first
  const toRemove = Math.max(0, locked.length + removable.length - max);
  let material = 0;
  const kept = [...locked];
  removable.forEach((it, i) => {
    if (i < toRemove) material += SCRAP_VALUE[it.rarity];
    else kept.push(it);
  });
  return { kept, material };
}

export function capInventory(
  inv: Equipment[],
  favorites: string[],
): { kept: Equipment[]; material: number } {
  return capStock(inv, favorites, MAX_INVENTORY);
}

/** 紋章ストック(最大30)の上限処理。装備ストックとは独立。 */
export function capEmblems(
  emblems: Equipment[],
  favorites: string[],
): { kept: Equipment[]; material: number } {
  return capStock(emblems, favorites, MAX_EMBLEMS);
}

/**
 * The emptiest/weakest equipped slot (for biasing "smart drops").
 * 紋章(emblem)は通常ドロップ対象外（3000階+の専用ドロップのみ）なので除外する。
 */
export function weakestSlot(eq: EquippedItems): EquipmentSlot {
  let worst: EquipmentSlot = EQUIP_SLOTS[0];
  let worstScore = Infinity;
  for (const slot of EQUIP_SLOTS) {
    if (slot === "emblem") continue;
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
