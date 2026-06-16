import { describe, expect, it } from "vitest";
import { fateCost, FATE_WIN_CHANCE } from "@/lib/casino";

describe("運命の大博打 (fate gamble)", () => {
  it("keeps a deliberately tiny win chance (低期待値)", () => {
    expect(FATE_WIN_CHANCE).toBeGreaterThan(0);
    expect(FATE_WIN_CHANCE).toBeLessThanOrEqual(0.1);
  });

  it("fateCost has a floor and scales with the player's best tier", () => {
    expect(fateCost(0)).toBe(3000); // floor for fresh saves
    expect(fateCost(10)).toBe(3000); // still under the floor
    expect(fateCost(60)).toBe(60 * 80); // late-game gold sink
    expect(fateCost(100)).toBeGreaterThan(fateCost(60));
  });
});
