import { describe, expect, it } from "vitest";
import { DEFAULT_CLASS_ID } from "@/data/classes";
import { getItemById } from "@/data/items";
import { FINAL_FLOOR } from "@/data/worlds";
import { itemKey } from "@/lib/ui";
import type { Equipment, EquippedItems, Progress } from "@/types/game";
import type { ArtifactLevels } from "@/types/game";
import {
  addUnique,
  buildFaces,
  canChangeClassNow,
  capInventory,
  computePlayerStats,
  createPlayer,
  discover,
  emptyEquipped,
  endlessAscension,
  equippedResist,
  isCleared1000,
  isSavePointFloor,
  MAX_INVENTORY,
  soulAltarCost,
  soulAltarMult,
  passiveBonus,
  weakestSlot,
} from "./helpers";

const NO_ARTIFACTS: ArtifactLevels = { might: 0, guard: 0, vitality: 0, fortune: 0 };

function mkItem(over: Partial<Equipment> = {}): Equipment {
  return {
    id: "test",
    name: "テスト装備",
    rarity: "common",
    slot: "weapon",
    attack: 0,
    defense: 0,
    maxHp: 0,
    rerollModifier: 0,
    description: "",
    diceModifiers: [],
    ...over,
  };
}

describe("isSavePointFloor", () => {
  it("is true at 1, 51, 101 and false otherwise", () => {
    expect(isSavePointFloor(1)).toBe(true);
    expect(isSavePointFloor(51)).toBe(true);
    expect(isSavePointFloor(101)).toBe(true);
    expect(isSavePointFloor(2)).toBe(false);
    expect(isSavePointFloor(50)).toBe(false);
    expect(isSavePointFloor(0)).toBe(false);
  });
});

describe("isCleared1000", () => {
  const base = { highestFloorReached: 0, endingSeen: false } as Progress;
  it("is true once the final floor is reached or the ending was seen", () => {
    expect(isCleared1000({ ...base })).toBe(false);
    expect(isCleared1000({ ...base, highestFloorReached: FINAL_FLOOR })).toBe(true);
    expect(isCleared1000({ ...base, endingSeen: true })).toBe(true);
  });
});

describe("canChangeClassNow", () => {
  it("allows on default class, after defeat, or at a save-point floor", () => {
    expect(canChangeClassNow({ classId: DEFAULT_CLASS_ID, battleState: "player", currentFloor: 7 })).toBe(true);
    expect(canChangeClassNow({ classId: "warrior", battleState: "lost", currentFloor: 7 })).toBe(true);
    expect(canChangeClassNow({ classId: "warrior", battleState: "player", currentFloor: 51 })).toBe(true);
    expect(canChangeClassNow({ classId: "warrior", battleState: "player", currentFloor: 7 })).toBe(false);
  });
});

describe("createPlayer / emptyEquipped", () => {
  it("creates a level-1 player", () => {
    const p = createPlayer();
    expect(p.level).toBe(1);
    expect(p.hp).toBe(50);
    expect(p.maxHp).toBe(50);
    expect(p.baseAttack).toBe(8);
    expect(p.baseDefense).toBe(2);
    expect(p.gold).toBe(0);
  });
  it("creates an all-empty equipment map", () => {
    expect(emptyEquipped()).toEqual({
      weapon: null, helm: null, armor: null, gloves: null, boots: null, accessory: null,
    });
  });
});

describe("addUnique / discover", () => {
  it("addUnique dedups", () => {
    expect(addUnique(["a"], "b")).toEqual(["a", "b"]);
    expect(addUnique(["a"], "a")).toEqual(["a"]);
  });
  it("discover skips procedural ids but records curated ones", () => {
    expect(discover([], "gen_weapon_3")).toEqual([]);
    expect(discover([], "setp_x")).toEqual([]);
    expect(discover([], "sword_iron")).toEqual(["sword_iron"]);
    expect(discover(["sword_iron"], "sword_iron")).toEqual(["sword_iron"]);
  });
});

describe("capInventory", () => {
  it("leaves an under-cap inventory untouched", () => {
    const inv = [mkItem({ id: "a" }), mkItem({ id: "b" })];
    const res = capInventory(inv, []);
    expect(res.kept).toBe(inv);
    expect(res.material).toBe(0);
  });
  it("dismantles the weakest items when over cap, keeping locked/favorited/noSell", () => {
    // Strong items (kept) + weak items (some scrapped to fit the cap).
    const strong = Array.from({ length: MAX_INVENTORY }, (_, i) =>
      mkItem({ id: `s${i}`, attack: 100 }),
    );
    const weak = Array.from({ length: 5 }, (_, i) => mkItem({ id: `w${i}`, attack: 0, rarity: "common" }));
    const favWeak = mkItem({ id: "favWeak", attack: 0, rarity: "common" });
    const noSellWeak = mkItem({ id: "keepWeak", attack: 0, noSell: true });
    const inv = [...strong, ...weak, favWeak, noSellWeak];

    const res = capInventory(inv, [itemKey(favWeak)]);
    expect(res.kept.length).toBe(MAX_INVENTORY);
    // Locked items survive regardless of being weak.
    expect(res.kept.some((it) => it.id === "favWeak")).toBe(true);
    expect(res.kept.some((it) => it.id === "keepWeak")).toBe(true);
    // Some weak commons were scrapped into material.
    expect(res.material).toBeGreaterThan(0);
  });
});

describe("weakestSlot", () => {
  it("prefers an empty slot", () => {
    const eq = emptyEquipped();
    eq.weapon = mkItem({ slot: "weapon", attack: 10, defense: 10, maxHp: 10 });
    expect(weakestSlot(eq)).not.toBe("weapon");
  });
  it("picks the lowest stat-sum slot when all are filled", () => {
    const eq: EquippedItems = {
      weapon: mkItem({ slot: "weapon", attack: 5, defense: 5, maxHp: 5 }),
      helm: mkItem({ slot: "helm", attack: 1, defense: 0, maxHp: 0 }),
      armor: mkItem({ slot: "armor", attack: 9, defense: 9, maxHp: 9 }),
      gloves: mkItem({ slot: "gloves", attack: 9, defense: 9, maxHp: 9 }),
      boots: mkItem({ slot: "boots", attack: 9, defense: 9, maxHp: 9 }),
      accessory: mkItem({ slot: "accessory", attack: 9, defense: 9, maxHp: 9 }),
    };
    expect(weakestSlot(eq)).toBe("helm");
  });
});

describe("buildFaces (装備がダイス目を書き換える)", () => {
  it("returns base faces for the default class with no gear (face 1 = miss)", () => {
    const faces = buildFaces(emptyEquipped(), DEFAULT_CLASS_ID);
    const f1 = faces.find((f) => f.value === 1)!;
    expect(f1.effect.isMiss).toBe(true);
    expect(f1.modifiedBy).toEqual([]);
  });
  it("rewrites face 1 (miss → small attack) when 鉄の剣 is equipped", () => {
    const eq = emptyEquipped();
    eq.weapon = getItemById("iron_sword");
    const faces = buildFaces(eq, DEFAULT_CLASS_ID);
    const f1 = faces.find((f) => f.value === 1)!;
    expect(f1.effect.isMiss).toBe(false);
    expect(f1.effect.kind).toBe("small");
    expect(f1.modifiedBy).toContain("鉄の剣");
  });
});

describe("passiveBonus", () => {
  it("maps the daily bonus onto the matching stat", () => {
    const eq = emptyEquipped();
    const gold = passiveBonus(NO_ARTIFACTS, DEFAULT_CLASS_ID, eq, { id: "g", label: "", stat: "gold", value: 25 });
    const atk = passiveBonus(NO_ARTIFACTS, DEFAULT_CLASS_ID, eq, { id: "a", label: "", stat: "attack", value: 3 });
    const rer = passiveBonus(NO_ARTIFACTS, DEFAULT_CLASS_ID, eq, { id: "r", label: "", stat: "reroll", value: 1 });
    // gold daily affects neither attack nor reroll (it is applied elsewhere).
    expect(atk.attack - gold.attack).toBe(3);
    expect(rer.reroll - gold.reroll).toBe(1);
  });
});

describe("computePlayerStats", () => {
  it("adds the passive attack bonus on top of the base", () => {
    const player = createPlayer();
    const eq = emptyEquipped();
    const s0 = computePlayerStats(player, eq, [], DEFAULT_CLASS_ID, { attack: 0, defense: 0, maxHp: 0, reroll: 0 });
    const s1 = computePlayerStats(player, eq, [], DEFAULT_CLASS_ID, { attack: 10, defense: 0, maxHp: 0, reroll: 0 });
    expect(s1.attack).toBeGreaterThan(s0.attack);
    expect(s1.defense).toBe(s0.defense);
  });
});

describe("equippedResist", () => {
  it("sums resistances and clamps to 0.9", () => {
    const eq = emptyEquipped();
    eq.weapon = mkItem({ slot: "weapon", poisonResist: 0.3, stunResist: 0.2 });
    eq.armor = mkItem({ slot: "armor", poisonResist: 0.2 });
    expect(equippedResist(eq)).toEqual({ poison: 0.5, stun: 0.2 });

    const heavy = emptyEquipped();
    heavy.weapon = mkItem({ slot: "weapon", poisonResist: 0.8 });
    heavy.armor = mkItem({ slot: "armor", poisonResist: 0.8 });
    expect(equippedResist(heavy).poison).toBe(0.9);
  });
});

describe("endlessAscension (深淵到達補正)", () => {
  it("is 1.0 at and below floor 1000 (本編は不変)", () => {
    expect(endlessAscension(1)).toBe(1);
    expect(endlessAscension(500)).toBe(1);
    expect(endlessAscension(1000)).toBe(1);
  });
  it("scales up only beyond floor 1000, linearly in 50-floor tiers", () => {
    expect(endlessAscension(1050)).toBeCloseTo(1.05, 5); // tier21
    expect(endlessAscension(2600)).toBeCloseTo(1 + 0.05 * 32, 5); // tier52 → ×2.6
    expect(endlessAscension(3000) - endlessAscension(2900)).toBeCloseTo(0.1, 5); // 100階で+0.10(線形)
  });
});

describe("soulAltar (魂の祭壇)", () => {
  it("cost rises linearly per level (10,20,30,…)", () => {
    expect(soulAltarCost(0)).toBe(10);
    expect(soulAltarCost(1)).toBe(20);
    expect(soulAltarCost(9)).toBe(100);
  });
  it("multiplier is 1.0 at level 0 and +3% per level", () => {
    expect(soulAltarMult(0)).toBe(1);
    expect(soulAltarMult(10)).toBeCloseTo(1.3, 5);
    expect(soulAltarMult(50)).toBeCloseTo(2.5, 5);
  });
});
