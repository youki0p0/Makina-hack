import { describe, expect, it } from "vitest";
import { getItemById } from "@/data/items";
import { applyEquipmentModifiers, rollDice } from "@/lib/dice";

describe("rollDice", () => {
  it("always returns 1..6", () => {
    for (let i = 0; i < 500; i++) {
      const v = rollDice();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});

describe("applyEquipmentModifiers", () => {
  it("returns the base 6-face table with no equipment", () => {
    const faces = applyEquipmentModifiers([null, null, null]);
    expect(faces).toHaveLength(6);
    const one = faces.find((f) => f.value === 1)!;
    expect(one.effect.isMiss).toBe(true);
    expect(one.modifiedBy).toHaveLength(0);
  });

  it("rewrites face 1 from miss to small attack with the iron sword", () => {
    const iron = getItemById("iron_sword")!;
    const faces = applyEquipmentModifiers([iron, null, null]);
    const one = faces.find((f) => f.value === 1)!;
    expect(one.effect.isMiss).toBe(false);
    expect(one.effect.kind).toBe("small");
    expect(one.modifiedBy).toContain(iron.name);
  });

  it("later sources override earlier ones for the same face", () => {
    const grimoire = getItemById("grimoire")!; // face 6 -> fireball
    const faces = applyEquipmentModifiers([null, null, grimoire]);
    const six = faces.find((f) => f.value === 6)!;
    expect(six.effect.kind).toBe("fireball");
  });
});

describe("layered mergeEffect (non-destructive)", () => {
  const src = (name: string, faces: number[], effect: object) => ({
    name,
    diceModifiers: [{ faces: faces as never, effect: effect as never, description: "" }],
  });

  it("keeps the highest damageMultiplier across sources", () => {
    const faces = applyEquipmentModifiers([
      src("A", [3], { damageMultiplier: 1.2 }),
      src("B", [3], { damageMultiplier: 2.5 }),
      src("C", [3], { damageMultiplier: 0.8 }),
    ]);
    const three = faces.find((f) => f.value === 3)!;
    expect(three.effect.damageMultiplier).toBe(2.5);
  });

  it("any source declaring isMiss:false removes the miss", () => {
    const faces = applyEquipmentModifiers([src("A", [1], { isMiss: false, damageMultiplier: 0.5 })]);
    const one = faces.find((f) => f.value === 1)!;
    expect(one.effect.isMiss).toBe(false);
  });

  it("extraHits are additive across sources", () => {
    const faces = applyEquipmentModifiers([
      src("A", [4], { extraHits: 1 }),
      src("B", [4], { extraHits: 2 }),
    ]);
    const four = faces.find((f) => f.value === 4)!;
    expect(four.effect.extraHits).toBe(3);
  });

  it("lifesteal is additive but capped at 0.75", () => {
    const faces = applyEquipmentModifiers([
      src("A", [5], { lifestealPct: 0.5 }),
      src("B", [5], { lifestealPct: 0.5 }),
    ]);
    const five = faces.find((f) => f.value === 5)!;
    expect(five.effect.lifestealPct).toBe(0.75);
  });

  it("guard is additive; selfDamage takes the max (no piling penalties)", () => {
    const faces = applyEquipmentModifiers([
      src("A", [2], { guard: 4, selfDamagePct: 0.3 }),
      src("B", [2], { guard: 6, selfDamagePct: 0.1 }),
    ]);
    const two = faces.find((f) => f.value === 2)!;
    expect(two.effect.guard).toBe(10);
    expect(two.effect.selfDamagePct).toBe(0.3);
  });
});
