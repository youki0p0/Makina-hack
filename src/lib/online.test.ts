import { describe, expect, it } from "vitest";
import {
  DUMMY_RANKING,
  loadRanking,
  localRankingRepository,
  rankEntries,
  rankingSource,
  sanitizeEntry,
  type RankingEntry,
} from "@/lib/ranking";
import {
  echoRewards,
  generateEcho,
  TRIAL_COUNT,
  TRIAL_GHOSTS,
  TRIAL_REWARD_BONUS,
} from "@/lib/echoBattle";

const sample: RankingEntry = {
  playerName: "Tester",
  highestFloorReached: 500,
  cleared1000: false,
  endlessAbyssFloor: 0,
  job: "mage",
  difficulty: "hell",
  title: "",
  hasShinkiMakina: false,
  equippedWeaponName: "杖",
  equipmentScore: 4000,
  totalPlayTime: 1000,
  updatedAt: new Date().toISOString(),
};

describe("ranking validation", () => {
  it("rejects out-of-range floors", () => {
    expect(sanitizeEntry({ ...sample, highestFloorReached: 0 })).toBeNull();
    expect(sanitizeEntry({ ...sample, highestFloorReached: 1_000_000 })).toBeNull();
  });

  it("defaults blank names to Guest and clamps absurd scores", () => {
    const out = sanitizeEntry({ ...sample, playerName: "   ", equipmentScore: 9e9 })!;
    expect(out.playerName).toBe("Guest");
    expect(out.equipmentScore).toBeLessThanOrEqual(1_000_000);
  });

  it("keeps a valid entry", () => {
    expect(sanitizeEntry(sample)?.playerName).toBe("Tester");
  });
});

describe("ranking filtering/sorting", () => {
  it("sorts by floor desc for total", () => {
    const r = rankEntries(DUMMY_RANKING, { kind: "total" });
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].highestFloorReached).toBeGreaterThanOrEqual(r[i].highestFloorReached);
    }
  });

  it("makina filter only shows 神機マキナ holders", () => {
    expect(rankEntries(DUMMY_RANKING, { kind: "makina" }).every((e) => e.hasShinkiMakina)).toBe(true);
  });

  it("endless filter only shows endless divers", () => {
    expect(rankEntries(DUMMY_RANKING, { kind: "endless" }).every((e) => e.endlessAbyssFloor > 0)).toBe(true);
  });
});

describe("ranking repository (no Supabase configured)", () => {
  it("defaults to the local source", () => {
    expect(rankingSource()).toBe("local");
  });

  it("loadRanking falls back to local dummy data", async () => {
    const rows = await loadRanking({ kind: "total" });
    expect(rows.length).toBeGreaterThan(0);
  });

  it("local repo accepts a valid submission, rejects garbage", async () => {
    expect(await localRankingRepository.submit(sample)).toBe(true);
    expect(await localRankingRepository.submit({ ...sample, highestFloorReached: -5 })).toBe(false);
  });
});

describe("echo battle generation", () => {
  it("scales HP with reached floor", () => {
    const deep = generateEcho({ ...sample, highestFloorReached: 1000 });
    const shallow = generateEcho({ ...sample, highestFloorReached: 100 });
    expect(deep.maxHp).toBeGreaterThan(shallow.maxHp);
  });

  it("神機マキナ holders are stable (no special ability)", () => {
    expect(generateEcho({ ...sample, hasShinkiMakina: true }).ability).toBeNull();
  });

  it("higher difficulty echoes hit harder", () => {
    const hell = generateEcho({ ...sample, difficulty: "hell" });
    const normal = generateEcho({ ...sample, difficulty: "normal" });
    expect(hell.attack).toBeGreaterThan(normal.attack);
  });

  it("rewards are positive", () => {
    const r = echoRewards(sample);
    expect(r.gold).toBeGreaterThan(0);
    expect(r.rankPoints).toBeGreaterThan(0);
  });

  it("the trial ladder has 20 escalating ghosts", () => {
    expect(TRIAL_GHOSTS).toHaveLength(TRIAL_COUNT);
    const first = generateEcho(TRIAL_GHOSTS[0]);
    const last = generateEcho(TRIAL_GHOSTS[TRIAL_COUNT - 1]);
    expect(last.maxHp).toBeGreaterThan(first.maxHp);
    expect(last.attack).toBeGreaterThan(first.attack);
    expect(TRIAL_GHOSTS[TRIAL_COUNT - 1].hasShinkiMakina).toBe(true);
  });

  it("trial rewards are a notch larger than the raw strength", () => {
    const base = echoRewards(TRIAL_GHOSTS[9]);
    const trial = echoRewards(TRIAL_GHOSTS[9], TRIAL_REWARD_BONUS);
    expect(trial.gold).toBeGreaterThan(base.gold);
  });
});
