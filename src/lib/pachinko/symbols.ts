// ===== 図柄定義 =====
// リールの絵柄は「既存の固有武器 ＋ 神機マキナ」を流用する（手描き新規アイコンは作らない）。
// 各図柄は実在のアイテム id を持ち、UI 側で procedural なドット絵アイコンを描画する。

export type PayoutTier = "small" | "normal" | "big" | "jackpot";

export interface PachiSymbol {
  /** 1..7。3つ揃いで NNN 当たり。 */
  id: number;
  /** 図柄名（実在の固有武器名）。 */
  name: string;
  /** 当たり名称。 */
  bonus: string;
  /** 絵柄に使う実在アイテムの id（procedural アイコンを流用）。 */
  itemId: string;
  /** UI アクセント色。 */
  color: string;
  /** 当たり時の払い出し玉。 */
  payout: number;
  /** 払い出し演出の長さ(ms)。 */
  durationMs: number;
  /** 払い出し規模。 */
  tier: PayoutTier;
  /** この図柄で確変(Complete Mode)に入る/継続する。 */
  enterComplete: boolean;
}

/**
 * 7図柄。id 昇順＝下位→上位。777=神機マキナ=Jackpot。
 * itemId は src/data/items.ts に実在する固有武器（神機マキナ）。
 */
export const SYMBOLS: readonly PachiSymbol[] = [
  { id: 1, name: "吸血の剣", bonus: "吸血BONUS", itemId: "vampiric_sword", color: "#c084fc", payout: 9, durationMs: 1000, tier: "small", enterComplete: false },
  { id: 2, name: "毒牙の短剣", bonus: "毒牙BONUS", itemId: "venom_fang", color: "#84cc16", payout: 30, durationMs: 3000, tier: "normal", enterComplete: false },
  { id: 3, name: "雷神の鎚", bonus: "雷神BONUS", itemId: "thunder_hammer", color: "#facc15", payout: 40, durationMs: 3500, tier: "normal", enterComplete: false },
  { id: 4, name: "業火の剣", bonus: "業火BONUS", itemId: "flame_brand", color: "#fb923c", payout: 62, durationMs: 4000, tier: "big", enterComplete: true },
  { id: 5, name: "氷結の槍", bonus: "氷結BONUS", itemId: "glacial_spear", color: "#38bdf8", payout: 62, durationMs: 4000, tier: "big", enterComplete: true },
  { id: 6, name: "獄炎の薙刀", bonus: "獄炎BONUS", itemId: "inferno_glaive", color: "#ef4444", payout: 80, durationMs: 5000, tier: "big", enterComplete: true },
  { id: 7, name: "神機マキナ", bonus: "神機BONUS", itemId: "makina_god", color: "#ffcf33", payout: 200, durationMs: 8000, tier: "jackpot", enterComplete: true },
] as const;

const SYMBOL_BY_ID = new Map(SYMBOLS.map((s) => [s.id, s]));

export function getSymbol(id: number): PachiSymbol {
  return SYMBOL_BY_ID.get(id) ?? SYMBOLS[0];
}

/** 群予告の種類。神機マキナ群は激熱/当確。 */
export const GROUP_KINDS = ["weapon", "dice", "gear", "makina"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const GROUP_LABEL: Record<GroupKind, string> = {
  weapon: "武器群",
  dice: "ダイス群",
  gear: "歯車群",
  makina: "神機マキナ群",
};
