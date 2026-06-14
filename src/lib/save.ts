import { normalizeProgress } from "@/data/achievements";
import { normalizeArtifacts } from "@/data/artifacts";
import { normalizeClassId } from "@/data/classes";
import { getItemInstance } from "@/data/items";
import { EQUIP_SLOTS } from "@/lib/battle";
import type {
  ArtifactLevels,
  ClassId,
  Equipment,
  EquippedItems,
  Player,
  Progress,
  SavedItem,
  SaveData,
} from "@/types/game";

function toSavedItem(item: Equipment | null): SavedItem | null {
  if (!item) return null;
  return item.affixId ? { id: item.id, affixId: item.affixId } : { id: item.id };
}

const STORAGE_KEY = "dice-hackslash-save-v1";

export interface LoadedState {
  player: Player;
  equipped: EquippedItems;
  inventory: Equipment[];
  currentFloor: number;
  gachaPoints: number;
  souls: number;
  artifacts: ArtifactLevels;
  classId: ClassId;
  winStreak: number;
  progress: Progress;
  favorites: string[];
  seenHelp: boolean;
  titleId: string;
  difficulty: string;
}

export function saveGame(state: LoadedState): void {
  if (typeof window === "undefined") return;
  const data: SaveData = {
    player: state.player,
    equippedItems: {
      weapon: toSavedItem(state.equipped.weapon),
      armor: toSavedItem(state.equipped.armor),
      accessory: toSavedItem(state.equipped.accessory),
    },
    inventoryItems: state.inventory.map((i) => toSavedItem(i)).filter((i): i is SavedItem => i !== null),
    currentFloor: state.currentFloor,
    gachaPoints: state.gachaPoints,
    souls: state.souls,
    artifacts: state.artifacts,
    classId: state.classId,
    winStreak: state.winStreak,
    progress: state.progress,
    favorites: state.favorites,
    seenHelp: state.seenHelp,
    titleId: state.titleId,
    difficulty: state.difficulty,
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
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;

    const equipped: EquippedItems = { weapon: null, armor: null, accessory: null };
    for (const slot of EQUIP_SLOTS) {
      const saved = data.equippedItems?.[slot];
      if (saved) {
        equipped[slot] = getItemInstance(saved.id, saved.affixId);
      } else {
        // Legacy fallback.
        const id = data.equippedIds?.[slot];
        equipped[slot] = id ? getItemInstance(id) : null;
      }
    }

    const savedInventory: SavedItem[] =
      data.inventoryItems ?? (data.inventoryIds ?? []).map((id) => ({ id }));
    const inventory = savedInventory
      .map((s) => getItemInstance(s.id, s.affixId))
      .filter((i): i is Equipment => i !== null);

    return {
      player: data.player,
      equipped,
      inventory,
      currentFloor: data.currentFloor,
      gachaPoints: data.gachaPoints ?? 0,
      souls: data.souls ?? 0,
      artifacts: normalizeArtifacts(data.artifacts),
      classId: normalizeClassId(data.classId),
      winStreak: data.winStreak ?? 0,
      progress: normalizeProgress(data.progress),
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
      seenHelp: data.seenHelp ?? false,
      titleId: data.titleId ?? "",
      difficulty: data.difficulty ?? "normal",
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
    window.localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch {
    return false;
  }
}
