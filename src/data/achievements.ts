import type { Progress } from "@/types/game";

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  check: (p: Progress) => boolean;
}

export function defaultProgress(): Progress {
  return {
    maxFloor: 1,
    kills: 0,
    bossKills: 0,
    rebirths: 0,
    jackpots: 0,
    maxStreak: 0,
    discoveredItems: [],
    defeatedEnemies: [],
    highestFloorReached: 1,
    claimedMilestones: [],
    claimedFloorAchievements: [],
    endingSeen: false,
    ngPlus: 0,
    makinaGranted: false,
    claimedEndlessMessages: [],
  };
}

/** Coerce possibly-partial saved progress into a complete object. */
export function normalizeProgress(p?: Partial<Progress>): Progress {
  const base = defaultProgress();
  if (!p) return base;
  return {
    maxFloor: typeof p.maxFloor === "number" ? p.maxFloor : base.maxFloor,
    kills: typeof p.kills === "number" ? p.kills : 0,
    bossKills: typeof p.bossKills === "number" ? p.bossKills : 0,
    rebirths: typeof p.rebirths === "number" ? p.rebirths : 0,
    jackpots: typeof p.jackpots === "number" ? p.jackpots : 0,
    maxStreak: typeof p.maxStreak === "number" ? p.maxStreak : 0,
    discoveredItems: Array.isArray(p.discoveredItems) ? [...p.discoveredItems] : [],
    defeatedEnemies: Array.isArray(p.defeatedEnemies) ? [...p.defeatedEnemies] : [],
    highestFloorReached:
      typeof p.highestFloorReached === "number" ? p.highestFloorReached : base.highestFloorReached,
    claimedMilestones: Array.isArray(p.claimedMilestones) ? [...p.claimedMilestones] : [],
    claimedFloorAchievements: Array.isArray(p.claimedFloorAchievements)
      ? [...p.claimedFloorAchievements]
      : [],
    endingSeen: p.endingSeen === true,
    ngPlus: typeof p.ngPlus === "number" ? p.ngPlus : 0,
    makinaGranted: p.makinaGranted === true,
    claimedEndlessMessages: Array.isArray(p.claimedEndlessMessages)
      ? [...p.claimedEndlessMessages]
      : [],
  };
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "floor5", name: "ダンジョン探索者", icon: "🚪", desc: "5階に到達", check: (p) => p.maxFloor >= 5 },
  { id: "floor10", name: "深層の挑戦者", icon: "🗺️", desc: "10階に到達", check: (p) => p.maxFloor >= 10 },
  { id: "floor20", name: "奈落の踏破者", icon: "🏔️", desc: "20階に到達", check: (p) => p.maxFloor >= 20 },
  { id: "kills10", name: "駆け出し", icon: "⚔️", desc: "敵を10体撃破", check: (p) => p.kills >= 10 },
  { id: "kills50", name: "歴戦", icon: "🗡️", desc: "敵を50体撃破", check: (p) => p.kills >= 50 },
  { id: "kills100", name: "殲滅者", icon: "💥", desc: "敵を100体撃破", check: (p) => p.kills >= 100 },
  { id: "boss1", name: "ボスキラー", icon: "🐲", desc: "ボスを1体撃破", check: (p) => p.bossKills >= 1 },
  { id: "boss5", name: "竜殺し", icon: "🔥", desc: "ボスを5体撃破", check: (p) => p.bossKills >= 5 },
  { id: "rebirth1", name: "輪廻", icon: "🔮", desc: "初めて転生する", check: (p) => p.rebirths >= 1 },
  { id: "rebirth3", name: "周回者", icon: "♻️", desc: "3回転生する", check: (p) => p.rebirths >= 3 },
  { id: "jackpot", name: "大当たり", icon: "🎰", desc: "カジノでジャックポット", check: (p) => p.jackpots >= 1 },
  { id: "streak5", name: "連勝街道", icon: "🔥", desc: "5連勝", check: (p) => p.maxStreak >= 5 },
  { id: "streak10", name: "無敗の覇者", icon: "👑", desc: "10連勝", check: (p) => p.maxStreak >= 10 },
  { id: "collector", name: "コレクター", icon: "📦", desc: "装備を12種発見", check: (p) => p.discoveredItems.length >= 12 },
];

export function achievedCount(p: Progress): number {
  return ACHIEVEMENTS.filter((a) => a.check(p)).length;
}
