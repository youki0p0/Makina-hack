import type { TeamMods } from "@/types/arena";

/**
 * 祝福（ブレッシング）：ラウンドに勝つたびに3択から1つ選ぶ、ラン内で永続・累積する
 * 強化。ロングバトルの「後半インフレ」を生むローグライク的な成長軸。
 * 効果は戦闘前に TeamMods へ合算する（reroll など一部は別途 gameState で処理）。
 */
export interface Blessing {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  apply?: (m: TeamMods) => void;
  /** コスト予算を増やす（戦闘補正ではない）。 */
  budgetBonus?: number;
}

export const BLESSINGS: readonly Blessing[] = [
  { id: "atk", name: "力の祝福", emoji: "⚔️", desc: "攻撃力 +10%", apply: (m) => (m.atkMult *= 1.1) },
  { id: "def", name: "盾の祝福", emoji: "🛡️", desc: "防御 +12%", apply: (m) => (m.defMult *= 1.12) },
  { id: "hp", name: "命の祝福", emoji: "❤️", desc: "最大HP +12%", apply: (m) => (m.hpMult *= 1.12) },
  { id: "spd", name: "疾風の祝福", emoji: "💨", desc: "速度 +10%", apply: (m) => (m.spdMult *= 1.1) },
  { id: "cdr", name: "術理の祝福", emoji: "🔷", desc: "技クールダウン -10%", apply: (m) => (m.cdMult *= 0.9) },
  { id: "crit", name: "急所の祝福", emoji: "🎯", desc: "クリ率 +12%", apply: (m) => (m.critAdd += 12) },
  { id: "shield", name: "守勢の祝福", emoji: "🪨", desc: "戦闘開始時 全員にシールド+25", apply: (m) => (m.shieldStart += 25) },
  { id: "regen", name: "再生の祝福", emoji: "🍃", desc: "毎秒回復 +3", apply: (m) => (m.regenAdd += 3) },
  { id: "ember", name: "業火の祝福", emoji: "🔥", desc: "火傷ダメージ +4", apply: (m) => (m.burnBonus += 4) },
  { id: "heal", name: "慈愛の祝福", emoji: "💚", desc: "回復量 +20%", apply: (m) => (m.healMult *= 1.2) },
  { id: "budget", name: "豊穣の祝福", emoji: "🪙", desc: "毎ラウンドのコスト予算 +1", budgetBonus: 1 },
  // ---- ビルド変容系（数値盛りでなく戦い方が変わる） ----
  {
    id: "spread_poison",
    name: "瘴気の祝福",
    emoji: "🟣",
    desc: "毒が周囲の敵に拡散するようになる",
    apply: (m) => {
      m.poisonSpread = true;
    },
  },
  {
    id: "venom_flame",
    name: "毒炎の祝福",
    emoji: "☠️",
    desc: "毒状態の敵に火傷ダメージを追加",
    apply: (m) => {
      m.poisonBurn = true;
    },
  },
  {
    id: "phoenix",
    name: "不死鳥の祝福",
    emoji: "🐣",
    desc: "戦闘ごとに、倒れた味方が一度だけ蘇る",
    apply: (m) => {
      m.reviveOnce = true;
    },
  },
  {
    id: "inferno",
    name: "業火連鎖の祝福",
    emoji: "🔥",
    desc: "火傷ダメージ +6（火力ビルドの核）",
    apply: (m) => {
      m.burnBonus += 6;
    },
  },
];

export const BLESSING_MAP: Record<string, Blessing> = Object.fromEntries(
  BLESSINGS.map((b) => [b.id, b]),
);

/** 取得済み祝福を TeamMods に合算する。 */
export function applyBlessings(mods: TeamMods, ids: string[]): void {
  for (const id of ids) BLESSING_MAP[id]?.apply?.(mods);
}

/** 取得済み祝福による追加コスト予算の合計。 */
export function blessingBudgetBonus(ids: string[]): number {
  return ids.reduce((n, id) => n + (BLESSING_MAP[id]?.budgetBonus ?? 0), 0);
}

/** 3択の祝福を選ぶ（重複なし）。index ベースで決定論的に選べるよう seed を受ける。 */
export function offerBlessings(seed: number): string[] {
  const pool = [...BLESSINGS];
  const out: string[] = [];
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(rand() * pool.length);
    out.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return out;
}
