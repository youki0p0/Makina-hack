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

const STORAGE_KEY = "dice-hackslash-save-v4";

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

  it("defaults dungeon fields on old saves (backward compatible)", () => {
    // validSave has no materials/dailyUses → must default, not break loading.
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(validSave))));
    expect(importSave(code)).toBe(true);
    const loaded = loadGame()!;
    expect(loaded.materials).toEqual({ shard: 0, core: 0, sigil: 0 });
    expect(loaded.dailyUses).toBe(3);
    expect(loaded.rushUses).toBe(5);
    expect(loaded.dailyCleared).toEqual([]);
  });

  it("round-trips dungeon materials / uses / cleared levels", () => {
    const withDungeon = {
      ...validSave,
      materials: { shard: 12, core: 4, sigil: 1 },
      dailyUses: 2,
      rushUses: 5,
      dailyCleared: [1, 3, 7],
      seenDailyStory: true,
    };
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(withDungeon))));
    expect(importSave(code)).toBe(true);
    const loaded = loadGame()!;
    expect(loaded.materials).toEqual({ shard: 12, core: 4, sigil: 1 });
    expect(loaded.dailyUses).toBe(2);
    expect(loaded.dailyCleared).toEqual([1, 3, 7]);
    expect(loaded.seenDailyStory).toBe(true);
  });

  it("defaults login/quest fields on old saves, and round-trips them", () => {
    // Old save (no login/quest fields) → safe defaults.
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(validSave))));
    expect(importSave(code)).toBe(true);
    let loaded = loadGame()!;
    expect(loaded.loginDay).toBe(0);
    expect(loaded.dailyClaimed).toEqual([]);
    expect(loaded.dailyQuestBase).toEqual({ kills: 0, bossKills: 0, forgeCount: 0, dungeonClears: 0 });

    const withQuests = {
      ...validSave,
      loginDay: 3,
      loginClaimKey: "2026-6-22",
      dailyQuestKey: "2026-6-22",
      dailyQuestBase: { kills: 100, bossKills: 5, forgeCount: 2, dungeonClears: 1 },
      dailyClaimed: ["d_kills"],
      weeklyClaimed: ["w_boss"],
    };
    const c2 = btoa(unescape(encodeURIComponent(JSON.stringify(withQuests))));
    expect(importSave(c2)).toBe(true);
    loaded = loadGame()!;
    expect(loaded.loginDay).toBe(3);
    expect(loaded.dailyQuestBase.kills).toBe(100);
    expect(loaded.dailyClaimed).toEqual(["d_kills"]);
    expect(loaded.weeklyClaimed).toEqual(["w_boss"]);
  });

  it("defaults mode-session to normal on old saves, and resumes an in-progress rush", () => {
    // Old save (no runMode) → normal (no phantom mode hijack).
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(validSave))));
    expect(importSave(code)).toBe(true);
    expect(loadGame()!.runMode).toBe("normal");

    // A save written mid-boss-rush round-trips so the session can resume on reload
    // (so the consumed use is never wasted).
    const midRush = {
      ...validSave,
      rushUses: 4,
      runMode: "rush",
      modeFloor: 600,
      modeStep: 2,
      modeTotal: 5,
      modeCleared: null,
    };
    const c2 = btoa(unescape(encodeURIComponent(JSON.stringify(midRush))));
    expect(importSave(c2)).toBe(true);
    const loaded = loadGame()!;
    expect(loaded.runMode).toBe("rush");
    expect(loaded.modeFloor).toBe(600);
    expect(loaded.modeStep).toBe(2);
    expect(loaded.modeTotal).toBe(5);
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

  it("carries over ONLY the bag from a v3 save (bag-only migration)", () => {
    const v3 = {
      saveVersion: 3,
      player: { ...validSave.player, gold: 5000 },
      inventoryItems: [{ id: "iron_sword" }],
      equippedItems: { weapon: { id: "rusty_sword" }, armor: null, accessory: null },
      currentFloor: 200,
      gachaPoints: 999,
    };
    window.localStorage.setItem("dice-hackslash-save-v3", JSON.stringify(v3));
    const loaded = loadGame()!;
    // Bag kept…
    expect(loaded.equipped.weapon?.id).toBe("rusty_sword");
    expect(loaded.inventory.some((i) => i.id === "iron_sword")).toBe(true);
    // …progression/economy reset.
    expect(loaded.currentFloor).toBe(1);
    expect(loaded.gachaPoints).toBe(0);
    expect(loaded.player.gold).toBe(0);
    // v3 is consumed; a v4 save now exists.
    expect(window.localStorage.getItem("dice-hackslash-save-v3")).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});
