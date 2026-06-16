// ===== Job (class) balance =====
// Centralized power multipliers per class so balancing lives in one place.
// Applied as a multiplier on the player's computed attack. Paladin stays the
// reference (1.0, the durable tank); offensive classes scale up from there.

import type { ClassId } from "@/types/game";

export interface JobBalance {
  /** Multiplier on final computed attack. */
  attackMult: number;
  /** Short note for tuning context. */
  note: string;
}

export const jobBalanceConfig: Record<ClassId, JobBalance> = {
  adventurer: { attackMult: 1.0, note: "基準（初期職）" },
  paladin: { attackMult: 1.0, note: "現状維持・耐久型" },
  warrior: { attackMult: 1.8, note: "約1.8倍" },
  rogue: { attackMult: 1.5, note: "約1.5倍" },
  mage: { attackMult: 2.2, note: "約2.2倍" },
  berserker: { attackMult: 2.0, note: "約2倍" },
  hexer: { attackMult: 1.6, note: "弱体寄り・やや火力" },
  // Upper jobs (200F) — a notch above the strongest base (mage 2.2).
  swordsaint: { attackMult: 2.4, note: "上位・剣の極み" },
  archmage: { attackMult: 2.6, note: "上位・魔の極致" },
  warlord: { attackMult: 2.7, note: "上位・超火力(リスク)" },
  // Elite jobs (500F) — white/black, even stronger.
  celestial: { attackMult: 2.8, note: "白の上位・攻防一体" },
  abyssal: { attackMult: 3.0, note: "黒の上位・最強格(リスク)" },
};

/** Attack multiplier for a class (defaults to 1.0). */
export function jobAttackMult(id: ClassId): number {
  return jobBalanceConfig[id]?.attackMult ?? 1.0;
}
