// ===== 日替わりダンジョン & ボスラッシュ（回数制限コンテンツ）=====
// 通常のフロア攻略とは別枠のエンドゲーム周回コンテンツ。曜日で表情が変わる
// 「日替わりダンジョン」(素材を集める) と、常設の「ボスラッシュ」(コイン/EXP4倍) の2本。
// ここは純粋なデータ/計算のみ（状態は gameStore、戦闘は既存エンジンを runMode で再利用）。

import { FINAL_FLOOR } from "@/data/worlds";
import type { DungeonMaterials, MaterialId } from "@/types/game";

export type { DungeonMaterials, MaterialId };

export const MATERIAL_INFO: Record<MaterialId, { name: string; icon: string }> = {
  shard: { name: "ダンジョンの欠片", icon: "🔹" },
  core: { name: "ダンジョンの核", icon: "🔶" },
  sigil: { name: "覇者の刻印", icon: "💠" },
};

export function emptyMaterials(): DungeonMaterials {
  return { shard: 0, core: 0, sigil: 0 };
}

export function normalizeMaterials(m?: Partial<DungeonMaterials> | null): DungeonMaterials {
  const base = emptyMaterials();
  if (!m) return base;
  for (const k of ["shard", "core", "sigil"] as MaterialId[]) {
    const v = m[k];
    if (typeof v === "number" && v >= 0) base[k] = Math.floor(v);
  }
  return base;
}

// ---- 回数制限（毎日0時リセット）----
export const DAILY_BASE_USES = 3;
export const RUSH_BASE_USES = 5;
/** 到達で +1 ずつ増える節目（1000階クリア＋1500/2000/2500踏破）。 */
export const USE_MILESTONES: readonly number[] = [1000, 1500, 2000, 2500];

/** 節目到達数に応じた追加回数（0〜4）。 */
export function bonusUses(highestFloor: number): number {
  return USE_MILESTONES.filter((f) => highestFloor >= f).length;
}
export function maxDailyUses(highestFloor: number): number {
  return DAILY_BASE_USES + bonusUses(highestFloor);
}
export function maxRushUses(highestFloor: number): number {
  return RUSH_BASE_USES + bonusUses(highestFloor);
}

// ---- 日替わりダンジョンのレベル（Lv1 ≒ 100階相当の難度）----
export const DAILY_FLOOR_PER_LEVEL = 100;
/** 踏破階層に応じて挑めるレベル上限（最低1）。 */
export function maxDailyLevel(highestFloor: number): number {
  return Math.max(1, Math.floor(highestFloor / DAILY_FLOOR_PER_LEVEL));
}
/** レベルに対応する難度フロア（敵生成・★に使用。100の倍数＝ボス）。 */
export function dailyLevelFloor(level: number): number {
  return Math.max(DAILY_FLOOR_PER_LEVEL, level * DAILY_FLOOR_PER_LEVEL);
}

// ---- ボスラッシュ（5連戦・回復なし・コイン&EXP4倍）----
export const RUSH_BOSS_COUNT = 5;
export const RUSH_REWARD_MULT = 4;
/** i 体目(0-based)のボスの難度フロア。到達度に応じて 60%→100% へ逓増、50の倍数=大ボス。 */
export function rushBossFloor(highestFloor: number, step: number): number {
  const top = Math.max(50, Math.floor(highestFloor / 50) * 50);
  const ratio = 0.6 + 0.1 * Math.max(0, Math.min(RUSH_BOSS_COUNT - 1, step));
  const f = Math.round((top * ratio) / 50) * 50;
  return Math.max(50, f);
}

// ---- レアドロップ（覇者の刻印）----
export const RARE_SIGIL_RATE = 0.005; // 0.5%

// ---- ★アップの素材レシピ（既存 modTier に統合）----
// 🔹1 / 🔶1 固定 ＋ 💠刻印は 1 + floor(★/10)。★10未満は刻印1つ、★10ごとに+1。
export function starMaterialCost(modTier: number): DungeonMaterials {
  const t = Math.max(0, modTier);
  return { shard: 1, core: 1, sigil: 1 + Math.floor(t / 10) };
}
export function canAfford(have: DungeonMaterials, cost: DungeonMaterials): boolean {
  return have.shard >= cost.shard && have.core >= cost.core && have.sigil >= cost.sigil;
}
export function spend(have: DungeonMaterials, cost: DungeonMaterials): DungeonMaterials {
  return {
    shard: have.shard - cost.shard,
    core: have.core - cost.core,
    sigil: have.sigil - cost.sigil,
  };
}

// ---- 日替わりダンジョンの素材ドロップ量（レベルで微増）----
export function dailyDrop(level: number): { shard: number; core: number } {
  return { shard: 3 + Math.floor(level / 2), core: 1 + Math.floor(level / 5) };
}

// ---- 曜日テーマ（見た目の味付け。0=日曜〜6=土曜）----
export interface WeekdayTheme {
  name: string;
  emoji: string;
  blurb: string;
}
export const WEEKDAY_THEMES: readonly WeekdayTheme[] = [
  { name: "陽の聖域", emoji: "☀️", blurb: "日曜・光が満ちる安息の層" },
  { name: "月影の回廊", emoji: "🌙", blurb: "月曜・静寂と幻影の層" },
  { name: "焔の闘技場", emoji: "🔥", blurb: "火曜・熱気立ちこめる闘いの層" },
  { name: "水鏡の深淵", emoji: "💧", blurb: "水曜・揺らめく水面の層" },
  { name: "巨木の樹海", emoji: "🌳", blurb: "木曜・生命あふれる迷いの層" },
  { name: "黄金の宝物庫", emoji: "💰", blurb: "金曜・財宝きらめく層" },
  { name: "大地の鉱窟", emoji: "⛰️", blurb: "土曜・鉱石ねむる堅牢な層" },
];
/** その日の曜日テーマ（端末ローカル日）。 */
export function weekdayTheme(date: Date = new Date()): WeekdayTheme {
  return WEEKDAY_THEMES[date.getDay() % 7];
}

// FINAL_FLOOR を参照していることを明示（将来 1000階以下制限を入れる余地）。
void FINAL_FLOOR;
