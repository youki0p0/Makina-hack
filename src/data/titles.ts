import type { Progress } from "@/types/game";

export interface Title {
  id: string;
  name: string;
  desc: string;
  /** Unlock condition (none = always available). */
  check?: (p: Progress) => boolean;
}

export const TITLES: readonly Title[] = [
  { id: "", name: "（なし）", desc: "称号なし" },
  { id: "novice", name: "駆け出し", desc: "敵を10体撃破", check: (p) => p.kills >= 10 },
  { id: "explorer", name: "探索者", desc: "5階に到達", check: (p) => p.maxFloor >= 5 },
  { id: "abyss", name: "深淵歩き", desc: "20階に到達", check: (p) => p.maxFloor >= 20 },
  { id: "veteran", name: "歴戦の勇者", desc: "敵を50体撃破", check: (p) => p.kills >= 50 },
  { id: "dragonslayer", name: "竜殺し", desc: "ボスを5体撃破", check: (p) => p.bossKills >= 5 },
  { id: "unbeaten", name: "無敗の覇者", desc: "10連勝", check: (p) => p.maxStreak >= 10 },
  { id: "reborn", name: "輪廻の者", desc: "3回転生", check: (p) => p.rebirths >= 3 },
  { id: "gambler", name: "賭博師", desc: "カジノでジャックポット", check: (p) => p.jackpots >= 1 },
  { id: "collector", name: "蒐集家", desc: "装備を12種発見", check: (p) => p.discoveredItems.length >= 12 },
  { id: "makina_0001", name: "Makina-0001", desc: "1000階の終端を見届けた者", check: (p) => p.endingSeen },
];

const TITLE_MAP: Map<string, Title> = new Map(TITLES.map((t) => [t.id, t]));

export function getTitle(id: string): Title {
  return TITLE_MAP.get(id) ?? TITLES[0];
}

export function isTitleUnlocked(id: string, progress: Progress): boolean {
  const t = TITLE_MAP.get(id);
  if (!t || !t.check) return true;
  return t.check(progress);
}

export function normalizeTitleId(id: string | undefined, progress: Progress): string {
  if (!id) return "";
  return isTitleUnlocked(id, progress) ? id : "";
}
