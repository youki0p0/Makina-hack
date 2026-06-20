import { describe, expect, test } from "vitest";
import { maintenanceNeeded, todayKey } from "@/lib/maintenance";

describe("daily memory-release maintenance", () => {
  test("fresh state (no marker) needs maintenance", () => {
    expect(maintenanceNeeded(null, "2026-6-18", 1)).toBe(true);
    expect(maintenanceNeeded({}, "2026-6-18", 1)).toBe(true);
  });

  test("same day + same force version skips", () => {
    expect(maintenanceNeeded({ day: "2026-6-18", v: 1 }, "2026-6-18", 1)).toBe(false);
  });

  test("a new day triggers maintenance", () => {
    expect(maintenanceNeeded({ day: "2026-6-18", v: 1 }, "2026-6-19", 1)).toBe(true);
  });

  test("a bumped force version triggers a one-time maintenance", () => {
    // Same day, but the force version moved 1 -> 2.
    expect(maintenanceNeeded({ day: "2026-6-18", v: 1 }, "2026-6-18", 2)).toBe(true);
  });

  test("todayKey is stable for the same calendar day", () => {
    const a = new Date(2026, 5, 18, 1, 0, 0);
    const b = new Date(2026, 5, 18, 23, 59, 0);
    expect(todayKey(a)).toBe(todayKey(b));
    expect(todayKey(new Date(2026, 5, 19))).not.toBe(todayKey(a));
  });
});
