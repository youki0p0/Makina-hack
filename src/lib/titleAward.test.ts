import { describe, expect, it } from "vitest";
import { defaultProgress } from "@/data/achievements";
import { TITLES, titleSouls } from "@/data/titles";
import { grantTitles, splitSouls } from "@/lib/titleAward";
import type { Progress } from "@/types/game";

/** A progress object that satisfies (almost) every title. */
function maxedProgress(): Progress {
  return {
    ...defaultProgress(),
    maxFloor: 5000,
    kills: 99999,
    bossKills: 999,
    rebirths: 99,
    jackpots: 999,
    maxStreak: 999,
    discoveredItems: Array.from({ length: 60 }, (_, i) => `item${i}`),
    defeatedEnemies: Array.from({ length: 80 }, (_, i) => `enemy${i}`),
    highestFloorReached: 5000,
    claimedMilestones: [50, 100, 150, 200, 250],
    endingSeen: true,
    ngPlus: 99,
    makinaGranted: true,
    claimedEndlessMessages: [1, 2, 3, 4, 5],
    rankPoints: 99999,
    playSeconds: 99999999,
    slotBigCount: 999,
    totalCoinsWon: 9999999,
    daipanCount: 999,
    casinoBanned: true,
    fateWins: 99,
    forgeCount: 999,
    maxForgeLevel: 15,
    echoWins: 999,
    classesUsed: ["adventurer", "warrior", "rogue", "mage", "berserker", "paladin", "hexer", "swordsaint", "archmage", "warlord", "celestial", "abyssal"],
    setsCompleted: ["gambler", "vampire", "executioner", "oracle", "guardian", "storm", "inferno", "revenant", "trickster", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n"],
    noDamageBossKills: 99,
    perfectClears: 999,
    maxSingleHit: 999999,
    summerBest: 99999,
    oldEraPioneer: true,
  };
}

describe("title data integrity", () => {
  it("has 100+ awarding titles, all with unique ids, tier and check", () => {
    const awarding = TITLES.filter((t) => t.id !== "");
    expect(awarding.length).toBeGreaterThanOrEqual(100);
    const ids = new Set<string>();
    for (const t of awarding) {
      expect(t.tier, `${t.id} needs a tier`).toBeTruthy();
      expect(typeof t.check, `${t.id} needs a check`).toBe("function");
      expect(ids.has(t.id), `duplicate id ${t.id}`).toBe(false);
      ids.add(t.id);
    }
  });
});

describe("grantTitles", () => {
  it("grants nothing for a fresh save", () => {
    const res = grantTitles(defaultProgress(), 0);
    expect(res.unlocked).toEqual([]);
    expect(res.souls).toBe(0);
  });

  it("unlocks 100+ titles for maxed progress, reaches a fixpoint, then is idempotent", () => {
    const first = grantTitles(maxedProgress(), 0);
    expect(first.unlocked.length).toBeGreaterThan(100);
    expect(first.souls).toBeGreaterThan(0);
    // Iterate to a fixpoint (completionist unlocks once the rest are claimed).
    let cur = first;
    for (let i = 0; i < 4; i++) cur = grantTitles(cur.progress, cur.souls);
    // After the fixpoint, no further grants.
    const extra = grantTitles(cur.progress, cur.souls);
    expect(extra.unlocked).toEqual([]);
    // Every awarding title is now claimed.
    expect(cur.progress.claimedTitles.length).toBe(TITLES.filter((t) => t.tier).length);
  });

  it("completionist (真の称号) is earnable without the ultra-deep noComplete titles", () => {
    // Everything maxed except the climb stops at 1500F → f_e2000+ stay locked.
    const p: Progress = { ...maxedProgress(), maxFloor: 1500, highestFloorReached: 1500 };
    let cur = grantTitles(p, 0);
    for (let i = 0; i < 4; i++) cur = grantTitles(cur.progress, cur.souls);
    expect(cur.progress.claimedTitles).toContain("completionist");
    // The deep endless titles are NOT required for completion (and not yet reached).
    expect(cur.progress.claimedTitles).not.toContain("f_e2000");
  });

  it("accumulates fractional souls and only emits whole ones", () => {
    // Three 0.75 (medium) titles via a hand-built progress that satisfies exactly those.
    const p: Progress = { ...defaultProgress(), soulsFraction: 0 };
    // Force-claim everything except a few medium titles is complex; instead test splitSouls directly.
    const a = splitSouls(0.75 * 3); // 2.25
    expect(a.whole).toBe(2);
    expect(a.frac).toBe(0.25);
    const b = splitSouls(0.25 + 0.75); // carried 0.25 + a medium
    expect(b.whole).toBe(1);
    expect(b.frac).toBe(0);
    void p;
  });

  it("total soul budget for 100% completion stays in a sane band", () => {
    const res = grantTitles(maxedProgress(), 0);
    // whole souls + carried fraction = the exact total awarded.
    const total = res.souls + res.progress.soulsFraction;
    expect(total).toBeGreaterThan(40);
    expect(total).toBeLessThan(180);
  });
});
