// ===== Echo Battle (残響戦) =====
// You don't fight other players — you fight the *records* they left behind,
// reconstructed in the dungeon as "echoes". An echo is just a CPU enemy built
// deterministically from a ranking entry. No realtime networking.

import { getDifficulty, normalizeDifficulty } from "@/data/difficulty";
import { genItem, SLOT_LIST } from "@/data/items";
import { modTierForFloor } from "@/data/modifiers";
import { hashSeed } from "@/lib/itemIcon";
import type { RankingEntry } from "@/lib/ranking";
import type { EnemyAbility, Enemy, Equipment } from "@/types/game";

/** Job → echo behaviour tendency (drives the CPU's special action). */
const JOB_ABILITY: Record<string, EnemyAbility | null> = {
  warrior: "fierce",
  berserker: "multiAttack",
  rogue: "multiAttack",
  mage: "shock",
  hexer: "poison",
  paladin: "defend",
  adventurer: null,
};

/** Build a CPU enemy ("echo") from a ranking entry. */
export function generateEcho(entry: RankingEntry): Enemy {
  const floor = Math.max(1, entry.highestFloorReached);
  const diffMult = getDifficulty(normalizeDifficulty(entry.difficulty)).enemyMult;

  // HP scales with reached depth; attack with the gear score. High-difficulty
  // records hit harder. 神機マキナ holders are stable normal-attack types.
  const maxHp = Math.round((60 + floor * 4) * diffMult);
  const attack = Math.round((6 + entry.equipmentScore * 0.012 + floor * 0.15) * diffMult);
  const defense = Math.round(2 + floor * 0.06);
  const ability = entry.hasShinkiMakina ? null : JOB_ABILITY[entry.job] ?? null;

  return {
    id: `echo_${hashSeed(entry.playerName + entry.updatedAt)}`,
    templateId: `echo_${entry.job}`,
    name: `${entry.playerName}の残響`,
    emoji: "👤",
    maxHp,
    hp: maxHp,
    attack,
    defense,
    exp: Math.round(20 + floor * 0.5),
    gold: Math.round(50 + floor * 2),
    dropRate: 1,
    isBoss: entry.cleared1000 || entry.hasShinkiMakina,
    statuses: [],
    stunTurns: 0,
    ability,
    bonusDefense: 0,
    bonusDefenseTurns: 0,
    weakenAmount: 0,
    weakenTurns: 0,
    enraged: false,
    charging: false,
    chargeCounter: 0,
    modTier: modTierForFloor(floor),
  };
}

// ===== Trial ground (試し場) =====
// A fixed ladder of 20 practice ghosts of escalating strength, so Echo Battles
// can be tested without depending on real ranking data. Beating a trial pays a
// notch more than its nominal strength (see TRIAL_REWARD_BONUS).

export const TRIAL_COUNT = 20;
/** Trials reward "ひと回り" (a notch) more than their raw strength. */
export const TRIAL_REWARD_BONUS = 1.3;

const TRIAL_JOBS = ["adventurer", "warrior", "rogue", "mage", "berserker", "paladin", "hexer"];
const TRIAL_DIFFS = ["normal", "hard", "hell", "expert"];

/** Build the practice ghost for trial level 1..TRIAL_COUNT. */
export function trialGhost(level: number): RankingEntry {
  const lv = Math.max(1, Math.min(TRIAL_COUNT, Math.round(level)));
  const floor = lv * 60; // 60 … 1200
  return {
    playerName: `試練Lv${lv}`,
    highestFloorReached: floor,
    cleared1000: floor >= 1000,
    endlessAbyssFloor: floor > 1000 ? floor - 1000 : 0,
    job: TRIAL_JOBS[(lv - 1) % TRIAL_JOBS.length],
    // Difficulty steps up every 5 levels (normal→hard→hell→expert).
    difficulty: TRIAL_DIFFS[Math.min(TRIAL_DIFFS.length - 1, Math.floor((lv - 1) / 5))],
    title: "",
    hasShinkiMakina: lv >= TRIAL_COUNT,
    equippedWeaponName: "残響の刃",
    equipmentScore: lv * 450,
    totalPlayTime: 0,
    updatedAt: new Date(0).toISOString(),
  };
}

/** The full 20-step trial ladder. */
export const TRIAL_GHOSTS: RankingEntry[] = Array.from({ length: TRIAL_COUNT }, (_, i) =>
  trialGhost(i + 1),
);

export interface EchoRewards {
  gold: number;
  gachaPoints: number;
  rankPoints: number;
}

/**
 * Rewards for defeating an echo (scales with the record's depth/difficulty).
 * `bonus` multiplies all rewards (trials pass TRIAL_REWARD_BONUS for a notch more).
 */
export function echoRewards(entry: RankingEntry, bonus = 1): EchoRewards {
  const floor = Math.max(1, entry.highestFloorReached);
  const diffMult = getDifficulty(normalizeDifficulty(entry.difficulty)).rewardMult;
  return {
    gold: Math.round((60 + floor * 2.5) * diffMult * bonus),
    gachaPoints: Math.round((6 + floor * 0.12) * diffMult * bonus),
    rankPoints: Math.round((10 + floor * 0.06 + (diffMult - 1) * 20) * bonus),
  };
}

/**
 * Low chance to drop an "echo equipment": a normal-power item with a distinct
 * (ghostly) look. Deliberately NOT stronger than ordinary gear.
 */
export function rollEchoEquipment(entry: RankingEntry): Equipment | null {
  if (Math.random() > 0.12) return null;
  const floor = Math.max(1, entry.highestFloorReached);
  const slot = SLOT_LIST[Math.floor(Math.random() * SLOT_LIST.length)];
  const tier = Math.max(1, Math.min(floor, 60));
  const base = genItem(slot, tier);
  return {
    ...base,
    name: `残響の${base.name}`,
    echo: true,
    description: `${base.description}（残響装備）`,
  };
}
