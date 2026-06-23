// ===== 🎆 ダイス花火大会（7月限定スコアアタック）=====
// 現行コンテンツ（ダンジョン/装備/ステータス）から完全に切り離した、夏の限定ミニゲーム。
// FIREWORKS_SHOTS 連発のダイスを打ち上げ、出目とコンボでスコアを競う（自己ベスト制）。
// 純粋計算のみ。状態（自己ベスト/受領済み報酬）は gameStore、UI は app/summer。

import type { Reward } from "@/types/game";

/** 1回のチャレンジで打ち上げる花火の数。 */
export const FIREWORKS_SHOTS = 10;

/** 7月か（端末ローカル日付）。イベントの出現可否に使う。 */
export function isJuly(d: Date = new Date()): boolean {
  return d.getMonth() === 6; // 0=Jan … 6=Jul
}

export interface ShotOutcome {
  /** 出目 1..6。 */
  value: number;
  /** この一発の獲得スコア。 */
  points: number;
  /** 更新後の連続「4以上」コンボ段数（0=コンボ無し）。 */
  combo: number;
}

/**
 * 一発の花火を解決する。出目4以上で連続すると倍率が上がり（+0.5/段）、
 * 出目6は「大輪」で +50 ボーナス。3以下はコンボがリセット（倍率なし）。
 */
export function resolveShot(value: number, prevCombo: number): ShotOutcome {
  const isHigh = value >= 4;
  const combo = isHigh ? prevCombo + 1 : 0;
  const mult = isHigh ? 1 + combo * 0.5 : 1; // 初回の4+は combo1 → ×1.5
  let points = Math.round(value * 10 * mult);
  if (value === 6) points += 50; // 大輪ボーナス
  return { value, points, combo };
}

/** 出目列（長さ FIREWORKS_SHOTS 前提）からスコア内訳を組み立てる。 */
export function runFireworks(values: number[]): { shots: ShotOutcome[]; total: number } {
  const shots: ShotOutcome[] = [];
  let combo = 0;
  let total = 0;
  for (const v of values) {
    const o = resolveShot(v, combo);
    combo = o.combo;
    total += o.points;
    shots.push(o);
  }
  return { shots, total };
}

/** スコアに応じたメダル（見栄え用・バランス非干渉）。 */
export function fireworksMedal(score: number): string {
  if (score >= 15000) return "🌈";
  if (score >= 8000) return "🥇";
  if (score >= 3000) return "🥈";
  if (score >= 1000) return "🥉";
  return "🎆";
}

/**
 * スコア達成で1回だけもらえる控えめな実用報酬（7月の自己ベストで判定）。
 * 本編バランスを壊さない小額に留める。"join" は初参加(スコア0)で受領可。
 */
export interface SummerMilestone {
  id: string;
  minScore: number;
  label: string;
  reward: Reward;
}

export const SUMMER_MILESTONES: readonly SummerMilestone[] = [
  { id: "join", minScore: 0, label: "初参加", reward: { kind: "gacha", amount: 30 } },
  { id: "s3000", minScore: 3000, label: "スコア3000", reward: { kind: "coins", amount: 100 } },
  { id: "s8000", minScore: 8000, label: "スコア8000", reward: { kind: "shard", amount: 5 } },
  { id: "s15000", minScore: 15000, label: "スコア15000", reward: { kind: "gacha", amount: 150 } },
];

/** 自己ベストで「受領可能だが未受領」のマイルストーンを返す。 */
export function claimableMilestones(best: number, claimed: string[]): SummerMilestone[] {
  return SUMMER_MILESTONES.filter((m) => best >= m.minScore && !claimed.includes(m.id));
}
