import { MODE_CONFIG } from "@/lib/arena/gameState";
import type { RunState } from "@/types/arena";

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  desc: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first_win", name: "初陣", emoji: "⚔️", desc: "1ラウンド勝利する" },
  { id: "boss_slayer", name: "ボスキラー", emoji: "👑", desc: "ボス戦に勝利する" },
  { id: "reach_r10", name: "歴戦", emoji: "🔟", desc: "10回戦に到達する" },
  { id: "clear_short", name: "ショート制覇", emoji: "🥇", desc: "ショートバトルで優勝する" },
  { id: "clear_long", name: "ロング制覇", emoji: "🏆", desc: "ロングバトルで優勝する" },
  { id: "flawless", name: "無傷の凱旋", emoji: "💎", desc: "ライフを1つも失わず優勝する" },
];

const KEY = "arena-achievements-v1";

export function loadAchievements(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function save(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/**
 * 1戦終了時点（finishBattle 後の run）で達成できる実績IDを判定する。
 * run は決着反映後の状態（wins/life/phase が更新済み）を渡す。
 */
export function evaluateAchievements(run: RunState, won: boolean): string[] {
  const ids: string[] = [];
  if (won) ids.push("first_win");
  if (won && run.lastResult?.boss) ids.push("boss_slayer");
  if (run.round >= 10) ids.push("reach_r10");
  if (run.phase === "victory") {
    ids.push(run.mode === "short" ? "clear_short" : "clear_long");
    if (run.life === MODE_CONFIG[run.mode].lives) ids.push("flawless");
  }
  return ids;
}

/** 新規達成分をマージして保存し、(全達成ID, 今回新規ID) を返す。 */
export function unlockAchievements(candidateIds: string[]): {
  all: string[];
  fresh: string[];
} {
  const current = loadAchievements();
  const fresh = candidateIds.filter((id) => !current.includes(id));
  if (fresh.length === 0) return { all: current, fresh: [] };
  const all = [...current, ...fresh];
  save(all);
  return { all, fresh };
}
