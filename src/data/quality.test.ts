import { afterEach, describe, expect, it, vi } from "vitest";
import { rollQuality } from "./quality";
import type { Equipment } from "@/types/game";

function legendary(): Equipment {
  return { rarity: "legendary" } as Equipment;
}

afterEach(() => vi.restoreAllMocks());

describe("rollQuality（深層で上位品質が出やすい）", () => {
  it("legendary 以外は常に undefined（階層無関係）", () => {
    expect(rollQuality({ rarity: "epic" } as Equipment, 9999)).toBeUndefined();
    expect(rollQuality({ rarity: "common" } as Equipment, 9999)).toBeUndefined();
  });

  it("通常階（〜3000未満）は従来どおり mythic1% / ancient12%", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.005); // < 0.01
    expect(rollQuality(legendary(), 100)).toBe("mythic");
    vi.spyOn(Math, "random").mockReturnValue(0.05); // 0.01..0.13
    expect(rollQuality(legendary(), 100)).toBe("ancient");
    vi.spyOn(Math, "random").mockReturnValue(0.5); // >= 0.13
    expect(rollQuality(legendary(), 100)).toBeUndefined();
  });

  it("3000階+はしきい値が上がる（mythic6% / ancient帯30%）", () => {
    // 0.05 は通常階では ancient だが、3000階では mythic 圏(<0.06)。
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    expect(rollQuality(legendary(), 3000)).toBe("mythic");
    // 0.3 は通常階では無印だが、3000階では ancient 圏(<0.36)。
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    expect(rollQuality(legendary(), 3000)).toBe("ancient");
  });

  it("5000階+はさらに上がる（mythic12% / ancient帯40%）", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1); // < 0.12
    expect(rollQuality(legendary(), 5000)).toBe("mythic");
    vi.spyOn(Math, "random").mockReturnValue(0.5); // < 0.52
    expect(rollQuality(legendary(), 5000)).toBe("ancient");
    vi.spyOn(Math, "random").mockReturnValue(0.6); // >= 0.52
    expect(rollQuality(legendary(), 5000)).toBeUndefined();
  });
});
