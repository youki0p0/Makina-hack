// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { exportSave, importSave, loadGame } from "@/lib/save";

const validSave = {
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
  inventoryIds: ["iron_sword"],
  equippedIds: { weapon: "rusty_sword", armor: null, accessory: null },
  currentFloor: 7,
};

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

  it("rejects garbage codes", () => {
    expect(importSave("not-valid-base64!!")).toBe(false);
    expect(importSave(btoa("{}"))).toBe(false); // no player
  });

  it("export round-trips through import", () => {
    window.localStorage.setItem(
      "dice-hackslash-save-v1",
      JSON.stringify(validSave),
    );
    const code = exportSave();
    expect(code.length).toBeGreaterThan(0);
    window.localStorage.clear();
    expect(importSave(code)).toBe(true);
    expect(loadGame()!.currentFloor).toBe(7);
  });
});
