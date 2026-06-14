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
