// ===== 甘ダイス バトル映像（RUSH中の中央演出）用の純データ =====
// RUSH（連チャン）中、中央モニターを「勇者がボスを倒す」バトル映像に差し替える。
// ボスは連チャン数に応じて BOSS_TEMPLATES を巡回（演出のみ・出玉や継続には無関係）。

import { BOSS_TEMPLATES } from "@/data/enemies";

/** バトル映像に登場するボス（表示用の最小形）。 */
export interface BattleBoss {
  id: string;
  name: string;
  emoji: string;
}

/**
 * 連チャン数 ren（1始まり）からこのラウンドのボスを選ぶ。
 * BOSS_TEMPLATES を順番に巡回するので、連チャンが続くほど別のボスが出る。
 */
export function pickBattleBoss(ren: number): BattleBoss {
  const t = BOSS_TEMPLATES[(Math.max(1, ren) - 1) % BOSS_TEMPLATES.length];
  return { id: t.id, name: t.name, emoji: t.emoji };
}
