// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { exportSave, importSave, loadGame, SAVE_VERSION } from "@/lib/save";

const validSave = {
  saveVersion: SAVE_VERSION,
  player: {
    level: 2,
    exp: 5,
    expToNext: 27,
    maxHp: 58,
    hp: 40,
    baseAttack: 10,
    baseDefense: 3,
    gold: 120,
  },
  inventoryItems: [{ id: "iron_sword" }, { id: "venom_fang", affixId: "sharp", modTier: 2 }],
  equippedItems: { weapon: { id: "rusty_sword" }, armor: null, accessory: null },
  currentFloor: 7,
};

const STORAGE_KEY = "dice-hackslash-save-v2";

describe("save import/export", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("imports a valid base64 code and loadGame reads it back", () => {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(validSave))));
    expect(importSave(code)).toBe(true);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.currentFloor).toBe(7);
    expect(loaded!.player.gold).toBe(120);
    expect(loaded!.equipped.weapon?.id).toBe("rusty_sword");
  });

  it("rehydrates a ★-modified inventory item", () => {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(validSave))));
    expect(importSave(code)).toBe(true);
    const loaded = loadGame()!;
    const fang = loaded.inventory.find((i) => i.id === "venom_fang");
    expect(fang?.modTier).toBe(2);
  });

  it("rejects garbage codes and old-version saves", () => {
    expect(importSave("not-valid-base64!!")).toBe(false);
    expect(importSave(btoa("{}"))).toBe(false); // no player
    const oldVersion = { ...validSave, saveVersion: 1 };
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(oldVersion))));
    expect(importSave(code)).toBe(false);
  });

  it("export round-trips through import", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validSave));
    const code = exportSave();
    expect(code.length).toBeGreaterThan(0);
    window.localStorage.clear();
    expect(importSave(code)).toBe(true);
    expect(loadGame()!.currentFloor).toBe(7);
  });

  it("discards a save written under an older schema version", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSave, saveVersion: 1 }));
    expect(loadGame()).toBeNull();
  });
});
