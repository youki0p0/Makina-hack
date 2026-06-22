// ===== デイリー/ウィークリー（ログインボーナス & クエスト）=====
// クエスト進捗は「累計カウンタ(Progress)のスナップショット差分」で測る。リセット時に
// 基準(base)を取り、現在値 - base で進捗を出すので、各イベントにフックを刺さずに済む。
// 報酬・定義はここに集約（純粋データ）。状態/付与は gameStore。

import type { Progress, QuestSnapshot, Reward, RewardKind } from "@/types/game";

export type QuestMetric = keyof QuestSnapshot;

export interface QuestDef {
  id: string;
  label: string;
  metric: QuestMetric;
  target: number;
  reward: Reward;
}

/** 報酬の表示情報。 */
export const REWARD_INFO: Record<RewardKind, { label: string; icon: string }> = {
  gold: { label: "ゴールド", icon: "🪙" },
  gacha: { label: "強化素材", icon: "🔮" },
  coins: { label: "コイン", icon: "🎰" },
  souls: { label: "転生ポイント", icon: "🪽" },
  shard: { label: "欠片", icon: "🔹" },
  core: { label: "核", icon: "🔶" },
  sigil: { label: "刻印", icon: "💠" },
};

export function rewardText(r: Reward): string {
  return `${REWARD_INFO[r.kind].icon}${REWARD_INFO[r.kind].label} +${r.amount}`;
}

// ---- デイリークエスト（毎日0時リセット・小粒）----
export const DAILY_QUESTS: readonly QuestDef[] = [
  { id: "d_kills", label: "敵を15体倒す", metric: "kills", target: 15, reward: { kind: "gacha", amount: 40 } },
  { id: "d_boss", label: "ボスを3体倒す", metric: "bossKills", target: 3, reward: { kind: "gold", amount: 800 } },
  { id: "d_forge", label: "装備を1回強化する", metric: "forgeCount", target: 1, reward: { kind: "coins", amount: 40 } },
];

// ---- ウィークリークエスト（月曜0時リセット・大粒）----
export const WEEKLY_QUESTS: readonly QuestDef[] = [
  { id: "w_kills", label: "敵を200体倒す", metric: "kills", target: 200, reward: { kind: "souls", amount: 2 } },
  { id: "w_boss", label: "ボスを30体倒す", metric: "bossKills", target: 30, reward: { kind: "shard", amount: 10 } },
  { id: "w_dungeon", label: "ダンジョン/ラッシュを5回踏破", metric: "dungeonClears", target: 5, reward: { kind: "core", amount: 3 } },
];

// ---- ログインボーナスカレンダー（7日周期・1日1回・Day7が大盤振る舞い）----
export const LOGIN_CALENDAR: readonly Reward[] = [
  { kind: "gold", amount: 300 },
  { kind: "gacha", amount: 30 },
  { kind: "coins", amount: 50 },
  { kind: "gold", amount: 800 },
  { kind: "gacha", amount: 60 },
  { kind: "shard", amount: 5 },
  { kind: "souls", amount: 2 },
];
export const LOGIN_CYCLE = LOGIN_CALENDAR.length;

/** 現在の累計カウンタを取り出す（base 用）。 */
export function questCounters(p: Progress): QuestSnapshot {
  return { kills: p.kills, bossKills: p.bossKills, forgeCount: p.forgeCount, dungeonClears: p.dungeonClears };
}

/** クエスト進捗 = 現在 - base（0以上）。 */
export function questProgress(cur: QuestSnapshot, base: QuestSnapshot, metric: QuestMetric): number {
  return Math.max(0, cur[metric] - base[metric]);
}

export function questDone(cur: QuestSnapshot, base: QuestSnapshot, q: QuestDef): boolean {
  return questProgress(cur, base, q.metric) >= q.target;
}

export function emptySnapshot(): QuestSnapshot {
  return { kills: 0, bossKills: 0, forgeCount: 0, dungeonClears: 0 };
}

export function normalizeSnapshot(s?: Partial<QuestSnapshot> | null): QuestSnapshot {
  const base = emptySnapshot();
  if (!s) return base;
  for (const k of ["kills", "bossKills", "forgeCount", "dungeonClears"] as QuestMetric[]) {
    const v = s[k];
    if (typeof v === "number" && v >= 0) base[k] = Math.floor(v);
  }
  return base;
}
