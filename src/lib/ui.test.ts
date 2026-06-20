import { describe, expect, test } from "vitest";
import { fmt } from "@/lib/ui";

describe("fmt (lightweight thousands separator)", () => {
  test("output is identical to toLocaleString('en-US') across a range", () => {
    const vals = [
      0, 5, 42, 100, 999, 1000, 1234, 12345, 123456, 1234567, 1000000,
      999999999, 1234567890, -1, -1234, -1234567, 1234.6, 1234.4,
    ];
    for (const v of vals) {
      expect(fmt(v)).toBe(Math.round(v).toLocaleString("en-US"));
    }
  });

  test("normalizes -0 to '0' (never displays a stray '-0')", () => {
    // toLocaleString would render Math.round(-0.4) === -0 as "-0"; we render "0".
    expect(fmt(-0.4)).toBe("0");
    expect(fmt(-0)).toBe("0");
  });
});
