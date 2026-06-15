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
};

/** Attack multiplier for a class (defaults to 1.0). */
export function jobAttackMult(id: ClassId): number {
  return jobBalanceConfig[id]?.attackMult ?? 1.0;
}
