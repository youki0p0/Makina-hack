// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { loadRanking, submitRanking, type RankingEntry } from "@/lib/ranking";

const entry: RankingEntry = {
  playerName: "Tester",
  highestFloorReached: 123,
  cleared1000: false,
  endlessAbyssFloor: 0,
  job: "mage",
  difficulty: "hell",
  title: "",
  hasShinkiMakina: false,
  equippedWeaponName: "杖",
  equipmentScore: 1000,
  totalPlayTime: 0,
  updatedAt: new Date().toISOString(),
};

describe("ranking submit appears in the board (no Supabase)", () => {
  beforeEach(() => window.localStorage.clear());

  it("a submitted record shows up in loadRanking", async () => {
    const res = await submitRanking(entry);
    expect(res.ok).toBe(true);
    const rows = await loadRanking({ kind: "total" });
    expect(rows.some((r) => r.playerName === "Tester" && r.highestFloorReached === 123)).toBe(true);
  });

  it("shows under the matching difficulty filter too", async () => {
    await submitRanking(entry);
    const rows = await loadRanking({ kind: "difficulty", difficulty: "hell" });
    expect(rows.some((r) => r.playerName === "Tester")).toBe(true);
  });

  it("a returning player updates their row instead of duplicating", async () => {
    await submitRanking({ ...entry, playerName: "Dup", highestFloorReached: 100 });
    await submitRanking({ ...entry, playerName: "Dup", highestFloorReached: 300 });
    const rows = await loadRanking({ kind: "total" });
    const dups = rows.filter((r) => r.playerName === "Dup");
    expect(dups).toHaveLength(1);
    expect(dups[0].highestFloorReached).toBe(300);
  });
});
