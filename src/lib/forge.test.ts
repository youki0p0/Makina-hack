import { describe, expect, it } from "vitest";
import {
  applyForge,
  FORGE_MAX,
  forgeCost,
  forgeSuccessChance,
  rollForge,
  starInjectCost,
} from "@/data/forge";
import { getItemById } from "@/data/items";

describe("forge", () => {
  it("applyForge scales numbers additively and tags the name", () => {
    const base = getItemById("iron_sword")!;
    const f5 = applyForge({ ...base }, 5);
    expect(f5.forgeLevel).toBe(5);
    expect(f5.attack).toBe(Math.round(base.attack * (1 + 0.07 * 5)));
    expect(f5.name).toContain("+5");
  });

  it("cost and star-inject cost increase", () => {
    expect(forgeCost(5)).toBeGreaterThan(forgeCost(0));
    expect(starInjectCost(2)).toBeGreaterThan(starInjectCost(0));
  });

  it("low levels never fail; protection guarantees success", () => {
    for (let i = 0; i < 50; i++) {
      expect(rollForge(0, 0, false).kind).not.toBe("fail");
    }
    expect(forgeSuccessChance(10, 0, true)).toBe(1);
    for (let i = 0; i < 50; i++) {
      expect(rollForge(12, 0, true).kind).not.toBe("fail");
    }
  });

  it("pity raises success chance", () => {
    expect(forgeSuccessChance(8, 3, false)).toBeGreaterThan(forgeSuccessChance(8, 0, false));
  });

  it("never reports a level above the cap via applyForge name", () => {
    const base = getItemById("iron_sword")!;
    const f = applyForge({ ...base }, FORGE_MAX);
    expect(f.forgeLevel).toBe(FORGE_MAX);
  });
});
