import { describe, expect, it } from "vitest";
import { defaultProgress } from "@/data/achievements";
import {
  DAILY_QUESTS,
  LOGIN_CALENDAR,
  LOGIN_CYCLE,
  normalizeSnapshot,
  questCounters,
  questDone,
  questProgress,
  rewardText,
  WEEKLY_QUESTS,
} from "@/data/quests";
import { todayKey, weekKey } from "@/lib/maintenance";

describe("quest snapshot delta", () => {
  it("progress = current - base, clamped at 0", () => {
    const base = { kills: 10, bossKills: 2, forgeCount: 0, dungeonClears: 1 };
    const cur = { kills: 27, bossKills: 5, forgeCount: 0, dungeonClears: 1 };
    expect(questProgress(cur, base, "kills")).toBe(17);
    expect(questProgress(cur, base, "bossKills")).toBe(3);
    expect(questProgress(cur, base, "forgeCount")).toBe(0);
    // base ahead of cur (shouldn't happen) → clamps to 0
    expect(questProgress(base, cur, "kills")).toBe(0);
  });

  it("questDone compares against the def target", () => {
    const base = { kills: 0, bossKills: 0, forgeCount: 0, dungeonClears: 0 };
    const q = DAILY_QUESTS.find((d) => d.id === "d_kills")!;
    expect(questDone({ ...base, kills: q.target - 1 }, base, q)).toBe(false);
    expect(questDone({ ...base, kills: q.target }, base, q)).toBe(true);
  });

  it("questCounters reads only the tracked cumulative fields", () => {
    const p = { ...defaultProgress(), kills: 5, bossKills: 1, forgeCount: 2, dungeonClears: 3 };
    expect(questCounters(p)).toEqual({ kills: 5, bossKills: 1, forgeCount: 2, dungeonClears: 3 });
  });
});

describe("quest/login data integrity", () => {
  it("login calendar has a full cycle of rewards", () => {
    expect(LOGIN_CALENDAR.length).toBe(LOGIN_CYCLE);
    expect(LOGIN_CYCLE).toBe(7);
    for (const r of LOGIN_CALENDAR) expect(r.amount).toBeGreaterThan(0);
  });
  it("daily + weekly quests have unique ids and positive targets", () => {
    const all = [...DAILY_QUESTS, ...WEEKLY_QUESTS];
    const ids = new Set(all.map((q) => q.id));
    expect(ids.size).toBe(all.length);
    for (const q of all) expect(q.target).toBeGreaterThan(0);
  });
  it("rewardText renders icon + amount", () => {
    expect(rewardText({ kind: "souls", amount: 2 })).toContain("+2");
  });
  it("normalizeSnapshot fills/floors partials", () => {
    expect(normalizeSnapshot(undefined)).toEqual({ kills: 0, bossKills: 0, forgeCount: 0, dungeonClears: 0 });
    expect(normalizeSnapshot({ kills: 3.9 }).kills).toBe(3);
  });
});

describe("week key", () => {
  it("is stable within a week and changes across the Monday boundary", () => {
    // 2026-06-22 is a Monday.
    const mon = weekKey(new Date(2026, 5, 22));
    const sun = weekKey(new Date(2026, 5, 28)); // same week (Sun)
    const nextMon = weekKey(new Date(2026, 5, 29));
    expect(mon).toBe(sun);
    expect(mon).not.toBe(nextMon);
    expect(todayKey(new Date(2026, 5, 22))).toBe("2026-6-22");
  });
});
