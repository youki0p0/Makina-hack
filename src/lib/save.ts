import { defaultProgress, normalizeProgress } from "@/data/achievements";
import { defaultArtifactLevels, normalizeArtifacts } from "@/data/artifacts";
import { normalizeClassId } from "@/data/classes";
import { getItemInstance } from "@/data/items";
import { EQUIP_SLOTS, expForLevel } from "@/lib/battle";
import type {
  ArtifactLevels,
  ClassId,
  Equipment,
  EquipmentSlot,
  EquippedItems,
  Player,
  Progress,
  SavedItem,
  SaveData,
  SlotSave,
} from "@/types/game";

/** Empty slot state (no bonuses, fresh counters). */
export function emptySlot(): SlotSave {
  return { machine: 0, bucket: 0, total: 0, hamari: 0, zone: 0, at: 0, big: 0, reg: 0, maxHamari: 0, hits: [] };
}

/**
 * Bump this whenever the save shape changes incompatibly. During the debug era
 * we simply DISCARD older saves (no migration) so the data model can evolve.
 */
export const SAVE_VERSION = 4;

const STORAGE_KEY = "dice-hackslash-save-v4";
/** Previous version key — read for a one-time "bag only" carry-over. */
const PREV_STORAGE_KEY = "dice-hackslash-save-v3";

function toSavedItem(item: Equipment | null): SavedItem | null {
  if (!item) return null;
  const out: SavedItem = { id: item.id };
  if (item.affixId) out.affixId = item.affixId;
  if (item.modTier && item.modTier > 0) out.modTier = item.modTier;
  if (item.quality) out.quality = item.quality;
  if (item.forgeLevel && item.forgeLevel > 0) out.forgeLevel = item.forgeLevel;
  if (item.forgeStreak && item.forgeStreak > 0) out.forgeStreak = item.forgeStreak;
  return out;
}

export interface LoadedState {
  player: Player;
  equipped: EquippedItems;
  inventory: Equipment[];
  currentFloor: number;
  gachaPoints: number;
  souls: number;
  soulAltar: number;
  coins: number;
  hiCoins: number;
  kingPity: number;
  kingComped: boolean;
  casinoBan: number;
  slot: SlotSave;
  artifacts: ArtifactLevels;
  classId: ClassId;
  winStreak: number;
  progress: Progress;
  favorites: string[];
  seenHelp: boolean;
  titleId: string;
  difficulty: string;
  handedness: "right" | "left";
  checkpoint: number;
  tapToBuy: boolean;
  startFloorPref: number;
}

/** A fresh save (everything reset) but keeping the given bag (gear). */
function freshLoaded(equipped: EquippedItems, inventory: Equipment[]): LoadedState {
  const player: Player = {
    level: 1,
    exp: 0,
    expToNext: expForLevel(1),
    maxHp: 50,
    hp: 50,
    baseAttack: 8,
    baseDefense: 2,
    gold: 0,
  };
  return {
    player,
    equipped,
    inventory,
    currentFloor: 1,
    gachaPoints: 0,
    souls: 0,
    soulAltar: 0,
    coins: 0,
    hiCoins: 0,
    kingPity: 0,
    kingComped: false,
    casinoBan: 0,
    slot: emptySlot(),
    artifacts: defaultArtifactLevels(),
    classId: normalizeClassId(undefined),
    winStreak: 0,
    progress: defaultProgress(),
    favorites: [],
    seenHelp: false,
    titleId: "",
    difficulty: "normal",
    handedness: "right",
    checkpoint: 1,
    tapToBuy: false,
    startFloorPref: 1,
  };
}

/**
 * One-time carry-over from the v3 save: keep ONLY the bag (inventory + equipped),
 * reset progression/economy ("バッグのみ引継ぎ"). Writes a v4 save and drops v3.
 */
function migrateFromV3(): LoadedState | null {
  if (typeof window === "undefined") return null;
  const prev = window.localStorage.getItem(PREV_STORAGE_KEY);
  if (!prev) return null;
  try {
    const data = JSON.parse(prev) as SaveData;
    if (!data.player) {
      window.localStorage.removeItem(PREV_STORAGE_KEY);
      return null;
    }
    const equipped = EQUIP_SLOTS.reduce((acc, slot) => {
      const s = data.equippedItems?.[slot];
      acc[slot] = s ? getItemInstance(s.id, s.affixId, s.modTier, s.quality) : null;
      return acc;
    }, {} as EquippedItems);
    const inventory = (data.inventoryItems ?? [])
      .map((s) => getItemInstance(s.id, s.affixId, s.modTier, s.quality))
      .filter((i): i is Equipment => i !== null);
    const migrated = freshLoaded(equipped, inventory);
    saveGame(migrated);
    window.localStorage.removeItem(PREV_STORAGE_KEY);
    return migrated;
  } catch {
    return null;
  }
}

export function saveGame(state: LoadedState): void {
  if (typeof window === "undefined") return;
  const equippedItems = EQUIP_SLOTS.reduce(
    (acc, slot) => {
      acc[slot] = toSavedItem(state.equipped[slot]);
      return acc;
    },
    {} as { [K in EquipmentSlot]: SavedItem | null },
  );
  const data: SaveData = {
    saveVersion: SAVE_VERSION,
    player: state.player,
    equippedItems,
    inventoryItems: state.inventory.map((i) => toSavedItem(i)).filter((i): i is SavedItem => i !== null),
    currentFloor: state.currentFloor,
    gachaPoints: state.gachaPoints,
    souls: state.souls,
    soulAltar: state.soulAltar,
    coins: state.coins,
    hiCoins: state.hiCoins,
    kingPity: state.kingPity,
    kingComped: state.kingComped,
    casinoBan: state.casinoBan,
    slot: state.slot,
    artifacts: state.artifacts,
    classId: state.classId,
    winStreak: state.winStreak,
    progress: state.progress,
    favorites: state.favorites,
    seenHelp: state.seenHelp,
    titleId: state.titleId,
    difficulty: state.difficulty,
    handedness: state.handedness,
    checkpoint: state.checkpoint,
    tapToBuy: state.tapToBuy,
    startFloorPref: state.startFloorPref,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage may be full / blocked; ignore.
  }
}

export function loadGame(): LoadedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    // No v4 save yet: carry over ONLY the bag (inventory+equipped) from v3.
    if (!raw) return migrateFromV3();
    const data = JSON.parse(raw) as SaveData;

    // Debug-era policy: discard saves from an older schema version.
    if (data.saveVersion !== SAVE_VERSION || !data.player) return null;

    const equipped = EQUIP_SLOTS.reduce((acc, slot) => {
      const saved = data.equippedItems?.[slot];
      acc[slot] = saved
        ? getItemInstance(saved.id, saved.affixId, saved.modTier, saved.quality, saved.forgeLevel, saved.forgeStreak)
        : null;
      return acc;
    }, {} as EquippedItems);

    const inventory = (data.inventoryItems ?? [])
      .map((s) => getItemInstance(s.id, s.affixId, s.modTier, s.quality, s.forgeLevel, s.forgeStreak))
      .filter((i): i is Equipment => i !== null);

    return {
      player: data.player,
      equipped,
      inventory,
      currentFloor: data.currentFloor,
      gachaPoints: data.gachaPoints ?? 0,
      souls: data.souls ?? 0,
      soulAltar: data.soulAltar ?? 0,
      coins: data.coins ?? 0,
      hiCoins: data.hiCoins ?? 0,
      kingPity: data.kingPity ?? 0,
      kingComped: data.kingComped ?? false,
      casinoBan: data.casinoBan ?? 0,
      slot: data.slot ? { ...emptySlot(), ...data.slot, hits: Array.isArray(data.slot.hits) ? data.slot.hits : [] } : emptySlot(),
      artifacts: normalizeArtifacts(data.artifacts),
      classId: normalizeClassId(data.classId),
      winStreak: data.winStreak ?? 0,
      progress: normalizeProgress(data.progress),
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
      seenHelp: data.seenHelp ?? false,
      titleId: data.titleId ?? "",
      difficulty: data.difficulty ?? "normal",
      handedness: data.handedness === "left" ? "left" : "right",
      checkpoint: typeof data.checkpoint === "number" && data.checkpoint >= 1 ? data.checkpoint : 1,
      tapToBuy: data.tapToBuy === true,
      startFloorPref:
        typeof data.startFloorPref === "number" && data.startFloorPref >= 1 ? data.startFloorPref : 1,
    };
  } catch {
    return null;
  }
}

export function clearSave(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Export the raw save as a base64 transfer code (empty if no save). */
export function exportSave(): string {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return "";
  try {
    return btoa(unescape(encodeURIComponent(raw)));
  } catch {
    return "";
  }
}

/** Import a base64 transfer code into localStorage. Returns success. */
export function importSave(code: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const data = JSON.parse(json) as Partial<SaveData>;
    if (!data || typeof data !== "object" || !data.player) return false;
    if (data.saveVersion !== SAVE_VERSION) return false;
    window.localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch {
    return false;
  }
}
