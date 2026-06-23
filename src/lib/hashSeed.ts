// ===== 決定論ハッシュ（日付シード抽選の共通ユーティリティ）=====
// 文字列シードから 32bit 符号なし整数を返す FNV-1a。日付や日付＋面などの
// 文字列を「その日固定の乱数」に変換するのに使う（daily.ts / dailyDice.ts 共用）。
// 同じ入力なら常に同じ値＝決定論的（リロード耐性・リロール不可の土台）。

/** FNV-1a で文字列を 32bit 符号なし整数へ。 */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
