// ===== Rebirth-point milestones & floor achievements =====
// Rebirth points (souls) are earned ONLY by reaching a NEW highest floor at a
// 100-floor milestone — never on death, never from checkpoint farming, never
// from re-clearing. This keeps low-floor grinding from generating souls.

/** Souls awarded the first time the given milestone floor is reached. */
export function milestoneSouls(floor: number): number {
  if (floor % 100 !== 0 || floor < 100) return 0;
  const n = floor / 100;
  if (n <= 9) return n; // 100→1 … 900→9
  if (n === 10) return 15; // 1000 clear: big payout
  return 10 + (n - 10) * 2; // endless: 1100→12, 1200→14, …
}

/** The next milestone floor strictly above `highest` (always a multiple of 100). */
export function nextMilestoneFloor(highest: number): number {
  return (Math.floor(highest / 100) + 1) * 100;
}

/**
 * All milestone floors in (prevHighest, newHighest] — the freshly-crossed ones.
 */
export function crossedMilestones(prevHighest: number, newHighest: number): number[] {
  const out: number[] = [];
  let f = nextMilestoneFloor(prevHighest);
  while (f <= newHighest) {
    out.push(f);
    f += 100;
  }
  return out;
}

// ===== Floor achievements (#15) =====
// Distinct one-time rewards for reaching landmark depths. These pay gacha
// material (素材) so they complement the soul milestones above.

export interface FloorAchievement {
  /** Stable id stored in progress.claimedFloorAchievements. */
  id: string;
  floor: number;
  name: string;
  /** Gacha material reward. */
  gachaPoints: number;
  /** Bonus souls (only the deep ones). */
  souls?: number;
}

export const FLOOR_ACHIEVEMENTS: readonly FloorAchievement[] = [
  { id: "floor10", floor: 10, name: "10階到達", gachaPoints: 20 },
  { id: "floor50", floor: 50, name: "50階到達", gachaPoints: 50 },
  { id: "floor100", floor: 100, name: "100階到達", gachaPoints: 120, souls: 1 },
  { id: "floor500", floor: 500, name: "500階到達", gachaPoints: 400, souls: 3 },
  { id: "floor1000", floor: 1000, name: "1000階制覇", gachaPoints: 1000, souls: 10 },
  { id: "endless", floor: 1001, name: "Endless Abyss 到達", gachaPoints: 1500, souls: 15 },
];

/** Floor achievements newly satisfied by reaching `newHighest` (not yet claimed). */
export function newlyEarnedFloorAchievements(
  newHighest: number,
  claimed: string[],
): FloorAchievement[] {
  return FLOOR_ACHIEVEMENTS.filter(
    (a) => newHighest >= a.floor && !claimed.includes(a.id),
  );
}
