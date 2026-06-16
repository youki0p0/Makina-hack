import type { Progress } from "@/types/game";

export type FeatureId = "casino" | "artifacts" | "forge";

export interface FeatureUnlock {
  id: FeatureId;
  check: (p: Progress) => boolean;
  hint: string;
}

export const FEATURE_UNLOCKS: Record<FeatureId, FeatureUnlock> = {
  artifacts: {
    id: "artifacts",
    check: (p) => p.maxFloor >= 5,
    hint: "5階に到達で解放",
  },
  casino: {
    id: "casino",
    check: (p) => p.bossKills >= 1,
    hint: "ボスを1体撃破で解放",
  },
  forge: {
    id: "forge",
    check: (p) => p.maxFloor >= 10,
    hint: "10階に到達で解放",
  },
};

export function isFeatureUnlocked(id: FeatureId, progress: Progress): boolean {
  return FEATURE_UNLOCKS[id].check(progress);
}
