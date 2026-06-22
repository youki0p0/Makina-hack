// ===== 深淵モディファイア（Abyss Modifiers）=====
// Endless Abyss(1001階〜)を「数値が増えるだけの一本道」から「100階の帯ごとに支配ルールが
// 切り替わる、ビルド相性の迷路」に変えるローグライト層。帯ごとに敵へ決定論的な“理(ことわり)”を
// 付与する（floor から計算＝セーブ不要・後方互換）。多くは既存の相性フラグを立てるだけなので
// 戦闘ロジックは不変。特定ビルド一辺倒(吸血/多段/即死ハメ)を咎め、組み替えを促す。

import { FINAL_FLOOR } from "@/data/worlds";
import type { Enemy } from "@/types/game";

/** 敵に立てられる相性フラグ（Enemy 上の boolean フィールド）。 */
type TraitKey = "lifestealImmune" | "multiHitResist" | "statusResist" | "executeImmune";

export interface AbyssModifier {
  id: string;
  /** 帯の呼び名（例「多頭の層」）。 */
  label: string;
  /** プレイヤー向けの一行説明。 */
  desc: string;
  /** 立てる相性フラグ（任意）。 */
  trait?: TraitKey;
  /** 敵攻撃の倍率（任意・既存の線形カーブの上に乗る軽い味付け）。 */
  atkMult?: number;
  /** 敵HPの倍率（任意）。 */
  hpMult?: number;
}

/**
 * 帯ごとの理。順に巡回する（1001-1100=0, 1101-1200=1, …, 6種で一周）。
 * 相性フラグ系は数値を変えず特定ビルドだけを咎める＝「相性の読み合い」を生む。
 */
export const ABYSS_MODIFIERS: readonly AbyssModifier[] = [
  { id: "manyHeads", label: "多頭の層", desc: "多段攻撃が効きにくい（多段耐性）", trait: "multiHitResist" },
  { id: "silence", label: "静寂の層", desc: "毒・燃焼が効かない（状態異常耐性）", trait: "statusResist" },
  { id: "undying", label: "不死の層", desc: "吸血が効かない（吸血無効）", trait: "lifestealImmune" },
  { id: "immortal", label: "不滅の層", desc: "即死が効かない＝正面火力が要る（即死無効）", trait: "executeImmune" },
  { id: "might", label: "剛力の層", desc: "敵の攻撃が高まっている（×1.25）", atkMult: 1.25 },
  { id: "fortress", label: "鉄壁の層", desc: "敵のHPが分厚い（×1.4）", hpMult: 1.4 },
];

/** その階で支配している深淵の理（1000階以下は null＝本編は不変）。 */
export function abyssModifierFor(floor: number): AbyssModifier | null {
  if (floor <= FINAL_FLOOR) return null;
  const band = Math.floor((floor - 1 - FINAL_FLOOR) / 100);
  return ABYSS_MODIFIERS[band % ABYSS_MODIFIERS.length];
}

/** 帯の理を敵に適用する（trait フラグ＋任意の攻撃/HP倍率）。純粋。 */
export function applyAbyss(enemy: Enemy, floor: number): Enemy {
  const m = abyssModifierFor(floor);
  if (!m) return enemy;
  const next: Enemy = { ...enemy };
  if (m.trait) next[m.trait] = true;
  if (m.atkMult) next.attack = Math.round(next.attack * m.atkMult);
  if (m.hpMult) {
    next.maxHp = Math.round(next.maxHp * m.hpMult);
    next.hp = next.maxHp;
  }
  return next;
}
