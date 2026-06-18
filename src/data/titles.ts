import { ENEMY_TEMPLATES } from "@/data/enemies";
import { ITEMS } from "@/data/items";
import { SETS } from "@/data/sets";
import type { Progress } from "@/types/game";

export type TitleTier = "easy" | "medium" | "hard" | "secret";

export interface Title {
  id: string;
  name: string;
  desc: string;
  /** Difficulty tier → soul reward (see TITLE_SOULS). Omitted only for the "(なし)" sentinel. */
  tier?: TitleTier;
  /** Hidden until unlocked (shown as ??? in the codex). */
  hidden?: boolean;
  /** Unlock condition (none = always available, e.g. the "(なし)" entry). */
  check?: (p: Progress) => boolean;
}

/** 転生ポイント(souls) granted the first time a title is unlocked, by tier. */
export const TITLE_SOULS: Record<TitleTier, number> = {
  easy: 0.5,
  medium: 0.75,
  hard: 1.0,
  secret: 1.0,
};

/** Souls a title awards (0 for the cosmetic-only sentinel). */
export function titleSouls(t: Title): number {
  return t.tier ? TITLE_SOULS[t.tier] : 0;
}

// Data-driven completion thresholds (stay correct if content grows).
const ITEM_TOTAL = ITEMS.length;
const ENEMY_TOTAL = ENEMY_TEMPLATES.length;
const SET_TOTAL = SETS.length;
// Completionist gate: number of awarding titles excluding the meta title itself.
// (Computed lazily inside its check to avoid an init-order dependency.)
let TITLE_GATE = 0;

export const TITLES: readonly Title[] = [
  { id: "", name: "（なし）", desc: "称号なし" },

  // ===== 探索 / Depth =====
  { id: "f_start", name: "駆け出しの探索者", desc: "5階に到達", tier: "easy", check: (p) => p.maxFloor >= 5 },
  { id: "f_abyss", name: "深淵歩き", desc: "20階に到達", tier: "easy", check: (p) => p.maxFloor >= 20 },
  { id: "f_grass", name: "草原の覇者", desc: "草原(100階)を突破", tier: "easy", check: (p) => p.maxFloor >= 100 },
  { id: "f_cave", name: "洞窟の主", desc: "深き洞窟(200階)を突破", tier: "easy", check: (p) => p.maxFloor >= 200 },
  { id: "f_ruins", name: "遺跡踏破者", desc: "古代遺跡(300階)を突破", tier: "medium", check: (p) => p.maxFloor >= 300 },
  { id: "f_ice", name: "氷を越えし者", desc: "氷結世界(400階)を突破", tier: "medium", check: (p) => p.maxFloor >= 400 },
  { id: "f_volcano", name: "火山を制す者", desc: "灼熱火山(500階)を突破", tier: "medium", check: (p) => p.maxFloor >= 500 },
  { id: "f_naraku", name: "奈落の渡り人", desc: "奈落(600階)を突破", tier: "medium", check: (p) => p.maxFloor >= 600 },
  { id: "f_heaven", name: "天界の客人", desc: "天界(700階)を突破", tier: "hard", check: (p) => p.maxFloor >= 700 },
  { id: "f_star", name: "星界の旅人", desc: "星界(800階)を突破", tier: "hard", check: (p) => p.maxFloor >= 800 },
  { id: "f_void", name: "虚無を覗く者", desc: "虚無(900階)を突破", tier: "hard", check: (p) => p.maxFloor >= 900 },
  { id: "f_machine", name: "機械神界へ至る", desc: "機械神界(1000階)に到達", tier: "hard", check: (p) => p.maxFloor >= 1000 },
  { id: "f_endless", name: "終わりなき深淵", desc: "Endless Abyssに突入", tier: "hard", check: (p) => p.maxFloor >= 1001 },
  { id: "f_e1100", name: "深淵の常連", desc: "1100階に到達", tier: "hard", check: (p) => p.maxFloor >= 1100 },
  { id: "f_e1250", name: "奈落の支配者", desc: "1250階に到達", tier: "hard", check: (p) => p.maxFloor >= 1250 },
  { id: "f_e1500", name: "無限への挑戦者", desc: "1500階に到達", tier: "secret", hidden: true, check: (p) => p.maxFloor >= 1500 },

  // ===== 撃破 / Kills =====
  { id: "k10", name: "見習い剣士", desc: "敵を10体撃破", tier: "easy", check: (p) => p.kills >= 10 },
  { id: "k50", name: "歴戦の勇者", desc: "敵を50体撃破", tier: "easy", check: (p) => p.kills >= 50 },
  { id: "k100", name: "殲滅者", desc: "敵を100体撃破", tier: "easy", check: (p) => p.kills >= 100 },
  { id: "k500", name: "戦場の死神", desc: "敵を500体撃破", tier: "medium", check: (p) => p.kills >= 500 },
  { id: "k1000", name: "千殺し", desc: "敵を1000体撃破", tier: "hard", check: (p) => p.kills >= 1000 },
  { id: "k5000", name: "絶対殲滅", desc: "敵を5000体撃破", tier: "secret", hidden: true, check: (p) => p.kills >= 5000 },
  { id: "bk1", name: "ボスキラー", desc: "ボスを1体撃破", tier: "easy", check: (p) => p.bossKills >= 1 },
  { id: "bk5", name: "竜殺し", desc: "ボスを5体撃破", tier: "easy", check: (p) => p.bossKills >= 5 },
  { id: "bk25", name: "ボス狩人", desc: "ボスを25体撃破", tier: "medium", check: (p) => p.bossKills >= 25 },
  { id: "bk100", name: "討伐の覇者", desc: "ボスを100体撃破", tier: "hard", check: (p) => p.bossKills >= 100 },
  { id: "hit500", name: "一撃必殺", desc: "単発500ダメージを与える", tier: "medium", check: (p) => p.maxSingleHit >= 500 },
  { id: "hit9999", name: "天破の一撃", desc: "単発9999ダメージを与える", tier: "secret", hidden: true, check: (p) => p.maxSingleHit >= 9999 },

  // ===== 連勝 / Streak =====
  { id: "s5", name: "連勝街道", desc: "5連勝", tier: "easy", check: (p) => p.maxStreak >= 5 },
  { id: "s10", name: "無敗の覇者", desc: "10連勝", tier: "easy", check: (p) => p.maxStreak >= 10 },
  { id: "s25", name: "不敗神話", desc: "25連勝", tier: "medium", check: (p) => p.maxStreak >= 25 },
  { id: "s50", name: "連勝の化身", desc: "50連勝", tier: "hard", check: (p) => p.maxStreak >= 50 },
  { id: "s100", name: "百戦不敗", desc: "100連勝", tier: "secret", hidden: true, check: (p) => p.maxStreak >= 100 },

  // ===== 無傷 / 完璧 (hidden) =====
  { id: "nd_boss1", name: "無傷の討伐者", desc: "無傷でボスを撃破", tier: "hard", hidden: true, check: (p) => p.noDamageBossKills >= 1 },
  { id: "nd_boss10", name: "完全制圧", desc: "無傷でボスを10体撃破", tier: "secret", hidden: true, check: (p) => p.noDamageBossKills >= 10 },
  { id: "perfect1", name: "完璧主義", desc: "無傷で階層をクリア", tier: "medium", hidden: true, check: (p) => p.perfectClears >= 1 },
  { id: "perfect50", name: "無傷の道", desc: "無傷クリア50回", tier: "hard", hidden: true, check: (p) => p.perfectClears >= 50 },
  { id: "perfect200", name: "傷一つ負わず", desc: "無傷クリア200回", tier: "secret", hidden: true, check: (p) => p.perfectClears >= 200 },

  // ===== カジノ: スロット / 出玉 =====
  { id: "c_jp1", name: "大当たり", desc: "ジャックポット1回", tier: "easy", check: (p) => p.jackpots >= 1 },
  { id: "c_jp10", name: "引きの強者", desc: "ジャックポット10回", tier: "medium", check: (p) => p.jackpots >= 10 },
  { id: "c_jp50", name: "カジノの支配者", desc: "ジャックポット50回", tier: "hard", check: (p) => p.jackpots >= 50 },
  { id: "c_big1", name: "BIG降臨", desc: "スロットでBIG(ダイスラッシュ)1回", tier: "easy", check: (p) => p.slotBigCount >= 1 },
  { id: "c_big25", name: "BIGハンター", desc: "BIG25回", tier: "medium", check: (p) => p.slotBigCount >= 25 },
  { id: "c_big100", name: "鬼連チャン", desc: "BIG100回(設定6掴み)", tier: "hard", hidden: true, check: (p) => p.slotBigCount >= 100 },
  { id: "c_big300", name: "万枚の伝説", desc: "BIG300回", tier: "secret", hidden: true, check: (p) => p.slotBigCount >= 300 },
  { id: "c_coin1k", name: "コイン稼ぎ", desc: "累計1000コイン獲得", tier: "easy", check: (p) => p.totalCoinsWon >= 1000 },
  { id: "c_coin10k", name: "コイン長者", desc: "累計10000コイン獲得", tier: "medium", check: (p) => p.totalCoinsWon >= 10000 },
  { id: "c_coin100k", name: "出玉の暴力", desc: "累計100000コイン獲得", tier: "hard", check: (p) => p.totalCoinsWon >= 100000 },
  { id: "c_coin1m", name: "ミリオンの男", desc: "累計1000000コイン獲得", tier: "secret", hidden: true, check: (p) => p.totalCoinsWon >= 1000000 },
  { id: "c_fate1", name: "運命を掴む者", desc: "運命の大博打で大当たり", tier: "medium", hidden: true, check: (p) => p.fateWins >= 1 },
  { id: "c_fate5", name: "大博打の覇者", desc: "運命の大博打で5回大当たり", tier: "secret", hidden: true, check: (p) => p.fateWins >= 5 },
  { id: "c_jpbig", name: "二刀流博徒", desc: "ジャックポットとBIGの両方を達成", tier: "medium", check: (p) => p.jackpots >= 1 && p.slotBigCount >= 1 },

  // ===== カジノ: 台パン / 出禁 (hidden) =====
  { id: "c_daipan1", name: "台パン", desc: "台を殴って出禁になる", tier: "secret", hidden: true, check: (p) => p.casinoBanned },
  { id: "c_daipan10", name: "暴れん坊", desc: "台パン10回", tier: "secret", hidden: true, check: (p) => p.daipanCount >= 10 },
  { id: "c_daipan50", name: "札付きの客", desc: "台パン50回", tier: "secret", hidden: true, check: (p) => p.daipanCount >= 50 },

  // ===== 鍛冶 / Forge =====
  { id: "fg1", name: "鍛冶見習い", desc: "初めて鍛冶に成功", tier: "easy", check: (p) => p.forgeCount >= 1 },
  { id: "fg10", name: "熟練の鍛冶師", desc: "鍛冶10回成功", tier: "medium", check: (p) => p.forgeCount >= 10 },
  { id: "fg50", name: "伝説の名工", desc: "鍛冶50回成功", tier: "hard", check: (p) => p.forgeCount >= 50 },
  { id: "fg_p5", name: "業物", desc: "強化値+5に到達", tier: "medium", check: (p) => p.maxForgeLevel >= 5 },
  { id: "fg_p10", name: "極限強化", desc: "強化値+10に到達", tier: "hard", check: (p) => p.maxForgeLevel >= 10 },
  { id: "fg_max", name: "究極の一振り", desc: "強化値+15(最大)に到達", tier: "secret", hidden: true, check: (p) => p.maxForgeLevel >= 15 },

  // ===== 職業 / Classes =====
  { id: "cl_change", name: "転職者", desc: "初めて転職する", tier: "easy", check: (p) => p.classesUsed.length >= 2 },
  { id: "cl_warrior", name: "戦士の道", desc: "戦士に就く", tier: "easy", check: (p) => p.classesUsed.includes("warrior") },
  { id: "cl_mage", name: "魔道の探求", desc: "魔法使いに就く", tier: "easy", check: (p) => p.classesUsed.includes("mage") },
  { id: "cl_swordsaint", name: "剣聖", desc: "剣聖に就く", tier: "medium", check: (p) => p.classesUsed.includes("swordsaint") },
  { id: "cl_archmage", name: "大魔導士", desc: "大魔導士に就く", tier: "medium", check: (p) => p.classesUsed.includes("archmage") },
  { id: "cl_celestial", name: "白の極致", desc: "セレスティアルに就く", tier: "hard", hidden: true, check: (p) => p.classesUsed.includes("celestial") },
  { id: "cl_abyssal", name: "黒の深淵", desc: "アビサルに就く", tier: "hard", hidden: true, check: (p) => p.classesUsed.includes("abyssal") },
  { id: "cl_all", name: "全職業制覇", desc: "全12職を経験", tier: "secret", hidden: true, check: (p) => p.classesUsed.length >= 12 },

  // ===== セット装備 / Sets =====
  { id: "set1", name: "セット使い", desc: "セット装備を1種完成", tier: "medium", check: (p) => p.setsCompleted.length >= 1 },
  { id: "set_gambler", name: "博徒の装い", desc: "ギャンブラーセット完成", tier: "medium", check: (p) => p.setsCompleted.includes("gambler") },
  { id: "set_vampire", name: "吸血の宴", desc: "ヴァンパイアセット完成", tier: "medium", check: (p) => p.setsCompleted.includes("vampire") },
  { id: "set_executioner", name: "処刑人の儀", desc: "エクセキューショナーセット完成", tier: "hard", check: (p) => p.setsCompleted.includes("executioner") },
  { id: "set5", name: "コーディネーター", desc: "セット装備を5種完成", tier: "hard", check: (p) => p.setsCompleted.length >= 5 },
  { id: "set_all", name: "セットマスター", desc: "全セット装備を完成", tier: "secret", hidden: true, check: (p) => p.setsCompleted.length >= SET_TOTAL },

  // ===== 図鑑 / Collection =====
  { id: "col12", name: "蒐集家", desc: "装備を12種発見", tier: "easy", check: (p) => p.discoveredItems.length >= 12 },
  { id: "col24", name: "装備通", desc: "装備を24種発見", tier: "medium", check: (p) => p.discoveredItems.length >= 24 },
  { id: "col_full", name: "装備図鑑コンプ", desc: "全装備を発見", tier: "secret", hidden: true, check: (p) => p.discoveredItems.length >= ITEM_TOTAL },
  { id: "bes15", name: "観察者", desc: "敵を15種討伐", tier: "easy", check: (p) => p.defeatedEnemies.length >= 15 },
  { id: "bes30", name: "魔物学者", desc: "敵を30種討伐", tier: "medium", check: (p) => p.defeatedEnemies.length >= 30 },
  { id: "bes_full", name: "敵図鑑コンプ", desc: "全ての通常敵を討伐", tier: "secret", hidden: true, check: (p) => p.defeatedEnemies.length >= ENEMY_TOTAL },

  // ===== 転生 / NG+ / メタ =====
  { id: "rb1", name: "輪廻の者", desc: "初めて転生する", tier: "easy", check: (p) => p.rebirths >= 1 },
  { id: "rb3", name: "周回者", desc: "3回転生する", tier: "easy", check: (p) => p.rebirths >= 3 },
  { id: "rb10", name: "永劫回帰", desc: "10回転生する", tier: "hard", check: (p) => p.rebirths >= 10 },
  { id: "ng1", name: "強くてニューゲーム", desc: "NG+を1周", tier: "medium", check: (p) => p.ngPlus >= 1 },
  { id: "ng3", name: "三周目の猛者", desc: "NG+を3周", tier: "hard", check: (p) => p.ngPlus >= 3 },
  { id: "ng7", name: "無限周回者", desc: "NG+を7周", tier: "secret", hidden: true, check: (p) => p.ngPlus >= 7 },
  { id: "ms5", name: "魂を集めし者", desc: "魂のマイルストーンを5回達成", tier: "medium", check: (p) => p.claimedMilestones.length >= 5 },
  { id: "em5", name: "深淵の記録者", desc: "Endlessの物語を5つ見る", tier: "hard", hidden: true, check: (p) => p.claimedEndlessMessages.length >= 5 },

  // ===== エコー / ランキング =====
  { id: "echo1", name: "残響との戦い", desc: "エコーバトルに勝利", tier: "medium", check: (p) => p.echoWins >= 1 },
  { id: "echo25", name: "残響の強者", desc: "エコーバトル25勝", tier: "hard", check: (p) => p.echoWins >= 25 },
  { id: "rank1k", name: "ランカー", desc: "ランクポイント1000", tier: "medium", check: (p) => p.rankPoints >= 1000 },
  { id: "rank10k", name: "頂点の挑戦者", desc: "ランクポイント10000", tier: "hard", check: (p) => p.rankPoints >= 10000 },

  // ===== ストーリー / 最終 (secret) =====
  { id: "deus", name: "機神を討つ者", desc: "デウス＝エクス＝マキナを撃破", tier: "hard", hidden: true, check: (p) => p.endingSeen },
  { id: "makina_0001", name: "Makina-0001", desc: "1000階の終端を見届けた者", tier: "secret", hidden: true, check: (p) => p.endingSeen },
  { id: "shinki", name: "神機の担い手", desc: "神機マキナを授かる", tier: "secret", hidden: true, check: (p) => p.makinaGranted },

  // ===== やりこみ / プレイ時間 =====
  { id: "t1h", name: "旅の始まり", desc: "累計1時間プレイ", tier: "easy", check: (p) => p.playSeconds >= 3600 },
  { id: "t10h", name: "やり込み勢", desc: "累計10時間プレイ", tier: "medium", check: (p) => p.playSeconds >= 36000 },
  { id: "t50h", name: "マキナ廃人", desc: "累計50時間プレイ", tier: "hard", hidden: true, check: (p) => p.playSeconds >= 180000 },
  // ===== 追加(やりこみ補完) =====
  { id: "col6", name: "拾い屋", desc: "装備を6種発見", tier: "easy", check: (p) => p.discoveredItems.length >= 6 },
  { id: "k250", name: "百人長", desc: "敵を250体撃破", tier: "medium", check: (p) => p.kills >= 250 },
  { id: "bk50", name: "ボス殲滅者", desc: "ボスを50体撃破", tier: "hard", check: (p) => p.bossKills >= 50 },
  { id: "c_jp25", name: "ジャックポット中毒", desc: "ジャックポット25回", tier: "hard", check: (p) => p.jackpots >= 25 },
  { id: "bes45", name: "魔物博士", desc: "敵を45種討伐", tier: "hard", check: (p) => p.defeatedEnemies.length >= 45 },
  { id: "rb20", name: "輪廻の果て", desc: "20回転生する", tier: "hard", check: (p) => p.rebirths >= 20 },
  { id: "fg25", name: "鍛冶の達人", desc: "鍛冶25回成功", tier: "medium", check: (p) => p.forgeCount >= 25 },
  { id: "t100h", name: "時を忘れし者", desc: "累計100時間プレイ", tier: "secret", hidden: true, check: (p) => p.playSeconds >= 360000 },

  // ===== 追加2 (やりこみ拡張・50称号) =====
  // 探索の刻み
  { id: "f_10", name: "石畳の探索者", desc: "10階に到達", tier: "easy", check: (p) => p.maxFloor >= 10 },
  { id: "f_150", name: "洞窟前線", desc: "150階に到達", tier: "easy", check: (p) => p.maxFloor >= 150 },
  { id: "f_250", name: "遺跡の先駆け", desc: "250階に到達", tier: "medium", check: (p) => p.maxFloor >= 250 },
  { id: "f_350", name: "凍てつく道標", desc: "350階に到達", tier: "medium", check: (p) => p.maxFloor >= 350 },
  { id: "f_450", name: "溶岩を踏む者", desc: "450階に到達", tier: "medium", check: (p) => p.maxFloor >= 450 },
  { id: "f_550", name: "奈落の入口", desc: "550階に到達", tier: "medium", check: (p) => p.maxFloor >= 550 },
  { id: "f_650", name: "深層の旅人", desc: "650階に到達", tier: "medium", check: (p) => p.maxFloor >= 650 },
  { id: "f_750", name: "天界の門前", desc: "750階に到達", tier: "hard", check: (p) => p.maxFloor >= 750 },
  { id: "f_850", name: "星屑の渡り", desc: "850階に到達", tier: "hard", check: (p) => p.maxFloor >= 850 },
  { id: "f_950", name: "虚無の縁", desc: "950階に到達", tier: "hard", check: (p) => p.maxFloor >= 950 },

  // 撃破 / 一撃
  { id: "bk10", name: "ボス常連", desc: "ボスを10体撃破", tier: "easy", check: (p) => p.bossKills >= 10 },
  { id: "bk75", name: "討伐の鬼", desc: "ボスを75体撃破", tier: "hard", check: (p) => p.bossKills >= 75 },
  { id: "k2000", name: "二千殺し", desc: "敵を2000体撃破", tier: "hard", check: (p) => p.kills >= 2000 },
  { id: "k3000", name: "皆殺しの権化", desc: "敵を3000体撃破", tier: "secret", hidden: true, check: (p) => p.kills >= 3000 },
  { id: "hit1000", name: "千点突破", desc: "単発1000ダメージを与える", tier: "medium", check: (p) => p.maxSingleHit >= 1000 },
  { id: "hit3000", name: "三千の衝撃", desc: "単発3000ダメージを与える", tier: "hard", check: (p) => p.maxSingleHit >= 3000 },
  { id: "hit5000", name: "五千の終撃", desc: "単発5000ダメージを与える", tier: "secret", hidden: true, check: (p) => p.maxSingleHit >= 5000 },
  { id: "s75", name: "連勝の鬼神", desc: "75連勝", tier: "hard", check: (p) => p.maxStreak >= 75 },

  // 無傷
  { id: "perfect5", name: "無傷の常勝", desc: "無傷クリア5回", tier: "medium", hidden: true, check: (p) => p.perfectClears >= 5 },
  { id: "perfect20", name: "鉄壁の証", desc: "無傷クリア20回", tier: "hard", hidden: true, check: (p) => p.perfectClears >= 20 },
  { id: "nd_boss3", name: "無傷の狩人", desc: "無傷でボスを3体撃破", tier: "secret", hidden: true, check: (p) => p.noDamageBossKills >= 3 },

  // カジノ
  { id: "c_jp5", name: "小当たり名人", desc: "ジャックポット5回", tier: "easy", check: (p) => p.jackpots >= 5 },
  { id: "c_jp100", name: "カジノの伝説", desc: "ジャックポット100回", tier: "secret", hidden: true, check: (p) => p.jackpots >= 100 },
  { id: "c_big10", name: "BIG常連", desc: "BIG10回", tier: "easy", check: (p) => p.slotBigCount >= 10 },
  { id: "c_big50", name: "BIGの覇者", desc: "BIG50回", tier: "hard", check: (p) => p.slotBigCount >= 50 },
  { id: "c_big200", name: "万枚への道", desc: "BIG200回", tier: "secret", hidden: true, check: (p) => p.slotBigCount >= 200 },
  { id: "c_coin50k", name: "出玉中級者", desc: "累計50000コイン獲得", tier: "medium", check: (p) => p.totalCoinsWon >= 50000 },
  { id: "c_coin500k", name: "出玉の魔王", desc: "累計500000コイン獲得", tier: "hard", check: (p) => p.totalCoinsWon >= 500000 },
  { id: "c_fate10", name: "運命の寵児", desc: "運命の大博打で10回大当たり", tier: "secret", hidden: true, check: (p) => p.fateWins >= 10 },
  { id: "c_daipan25", name: "問題児", desc: "台パン25回", tier: "secret", hidden: true, check: (p) => p.daipanCount >= 25 },
  { id: "c_allcasino", name: "カジノ全部入り", desc: "JP・BIG・大博打を全て達成", tier: "medium", check: (p) => p.jackpots >= 1 && p.slotBigCount >= 1 && p.fateWins >= 1 },

  // 鍛冶
  { id: "fg5", name: "鍛冶の心得", desc: "鍛冶5回成功", tier: "easy", check: (p) => p.forgeCount >= 5 },
  { id: "fg100", name: "鍛冶の神", desc: "鍛冶100回成功", tier: "hard", check: (p) => p.forgeCount >= 100 },
  { id: "fg_p8", name: "業物の主", desc: "強化値+8に到達", tier: "medium", check: (p) => p.maxForgeLevel >= 8 },
  { id: "fg_p12", name: "極致の刃", desc: "強化値+12に到達", tier: "hard", check: (p) => p.maxForgeLevel >= 12 },

  // 職業
  { id: "cl_3", name: "三足の草鞋", desc: "3職を経験", tier: "easy", check: (p) => p.classesUsed.length >= 3 },
  { id: "cl_6", name: "六道の探求者", desc: "6職を経験", tier: "medium", check: (p) => p.classesUsed.length >= 6 },
  { id: "cl_9", name: "九職の達人", desc: "9職を経験", tier: "hard", check: (p) => p.classesUsed.length >= 9 },

  // セット
  { id: "set2", name: "重ね着の美学", desc: "セット装備を2種完成", tier: "medium", check: (p) => p.setsCompleted.length >= 2 },
  { id: "set3", name: "三位一体", desc: "セット装備を3種完成", tier: "medium", check: (p) => p.setsCompleted.length >= 3 },
  { id: "set10", name: "セット蒐集家", desc: "セット装備を10種完成", tier: "hard", check: (p) => p.setsCompleted.length >= 10 },

  // 図鑑
  { id: "col36", name: "装備目録", desc: "装備を36種発見", tier: "medium", check: (p) => p.discoveredItems.length >= 36 },
  { id: "col48", name: "装備博士", desc: "装備を48種発見", tier: "hard", check: (p) => p.discoveredItems.length >= 48 },
  { id: "bes20", name: "魔物観察員", desc: "敵を20種討伐", tier: "easy", check: (p) => p.defeatedEnemies.length >= 20 },
  { id: "bes40", name: "魔物大全", desc: "敵を40種討伐", tier: "hard", check: (p) => p.defeatedEnemies.length >= 40 },

  // メタ / オンライン / 時間
  { id: "rb5", name: "五度の輪廻", desc: "5回転生する", tier: "medium", check: (p) => p.rebirths >= 5 },
  { id: "ng5", name: "五周目の境地", desc: "NG+を5周", tier: "hard", check: (p) => p.ngPlus >= 5 },
  { id: "echo50", name: "残響の覇者", desc: "エコーバトル50勝", tier: "hard", check: (p) => p.echoWins >= 50 },
  { id: "echo100", name: "残響を統べる者", desc: "エコーバトル100勝", tier: "secret", hidden: true, check: (p) => p.echoWins >= 100 },
  { id: "t25h", name: "やり込みの鬼", desc: "累計25時間プレイ", tier: "hard", check: (p) => p.playSeconds >= 90000 },

  { id: "completionist", name: "真の称号", desc: "他の称号を全て獲得", tier: "secret", hidden: true, check: (p) => p.claimedTitles.length >= TITLE_GATE },
];

// Awarding titles excluding the meta "completionist" itself.
TITLE_GATE = TITLES.filter((t) => t.tier && t.id !== "completionist").length;

const TITLE_MAP: Map<string, Title> = new Map(TITLES.map((t) => [t.id, t]));

export function getTitle(id: string): Title {
  return TITLE_MAP.get(id) ?? TITLES[0];
}

export function isTitleUnlocked(id: string, progress: Progress): boolean {
  const t = TITLE_MAP.get(id);
  if (!t || !t.check) return true;
  return t.check(progress);
}

export function normalizeTitleId(id: string | undefined, progress: Progress): string {
  if (!id) return "";
  return isTitleUnlocked(id, progress) ? id : "";
}
