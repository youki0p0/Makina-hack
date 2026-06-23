import type { GameMode, RankRecord } from "@/types/arena";

// 本編（dice-hackslash-save-*）とは別キー。混線しないよう arena 名前空間で保存。
const KEY = (mode: GameMode) => `arena-rank-${mode}-v1`;

const EMPTY: RankRecord = { bestWins: 0, bestRound: 0, games: 0, wins: 0 };

export function loadRank(mode: GameMode): RankRecord {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(KEY(mode));
    if (!raw) return { ...EMPTY };
    const data = JSON.parse(raw) as Partial<RankRecord>;
    return { ...EMPTY, ...data };
  } catch {
    return { ...EMPTY };
  }
}

export function saveRank(mode: GameMode, rec: RankRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(mode), JSON.stringify(rec));
  } catch {
    /* 保存失敗は無視（プライベートブラウズ等） */
  }
}

/** 1ゲーム終了時に成績を反映して返す。 */
export function recordResult(
  mode: GameMode,
  wins: number,
  round: number,
  cleared: boolean,
): RankRecord {
  const cur = loadRank(mode);
  const next: RankRecord = {
    bestWins: Math.max(cur.bestWins, wins),
    bestRound: Math.max(cur.bestRound, round),
    games: cur.games + 1,
    wins: cur.wins + (cleared ? 1 : 0),
  };
  saveRank(mode, next);
  return next;
}

/** 勝利数からお遊びのランク称号を出す。 */
export function rankTitle(bestWins: number): string {
  if (bestWins >= 15) return "🏆 グランドマスター";
  if (bestWins >= 12) return "💎 ダイヤ";
  if (bestWins >= 9) return "🥇 ゴールド";
  if (bestWins >= 6) return "🥈 シルバー";
  if (bestWins >= 3) return "🥉 ブロンズ";
  return "🔰 ルーキー";
}
