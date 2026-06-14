import { getItemById } from "@/data/items";
import { EQUIP_SLOTS } from "@/lib/battle";
import type {
  Equipment,
  EquippedItems,
  Player,
  SaveData,
} from "@/types/game";

const STORAGE_KEY = "dice-hackslash-save-v1";

export interface LoadedState {
  player: Player;
  equipped: EquippedItems;
  inventory: Equipment[];
  currentFloor: number;
  gachaPoints: number;
}

export function saveGame(state: LoadedState): void {
  if (typeof window === "undefined") return;
  const data: SaveData = {
    player: state.player,
    equippedIds: {
      weapon: state.equipped.weapon?.id ?? null,
      armor: state.equipped.armor?.id ?? null,
      accessory: state.equipped.accessory?.id ?? null,
    },
    inventoryIds: state.inventory.map((i) => i.id),
    currentFloor: state.currentFloor,
    gachaPoints: state.gachaPoints,
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
      const id = data.equippedIds[slot];
      equipped[slot] = id ? getItemById(id) : null;
    }

    const inventory = data.inventoryIds
      .map((id) => getItemById(id))
      .filter((i): i is Equipment => i !== null);

    return {
      player: data.player,
      equipped,
      inventory,
      currentFloor: data.currentFloor,
      gachaPoints: data.gachaPoints ?? 0,
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
