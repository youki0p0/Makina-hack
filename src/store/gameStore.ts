"use client";

import { create } from "zustand";
import { defaultProgress, newlyEarnedAchievements } from "@/data/achievements";
import { difficultyScale, getDifficulty, normalizeDifficulty, type Difficulty } from "@/data/difficulty";
import { getDailyBonus } from "@/lib/daily";
import { spinDailyDice, type DiceFaceId } from "@/lib/dailyDice";
import { SUMMER_MILESTONES } from "@/lib/fireworks";
import {
  artifactBonus,
  artifactUpgradeCost,
  computeRebirthGain,
  defaultArtifactLevels,
} from "@/data/artifacts";
import {
  canEquip,
  DEFAULT_CLASS_ID,
  getClass,
  isClassUnlocked,
} from "@/data/classes";
import { generateEnemy } from "@/data/enemies";
import {
  canAfford as canAffordMats,
  DAILY_BASE_USES,
  dailyDrop,
  dailyLevelFloor,
  emptyMaterials,
  maxDailyLevel,
  maxDailyUses,
  maxRushUses,
  RARE_SIGIL_RATE,
  RUSH_BASE_USES,
  RUSH_BOSS_COUNT,
  rushRewardMult,
  rushBossFloor,
  spend as spendMats,
  starMaterialCost,
} from "@/data/dungeon";
import {
  estimateTier,
  genItem,
  genSetItem,
  getItemById,
  getItemInstance,
  makeMakina,
  MAKINA_ID,
  rollGenDrop,
  SIGNATURE_WEAPON_IDS,
  SLOT_LIST,
} from "@/data/items";
import { forgeCost, forgeMax, rollForge, starInjectCost, type ForgeKind } from "@/data/forge";
import { applyModifier, modTierForFloor, rollDropModTier } from "@/data/modifiers";
import { applyMaxAffix } from "@/data/affixes";
import { computeSetEffects, getSetDef } from "@/data/sets";
import { getTitle, titleSouls } from "@/data/titles";
import { grantTitles } from "@/lib/titleAward";
import {
  crossedMilestones,
  milestoneSouls,
  newlyEarnedFloorAchievements,
} from "@/data/milestones";
import { isWorldBossFloor, FINAL_FLOOR } from "@/data/worlds";
import { ENDLESS_MESSAGES, MAKINA_FLOOR, ENDING_TITLE_ID } from "@/data/lore";
import type { RankingEntry } from "@/lib/ranking";
import {
  addStatus,
  applyExp,
  computeStats,
  EQUIP_SLOTS,
  luckFloor,
  resolveBossTurn,
  resolveFinalBossTurn,
  resolveEnemyTurn,
  resolvePlayerAction,
  tickBuffs,
  tickEnemyStatuses,
  WEAKEN_TURNS,
  PLAYER_POISON_TURNS,
} from "@/lib/battle";
import { rollDice } from "@/lib/dice";
import {
  GACHA_COST,
  PREMIUM_COST,
  TARGETED_COST,
  pullGachaItem,
  pullPremiumItem,
  pullTargetedItem,
  rollConsumable,
  rollLoot,
  SCRAP_VALUE,
} from "@/lib/loot";
import {
  SLOT_BET,
  GASE_REACH_CHANCE,
  drawSlotOutcome,
  slotPayout,
  slotReels,
  pickReach,
  atSpinPayout,
  atRensho,
  AT_GAMES,
  ZONE_SPINS,
  ZONE_MULT,
  DAIPAN_LIMIT,
  BAN_BOSSES,
  HIT_WINDOW_MS,
  MACHINE_COUNT,
  SET_WEAPON_COIN,
  SIGNATURE_WEAPON_COIN,
  SOULS_COIN,
  settingBucket,
  effectiveSlotSettings,
  settingMult,
  ceilingSpins,
  coinBuyCost,
  randomCasinoPrize,
  type ReachDef,
  type SlotOutcome,
} from "@/lib/casino";
import { generateShopStock, isShopFloor, type ShopEntry } from "@/lib/shop";
import { clearSave, exportSave, importSave, loadGame, saveGame, type LoadedState } from "@/lib/save";
import { runDailyMaintenance, todayKey, weekKey } from "@/lib/maintenance";
import {
  DAILY_QUESTS,
  emptySnapshot,
  LOGIN_CALENDAR,
  LOGIN_CYCLE,
  questCounters,
  questDone,
  WEEKLY_QUESTS,
} from "@/data/quests";
import { kingSpinWithPity, KING_BET, LEGEND_PIECE_HI, type KingResult } from "@/lib/casinoKing";
import { itemKey, rarityRank } from "@/lib/ui";
import type {
  ActiveBuff,
  ActiveStatus,
  ArtifactId,
  ArtifactLevels,
  ClassId,
  StatBonus,
  BattleLogEntry,
  BattleResult,
  BattleState,
  ComputedStats,
  Consumable,
  DiceFace,
  DiceValue,
  DungeonMaterials,
  Enemy,
  QuestSnapshot,
  Reward,
  Equipment,
  EquippedItems,
  EquipmentSlot,
  Player,
  Progress,
  Rarity,
} from "@/types/game";
import { faceByValue } from "@/data/diceFaces";
import {
  addUnique,
  buildFaces,
  canChangeClassNow,
  capInventory,
  computePlayerStats,
  createPlayer,
  discover,
  emptyEquipped,
  endlessAscension,
  equippedResist,
  isCleared1000,
  isSavePointFloor,
  MAX_INVENTORY,
  passiveBonus as computePassiveBonus,
  soulAltarCost,
  soulAltarMult,
  weakestSlot,
} from "./helpers";

const LOG_LIMIT = 14;

/** Result of one slot spin (the RNG is resolved up-front; the UI animates it). */
export interface SlotSpinResult {
  outcome: SlotOutcome;
  reels: [number, number, number];
  /** Reach production to play (~3s) before the reveal, or null for a quick spin. */
  reach: ReachDef | null;
  /** Coins won this spin. */
  payout: number;
  /** This spin was free (consumed a pending replay). */
  free: boolean;
  /** The next spin is free (this spin hit リプレイ). */
  replayNext: boolean;
  /** Big-bonus item prize, if any. */
  prize: Equipment | null;
  /** ダイスラッシュ(AT) games remaining after this spin (0 = not in AT). */
  atRemaining: number;
  /** This spin started the AT (BIG成立). */
  atStart: boolean;
  /** 上乗せ games added by this AT spin (0 = none). */
  atAdd: number;
  /** Coin balance after the spin. */
  coins: number;
}

interface GameState {
  hydrated: boolean;
  player: Player;
  equipped: EquippedItems;
  inventory: Equipment[];
  currentEnemy: Enemy | null;
  currentFloor: number;
  battleState: BattleState;
  diceValue: DiceValue;
  /** 「2個振り(高い方を採用)」が発動した直近ロールの両出目。非発動時は null（UIの目印用・非保存）。 */
  twoDice: [DiceValue, DiceValue] | null;
  diceFaces: DiceFace[];
  rerollsLeft: number;
  battleLog: BattleLogEntry[];
  /** Pending achievement-unlock toasts (FIFO of achievement ids). Not persisted. */
  achievementQueue: string[];
  lastResult: BattleResult | null;
  /** Temporary consumable buffs in effect, counting down per battle. */
  activeBuffs: ActiveBuff[];
  /** Status-over-time afflicting the player (poison/burn), battle-scoped. */
  playerStatuses: ActiveStatus[];
  /** Turns the player is stunned (loses rerolls), battle-scoped. */
  playerStunTurns: number;
  /** Gacha currency from scrapping equipment. */
  gachaPoints: number;
  /** The most recent gacha pull, for the result popup (not persisted). */
  lastPull: Equipment | null;
  /** The most recent forge result, for the popup (not persisted). */
  lastForge: { kind: ForgeKind; from: number; to: number } | null;
  /** Rebirth currency. */
  souls: number;
  /** 魂の祭壇レベル（ゴールド/EXP取得アップ）。 */
  soulAltar: number;
  // ===== 日替わりダンジョン / ボスラッシュ =====
  /** 素材スタック（★アップ用）。 */
  materials: DungeonMaterials;
  /** 日替わりダンジョン残り回数。 */
  dailyUses: number;
  /** ボスラッシュ残り回数。 */
  rushUses: number;
  /** 回数リセット基準日キー。 */
  modeResetKey: string;
  /** クリア済み日替わりLv。 */
  dailyCleared: number[];
  seenDailyStory: boolean;
  seenDailyHelp: boolean;
  // ===== ログイン / クエスト =====
  loginDay: number;
  loginClaimKey: string;
  dailyQuestKey: string;
  dailyQuestBase: QuestSnapshot;
  dailyClaimed: string[];
  weeklyQuestKey: string;
  weeklyQuestBase: QuestSnapshot;
  weeklyClaimed: string[];
  // ===== 今日のダイス（1日1回の運試し）=====
  /** 最後にダイスを振った日付キー（""=未プレイ）。 */
  dailyDiceKey: string;
  /** 最後に選んだ面（""=未プレイ）。 */
  dailyDiceFace: string;
  /** 最後の出目(1..6, 0=未プレイ)。結果カードの再表示に使う。 */
  dailyDiceValue: number;
  // ===== 🎆 夏の花火大会（7月限定スコアアタック・本編から切り離し）=====
  /** 受領済みの夏マイルストーンid（自己ベストは progress.summerBest）。 */
  summerClaimed: string[];
  // --- 以下は非永続（リロードで破棄＝モード中断）---
  /** 現在のモード。 */
  runMode: "normal" | "daily" | "rush";
  /** モード戦の難度フロア。 */
  modeFloor: number;
  /** 日替わりの挑戦Lv（rush では0）。 */
  modeLevel: number;
  /** 現在のボス番号(0-based)。 */
  modeStep: number;
  /** モードのボス総数。 */
  modeTotal: number;
  /** モードクリア種別（結果画面の戻り先用）。 */
  modeCleared: "daily" | "rush" | null;
  /** Casino coins (medals) for the slot machine. */
  coins: number;
  /** ハイコイン: カジノ王の一撃台でのみ稼ぐ上位通貨（伝説賭博セット交換用）。 */
  hiCoins: number;
  /** カジノ王の天井カウンタ: 小当たりなしで回した回転数（KING_SMALL_CEILINGで小当たり確定）。 */
  kingPity: number;
  /** カジノ王の一度きり補填を適用済みか（#125）。 */
  kingComped: boolean;
  /** Whether the next slot spin is a free replay (transient). */
  slotReplay: boolean;
  /** ダイスラッシュ(AT) games remaining (0 = not in AT; transient). */
  atGames: number;
  /** Selected slot machine index (0..MACHINE_COUNT-1; persisted). */
  slotMachine: number;
  /** Spins since the last BIG on this machine (天井 counter; persisted). */
  slotSpins: number;
  /** 連チャンゾーン spins remaining (post-AT high-prob; persisted). */
  slotZone: number;
  /** 6h setting bucket the slot state belongs to (reset when it changes). */
  slotBucket: number;
  /** 総回転数 (data counter). */
  slotTotal: number;
  /** BIG回数 / REG回数 (data counters). */
  slotBig: number;
  slotReg: number;
  /** 最大ハマり (data counter). */
  slotMaxHamari: number;
  /** Timestamps(ms) of recent bonuses, for the 直近の当たり回数 counter. */
  slotHits: number[];
  /** 台パン count this session (transient; resets on ban). */
  daiPanCount: number;
  /** 出禁: bossKills required before the casino reopens (0 = not banned; persisted). */
  casinoBan: number;
  /** Permanent artifact levels (persist across rebirths). */
  artifacts: ArtifactLevels;
  /** Current character class. */
  classId: ClassId;
  /** Consecutive-win count. */
  winStreak: number;
  /** Transient (non-persisted) per-battle flags for no-damage / big-hit titles. */
  battleTookDamage: boolean;
  battleMaxHit: number;
  /** Cumulative progress for achievements/collection. */
  progress: Progress;
  /** Favorited item keys (id:affix) pinned to the inventory top. */
  favorites: string[];
  /** Whether the first-run help has been dismissed. */
  seenHelp: boolean;
  /** Selected title id shown next to the player's name. */
  titleId: string;
  /** Difficulty setting. */
  difficulty: Difficulty;
  /** Preferred hand for the action buttons. */
  handedness: "right" | "left";
  /** Highest reached 50-floor checkpoint; defeat restarts here. */
  checkpoint: number;
  /** Shop one-tap purchase (buy by tapping the item row). */
  tapToBuy: boolean;
  /** Last start-floor chosen in the title pulldown (persisted, #4). */
  startFloorPref: number;
  /** Floor of a just-cleared world boss (drives the world-clear overlay). */
  worldCleared: number | null;
  /** 1000F DEUS EX MACHINA ending is pending (unskippable overlay). */
  pendingEnding: boolean;
  /** Transient Endless-Abyss story line to display (null = none). */
  endlessMessage: string | null;
  /** Items for sale at the current shop floor (not persisted). */
  shopStock: ShopEntry[];

  // selectors
  stats: () => ComputedStats;
  currentFace: () => DiceFace;
  /** Souls that would be earned by rebirthing right now. */
  rebirthGain: () => number;
  /** Whether the player may change class right now (floor-gated). */
  canChangeClass: () => boolean;

  // lifecycle
  hydrate: () => void;
  newGame: () => void;

  // battle
  startBattle: () => void;
  reroll: () => void;
  confirm: () => void;
  /** Decide what happens on the current floor: shop or battle. */
  enterCurrentFloor: () => void;

  // shop
  buyShopItem: (key: string) => void;
  /** Buy every affordable shop item in one tap. */
  buyAffordableShop: () => void;
  leaveShop: () => void;

  // equipment
  equipItem: (itemIndex: number) => void;
  unequipItem: (slot: keyof EquippedItems) => void;
  /** Auto-equip the highest-scoring equippable item in every slot. */
  equipBest: () => void;

  // blacksmith / forge
  /** Forge a target (inventory index or equipped slot) one attempt; protect avoids fail. */
  forgeItem: (loc: "inv" | EquipmentSlot, index: number, protect: boolean) => void;
  /** Combine: feed the cheapest same-slot spare into the target for guaranteed level(s). */
  forgeCombine: (loc: "inv" | EquipmentSlot, index: number) => void;
  /** Inject one ★ modifier tier (capped by deepest floor). */
  forgeInjectStar: (loc: "inv" | EquipmentSlot, index: number) => void;
  /** Clear the last forge result popup. */
  clearLastForge: () => void;
  // 日替わりダンジョン / ボスラッシュ
  refreshDailyLimits: () => void;
  enterDailyDungeon: (level: number) => void;
  enterBossRush: () => void;
  exitMode: () => void;
  forgeStarWithMaterials: (loc: "inv" | EquipmentSlot, index: number) => void;
  markDailyStorySeen: () => void;
  markDailyHelpSeen: () => void;
  // ログイン / クエスト
  refreshQuests: () => void;
  claimLogin: () => void;
  claimQuest: (scope: "daily" | "weekly", id: string) => void;
  rollDailyDice: (faceId: DiceFaceId) => void;
  /** 🎆 花火大会のスコアを記録（自己ベストのみ更新）。 */
  submitFireworksScore: (score: number) => void;
  /** 🎆 受領可能な夏マイルストーン報酬を受け取る。 */
  claimSummerReward: (id: string) => void;

  // misc
  toggleFavorite: (key: string) => void;
  markHelpSeen: () => void;
  /** Dismiss the current achievement-unlock toast (advance the queue). */
  dismissAchievement: () => void;
  setTitle: (id: string) => void;
  setDifficulty: (id: Difficulty) => void;
  setHandedness: (h: "right" | "left") => void;
  setTapToBuy: (v: boolean) => void;
  /** Choose which floor to (re)start a run from: 1 or a reached checkpoint. */
  setStartFloor: (floor: number) => void;
  /** Dismiss the world-clear overlay. */
  clearWorldClear: () => void;
  /** YES at the 1000F ending: 強くてニューゲーム (reset, grant title + 神機マキナ). */
  newGamePlus: () => void;
  /** NO at the 1000F ending: descend into the Endless Abyss. */
  declineEnding: () => void;
  /** Dismiss the current Endless-Abyss story line. */
  clearEndlessMessage: () => void;
  /** Snapshot the current progress as a ranking entry (for submission). */
  currentRankingEntry: (playerName: string) => RankingEntry;
  /** Apply Echo Battle rewards (gold / material / rank points + optional drop). */
  grantEchoRewards: (
    r: { gold: number; gachaPoints: number; rankPoints: number },
    item?: Equipment | null,
  ) => void;
  exportSaveData: () => string;
  importSaveData: (code: string) => boolean;

  // gacha
  scrapItem: (itemIndex: number) => void;
  /** Scrap all non-favorited items at or below the given rarity. */
  scrapBulk: (maxRarity: Rarity) => void;
  /** Sell all unequipped, unlocked Legendary items for gold. */
  sellLegendaries: () => void;
  pullGacha: () => void;
  pullPremium: () => void;
  pullTargeted: (slot: EquipmentSlot) => void;
  clearLastPull: () => void;

  // casino
  casinoSettle: (goldDelta: number, prize?: Equipment | null) => void;
  /** Buy slot coins with gold (price scales with held coins). */
  buyCoins: (coinAmount: number) => void;
  /** Cash all slot coins back into gold. */
  /** カジノコインを増減（甘ダイス発射/払い出し・BJ 用。0未満にはしない）。 */
  addCoins: (delta: number) => void;
  addHiCoins: (delta: number) => void;
  /** カジノ王のスロットを1回プレイ（100コインBET）。結果を返す。 */
  kingPlay: () => KingResult | null;
  /** ハイコインで伝説賭博セットの指定部位を交換。 */
  kingBuyLegend: (slot: EquipmentSlot) => Equipment | null;
  /** Spin the slot. Returns the resolved result, or null if coins are short. */
  slotSpin: () => SlotSpinResult | null;
  /** Sit at a different slot machine (resets 天井/ゾーン for that 台). */
  selectMachine: (i: number) => void;
  /** 台パン: hit the cabinet. Returns the new count and whether it triggered 出禁. */
  daiPan: () => { count: number; banned: boolean };
  /** カジノコイン交換所: spend coins for a set-piece weapon. Returns it or null. */
  coinBuySetWeapon: (setKey: string) => Equipment | null;
  /** カジノコイン交換所: spend 2000 coins for one random 固有(signature) weapon. Returns it or null. */
  coinBuySignatureWeapon: () => Equipment | null;
  /** カジノコイン交換所: spend coins for 転生ポイント (souls). */
  coinBuySouls: (n: number) => void;

  // artifacts / rebirth
  upgradeArtifact: (id: ArtifactId) => void;
  /** 魂の祭壇を1段階上げる（ゴールド/EXP取得アップ。souls を消費）。 */
  offerToAltar: () => void;
  rebirth: () => void;

  // class change (転職)
  changeClass: (id: ClassId) => void;
}

let logCounter = 0;

export const useGameStore = create<GameState>((set, get) => {
  // Saves are DEBOUNCED: writing the whole state (toSavedItem over 150 items +
  // JSON.stringify + synchronous localStorage) every turn was the main cause of
  // auto-battle jank / "重い". We coalesce writes (~1.2s) and flush on tab hide.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function cancelSave(): void {
    if (saveTimer != null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }
  // Detect newly-earned achievements on every state-change (persist is called
  // after every mutating action) and queue an unlock toast. Single chokepoint so
  // we don't have to wire each victory/casino/rebirth site. Does NOT call persist
  // (the outer persist will save the updated notifiedAchievements).
  function syncAchievementToasts(): void {
    const p = get().progress;
    if (!p) return;
    const earned = newlyEarnedAchievements(p);
    if (earned.length === 0) return;
    set({
      progress: { ...p, notifiedAchievements: [...p.notifiedAchievements, ...earned] },
      achievementQueue: [...get().achievementQueue, ...earned],
    });
  }
  function persist(): void {
    syncAchievementToasts();
    if (saveTimer != null) return; // a write is already scheduled
    saveTimer = setTimeout(() => {
      saveTimer = null;
      writeSaveNow();
    }, 1200);
  }
  function flushSave(): void {
    cancelSave();
    writeSaveNow();
  }
  /**
   * Reconcile titles against current progress: unlock + grant souls (0.5–1 each)
   * for any newly-satisfied title, one-time via progress.claimedTitles. Used by
   * non-battle actions (casino/forge/class/echo) and once on hydrate (retroactive).
   */
  function applyTitleGrants(): void {
    const s = get();
    const res = grantTitles(s.progress, s.souls);
    if (res.unlocked.length === 0) return;
    set({ progress: res.progress, souls: res.souls });
    persist();
  }
  function writeSaveNow(): void {
    const s = get();
    saveGame({
      player: s.player,
      equipped: s.equipped,
      inventory: s.inventory,
      currentFloor: s.currentFloor,
      gachaPoints: s.gachaPoints,
      souls: s.souls,
      soulAltar: s.soulAltar,
      materials: s.materials,
      dailyUses: s.dailyUses,
      rushUses: s.rushUses,
      modeResetKey: s.modeResetKey,
      dailyCleared: s.dailyCleared,
      seenDailyStory: s.seenDailyStory,
      seenDailyHelp: s.seenDailyHelp,
      runMode: s.runMode,
      modeFloor: s.modeFloor,
      modeLevel: s.modeLevel,
      modeStep: s.modeStep,
      modeTotal: s.modeTotal,
      modeCleared: s.modeCleared,
      loginDay: s.loginDay,
      loginClaimKey: s.loginClaimKey,
      dailyDiceKey: s.dailyDiceKey,
      dailyDiceFace: s.dailyDiceFace,
      dailyDiceValue: s.dailyDiceValue,
      summerClaimed: s.summerClaimed,
      dailyQuestKey: s.dailyQuestKey,
      dailyQuestBase: s.dailyQuestBase,
      dailyClaimed: s.dailyClaimed,
      weeklyQuestKey: s.weeklyQuestKey,
      weeklyQuestBase: s.weeklyQuestBase,
      weeklyClaimed: s.weeklyClaimed,
      coins: s.coins,
      hiCoins: s.hiCoins,
      kingPity: s.kingPity,
      kingComped: s.kingComped,
      casinoBan: s.casinoBan,
      slot: {
        machine: s.slotMachine,
        bucket: s.slotBucket,
        total: s.slotTotal,
        hamari: s.slotSpins,
        zone: s.slotZone,
        at: s.atGames,
        big: s.slotBig,
        reg: s.slotReg,
        maxHamari: s.slotMaxHamari,
        hits: s.slotHits,
      },
      artifacts: s.artifacts,
      classId: s.classId,
      winStreak: s.winStreak,
      progress: s.progress,
      favorites: s.favorites,
      seenHelp: s.seenHelp,
      titleId: s.titleId,
      difficulty: s.difficulty,
      handedness: s.handedness,
      checkpoint: s.checkpoint,
      tapToBuy: s.tapToBuy,
      startFloorPref: s.startFloorPref,
    });
  }

  /** Put a forged item back into its slot/inventory, re-clamping HP & dice if worn. */
  /** 報酬を該当通貨/素材に加算する差分パッチを作る（ログイン/クエスト共通）。 */
  function rewardPatch(s: GameState, r: Reward): Partial<GameState> {
    switch (r.kind) {
      case "gold":
        return { player: { ...s.player, gold: s.player.gold + r.amount } };
      case "gacha":
        return { gachaPoints: s.gachaPoints + r.amount };
      case "coins":
        return { coins: s.coins + r.amount };
      case "hiCoins":
        return { hiCoins: s.hiCoins + r.amount };
      case "souls":
        return { souls: s.souls + r.amount };
      case "shard":
        return { materials: { ...s.materials, shard: s.materials.shard + r.amount } };
      case "core":
        return { materials: { ...s.materials, core: s.materials.core + r.amount } };
      case "sigil":
        return { materials: { ...s.materials, sigil: s.materials.sigil + r.amount } };
    }
  }

  function placeForged(
    state: GameState,
    loc: "inv" | EquipmentSlot,
    index: number,
    forged: Equipment,
  ): Partial<GameState> {
    if (loc === "inv") {
      return { inventory: state.inventory.map((it, i) => (i === index ? forged : it)) };
    }
    const equipped: EquippedItems = { ...state.equipped, [loc]: forged };
    const stats = currentStats(state.player, equipped, state.activeBuffs);
    return {
      equipped,
      player: { ...state.player, hp: Math.min(state.player.hp, stats.maxHp) },
      diceFaces: buildFaces(equipped, state.classId),
    };
  }

  function pushLogs(
    base: BattleLogEntry[],
    entries: { text: string; tone: BattleLogEntry["tone"] }[],
  ): BattleLogEntry[] {
    const next = [...base];
    for (const e of entries) {
      next.push({ id: ++logCounter, text: e.text, tone: e.tone });
    }
    return next.slice(-LOG_LIMIT);
  }

  function refreshFaces(): DiceFace[] {
    return buildFaces(get().equipped, get().classId);
  }

  /**
   * Roll the die, honoring "luck" buffs and the oracle 6pc (roll 2, keep higher).
   * Returns the kept value plus, when the 2-dice effect fired, BOTH rolled values
   * so the UI can show a marker (players asked for a visible 目印 #2dice).
   */
  function rollWithLuckInfo(): { value: DiceValue; pair: [DiceValue, DiceValue] | null } {
    const min = luckFloor(get().activeBuffs);
    const first = Math.max(rollDice(), min) as DiceValue;
    if (computeSetEffects(get().equipped, get().classId, get().currentFloor).rollTwoDice) {
      const second = Math.max(rollDice(), min) as DiceValue;
      return { value: Math.max(first, second) as DiceValue, pair: [first, second] };
    }
    return { value: first, pair: null };
  }

  /** Live passive bonus from current artifacts/class/equipment + today's daily. */
  function passiveBonus(): StatBonus {
    return computePassiveBonus(
      get().artifacts,
      get().classId,
      get().equipped,
      getDailyBonus(),
      get().currentFloor,
    );
  }

  /** Compute stats including artifact bonuses, active class, and job balance. */
  function currentStats(
    player: Player,
    equipped: EquippedItems,
    buffs: ActiveBuff[] = [],
  ): ComputedStats {
    const base = computePlayerStats(
      player,
      equipped,
      buffs,
      get().classId,
      passiveBonus(),
      get().currentFloor,
    );
    // 深淵到達補正: 1000階超のみ攻撃・最大HPを複利スケール（1000階以下は asc=1 で不変）。
    const asc = endlessAscension(get().currentFloor);
    if (asc === 1) return base;
    return { ...base, attack: Math.round(base.attack * asc), maxHp: Math.round(base.maxHp * asc) };
  }

  /** Apply a loaded save into state (used by hydrate and import). */
  function applyLoaded(loaded: LoadedState): void {
    set({
      player: loaded.player,
      equipped: loaded.equipped,
      inventory: loaded.inventory,
      currentFloor: loaded.currentFloor,
      gachaPoints: loaded.gachaPoints,
      souls: loaded.souls,
      soulAltar: loaded.soulAltar,
      materials: loaded.materials,
      dailyUses: loaded.dailyUses,
      rushUses: loaded.rushUses,
      modeResetKey: loaded.modeResetKey,
      dailyCleared: loaded.dailyCleared,
      seenDailyStory: loaded.seenDailyStory,
      seenDailyHelp: loaded.seenDailyHelp,
      runMode: loaded.runMode,
      modeFloor: loaded.modeFloor,
      modeLevel: loaded.modeLevel,
      modeStep: loaded.modeStep,
      modeTotal: loaded.modeTotal,
      modeCleared: loaded.modeCleared,
      loginDay: loaded.loginDay,
      loginClaimKey: loaded.loginClaimKey,
      dailyDiceKey: loaded.dailyDiceKey,
      dailyDiceFace: loaded.dailyDiceFace,
      dailyDiceValue: loaded.dailyDiceValue,
      summerClaimed: loaded.summerClaimed,
      dailyQuestKey: loaded.dailyQuestKey,
      dailyQuestBase: loaded.dailyQuestBase,
      dailyClaimed: loaded.dailyClaimed,
      weeklyQuestKey: loaded.weeklyQuestKey,
      weeklyQuestBase: loaded.weeklyQuestBase,
      weeklyClaimed: loaded.weeklyClaimed,
      coins: loaded.coins,
      hiCoins: loaded.hiCoins,
      kingPity: loaded.kingPity,
      kingComped: loaded.kingComped,
      slotReplay: false,
      // Slot state survives reload, but RESETS when the 6h setting bucket changes
      // (settings reshuffled → fresh 天井/ゾーン/カウンタ).
      ...(() => {
        const cur = settingBucket();
        const sl = loaded.slot;
        const reset = sl.bucket !== cur;
        return {
          slotMachine: sl.machine,
          slotSpins: reset ? 0 : sl.hamari,
          slotZone: reset ? 0 : Math.min(sl.zone, ZONE_SPINS),
          // 旧バージョンで発散した巨大なAT残りでソフトロックしないよう上限を固定。
          atGames: reset ? 0 : Math.min(Math.max(0, sl.at), AT_GAMES),
          slotTotal: reset ? 0 : sl.total,
          slotBig: reset ? 0 : sl.big,
          slotReg: reset ? 0 : sl.reg,
          slotMaxHamari: reset ? 0 : sl.maxHamari,
          slotHits: reset ? [] : (Array.isArray(sl.hits) ? sl.hits.slice(-200) : []),
          slotBucket: cur,
        };
      })(),
      daiPanCount: 0,
      casinoBan: loaded.casinoBan,
      artifacts: loaded.artifacts,
      classId: loaded.classId,
      winStreak: loaded.winStreak,
      progress: loaded.progress,
      favorites: loaded.favorites,
      seenHelp: loaded.seenHelp,
      titleId: loaded.titleId,
      difficulty: normalizeDifficulty(loaded.difficulty),
      handedness: loaded.handedness,
      checkpoint: loaded.checkpoint,
      tapToBuy: loaded.tapToBuy,
      startFloorPref: loaded.startFloorPref,
      hydrated: true,
      currentEnemy: null,
      battleState: "idle",
      battleLog: [],
      lastResult: null,
      activeBuffs: [],
      worldCleared: null,
      pendingEnding: false,
      endlessMessage: null,
      shopStock: [],
    });
    set({ diceFaces: refreshFaces() });

    // 一度きりの補填(#125): カジノ王を回した「痕跡がある人」へ30万コイン。
    // すでに配布済みのため一旦無効化（再付与・誤判定の事故防止）。再開時はこのブロックを戻す。
    // if (!loaded.kingComped) {
    //   const playedKing =
    //     loaded.hiCoins > 0 ||
    //     loaded.kingPity > 0 ||
    //     EQUIP_SLOTS.some((sl) => loaded.equipped[sl]?.setId === "legendgambler") ||
    //     loaded.inventory.some((it) => it.setId === "legendgambler");
    //   set({
    //     coins: get().coins + (playedKing ? KING_COMP_COINS : 0),
    //     kingComped: true,
    //   });
    //   persist();
    // }
  }

  return {
    hydrated: false,
    player: createPlayer(),
    equipped: emptyEquipped(),
    inventory: [],
    currentEnemy: null,
    currentFloor: 1,
    battleState: "idle",
    diceValue: 1,
    twoDice: null,
    diceFaces: [],
    rerollsLeft: 1,
    battleLog: [],
    achievementQueue: [],
    lastResult: null,
    activeBuffs: [],
    playerStatuses: [],
    playerStunTurns: 0,
    gachaPoints: 0,
    lastPull: null,
    lastForge: null,
    souls: 0,
    soulAltar: 0,
    materials: emptyMaterials(),
    dailyUses: DAILY_BASE_USES,
    rushUses: RUSH_BASE_USES,
    modeResetKey: "",
    dailyCleared: [],
    seenDailyStory: false,
    seenDailyHelp: false,
    loginDay: 0,
    loginClaimKey: "",
    dailyDiceKey: "",
    dailyDiceFace: "",
    dailyDiceValue: 0,
    summerClaimed: [],
    dailyQuestKey: "",
    dailyQuestBase: emptySnapshot(),
    dailyClaimed: [],
    weeklyQuestKey: "",
    weeklyQuestBase: emptySnapshot(),
    weeklyClaimed: [],
    runMode: "normal",
    modeFloor: 0,
    modeLevel: 0,
    modeStep: 0,
    modeTotal: 0,
    modeCleared: null,
    coins: 0,
    hiCoins: 0,
    kingPity: 0,
    kingComped: false,
    slotReplay: false,
    atGames: 0,
    slotMachine: 0,
    slotSpins: 0,
    slotZone: 0,
    slotBucket: 0,
    slotTotal: 0,
    slotBig: 0,
    slotReg: 0,
    slotMaxHamari: 0,
    slotHits: [],
    daiPanCount: 0,
    casinoBan: 0,
    artifacts: defaultArtifactLevels(),
    classId: DEFAULT_CLASS_ID,
    winStreak: 0,
    battleTookDamage: false,
    battleMaxHit: 0,
    progress: defaultProgress(),
    favorites: [],
    seenHelp: false,
    titleId: "",
    difficulty: "normal",
    handedness: "right",
    checkpoint: 1,
    tapToBuy: false,
    startFloorPref: 1,
    worldCleared: null,
    pendingEnding: false,
    endlessMessage: null,
    shopStock: [],

    stats: () => currentStats(get().player, get().equipped, get().activeBuffs),
    currentFace: () => faceByValue(get().diceFaces, get().diceValue),
    rebirthGain: () => computeRebirthGain(get().currentFloor, get().player.level),
    // 転職できるのは初期クラス中・敗北直後・セーブポイント階（1,51,101…）。
    canChangeClass: () => canChangeClassNow(get()),

    hydrate: () => {
      if (get().hydrated) return;
      // 1日1回（＋更新後の初回）、メモリ解放のためページをリロードする。必要な時
      // だけ即リロードし、解放後の新しいページで改めて読み込みが走る。
      runDailyMaintenance();
      const loaded = loadGame();
      if (loaded) {
        applyLoaded(loaded);
        // Retroactive one-time title grant: existing players unlock every
        // already-satisfied title and receive its souls once (claimedTitles gates
        // re-granting). flushSave persists immediately so a reload can't double it.
        const before = get().progress.claimedTitles.length;
        applyTitleGrants();
        if (get().progress.claimedTitles.length !== before) flushSave();
        // 日付が変わっていれば回数制限を全回復（毎日0時リセット）。
        get().refreshDailyLimits();
        // デイリー/ウィークリークエストの基準を必要に応じてリセット。
        get().refreshQuests();
      } else {
        // Fresh save: start with a humble weapon already equipped.
        const starter = getItemById("rusty_sword");
        set({
          player: createPlayer(),
          equipped: { ...emptyEquipped(), weapon: starter },
          inventory: [],
          currentFloor: 1,
          hydrated: true,
        });
        persist();
      }
      set({ diceFaces: refreshFaces() });
    },

    newGame: () => {
      cancelSave();
      clearSave();
      const starter = getItemById("rusty_sword");
      set({
        player: createPlayer(),
        equipped: { ...emptyEquipped(), weapon: starter },
        inventory: [],
        currentFloor: 1,
        currentEnemy: null,
        battleState: "idle",
        battleLog: [],
        lastResult: null,
        activeBuffs: [],
        gachaPoints: 0,
        lastPull: null,
        souls: 0,
        soulAltar: 0,
        materials: emptyMaterials(),
        dailyUses: DAILY_BASE_USES,
        rushUses: RUSH_BASE_USES,
        modeResetKey: todayKey(),
        dailyCleared: [],
        runMode: "normal",
        modeCleared: null,
        loginDay: 0,
        loginClaimKey: "",
        dailyDiceKey: "",
        dailyDiceFace: "",
        dailyDiceValue: 0,
        summerClaimed: [],
        dailyQuestKey: "",
        dailyQuestBase: emptySnapshot(),
        dailyClaimed: [],
        weeklyQuestKey: "",
        weeklyQuestBase: emptySnapshot(),
        weeklyClaimed: [],
        artifacts: defaultArtifactLevels(),
        classId: DEFAULT_CLASS_ID,
        winStreak: 0,
        progress: defaultProgress(),
        favorites: [],
        seenHelp: true,
        titleId: "",
        difficulty: get().difficulty,
        handedness: get().handedness,
        checkpoint: 1,
        tapToBuy: get().tapToBuy,
        startFloorPref: 1,
        worldCleared: null,
        hydrated: true,
      });
      set({ diceFaces: refreshFaces() });
      persist();
    },

    startBattle: () => {
      const { currentFloor, player, runMode, modeFloor, modeLevel, modeStep, modeTotal } = get();
      const stats = currentStats(player, get().equipped, get().activeBuffs);
      // モード戦は modeFloor で敵を生成（通常フロアには触れない）。
      const genFloor = runMode === "normal" ? currentFloor : modeFloor;
      const enemy = generateEnemy(genFloor, difficultyScale(get().difficulty));
      // Heal a little between fights so runs are survivable but not free.
      // ボスラッシュは回復なしで歯応えを担保。
      const regen = runMode === "rush" ? 0 : Math.round(stats.maxHp * 0.15);
      const healed = Math.min(stats.maxHp, player.hp + regen);
      const opening = rollWithLuckInfo();
      const where =
        runMode === "daily"
          ? `日替Lv${modeLevel}`
          : runMode === "rush"
            ? `ボスラッシュ ${modeStep + 1}/${modeTotal}`
            : `${currentFloor}階`;
      set({
        currentEnemy: enemy,
        battleState: "player",
        diceFaces: refreshFaces(),
        diceValue: opening.value,
        twoDice: opening.pair,
        rerollsLeft: stats.rerolls,
        lastResult: null,
        player: { ...player, hp: healed },
        // Player statuses are battle-scoped — clear at the start of each fight.
        playerStatuses: [],
        playerStunTurns: 0,
        // Per-battle title flags reset each fight.
        battleTookDamage: false,
        battleMaxHit: 0,
        battleLog: pushLogs([], [
          { text: `${where} — ${enemy.name} が現れた！`, tone: "neutral" },
        ]),
      });
    },

    reroll: () => {
      const state = get();
      const { rerollsLeft, battleState } = state;
      if (battleState !== "player" || rerollsLeft <= 0) return;
      // Oracle 2pc: reroll heals a little.
      const setEff = computeSetEffects(state.equipped, state.classId, state.currentFloor);
      let player = state.player;
      if (setEff.healOnReroll > 0) {
        const maxHp = currentStats(player, state.equipped, state.activeBuffs).maxHp;
        const healed = Math.min(maxHp, player.hp + setEff.healOnReroll);
        if (healed !== player.hp) player = { ...player, hp: healed };
      }
      // 伝説賭博セット4pc: リロール時に出目6を確定（このとき2個振りの目印は出さない）。
      const rolled = setEff.rerollSix
        ? { value: 6 as DiceValue, pair: null }
        : rollWithLuckInfo();
      set({
        diceValue: rolled.value,
        twoDice: rolled.pair,
        rerollsLeft: rerollsLeft - 1,
        player,
      });
    },

    confirm: () => {
      const state = get();
      if (state.battleState !== "player" || !state.currentEnemy) return;

      const stats = currentStats(state.player, state.equipped, state.activeBuffs);
      const face = faceByValue(state.diceFaces, state.diceValue);
      const enemy = state.currentEnemy;

      const action = resolvePlayerAction(face, stats, enemy);

      // ===== Set-bonus combat effects =====
      const setEff = computeSetEffects(state.equipped, state.classId, state.currentFloor);
      const v = state.diceValue;
      const setLogs: string[] = [];
      let bonusDamage = 0;
      let bonusHeal = 0;
      if (action.enemyDamage > 0) {
        if (setEff.highFaceDmgBonus > 0 && (v === 5 || v === 6)) {
          bonusDamage += Math.round(stats.attack * setEff.highFaceDmgBonus);
        }
        if (setEff.sixDmgBonus > 0 && v === 6) {
          bonusDamage += Math.round(stats.attack * setEff.sixDmgBonus);
        }
        if (setEff.extraHit && action.hits > 0) {
          bonusDamage += Math.round(action.enemyDamage / action.hits);
          setLogs.push("処刑人セット: 追撃！");
        }
        if (setEff.sixDouble && v === 6) {
          bonusDamage += action.enemyDamage;
          bonusHeal += action.heal;
          setLogs.push("賭博師セット: 6が2回発動！");
        }
      }
      let totalEnemyDamage = action.enemyDamage + bonusDamage;
      // 伝説賭博セット2pc: 一定確率で与ダメージ2倍。
      if (setEff.doubleDmgChance > 0 && totalEnemyDamage > 0 && Math.random() < setEff.doubleDmgChance) {
        totalEnemyDamage *= 2;
        setLogs.push("伝説賭博セット: 暴れ打ち！ ダメージ2倍！");
      }
      const attackHp = enemy.hp - totalEnemyDamage;
      if (setEff.lifestealAllPct > 0 && totalEnemyDamage > 0) {
        bonusHeal += Math.round(totalEnemyDamage * setEff.lifestealAllPct);
      }
      if (setEff.lifestealHighFacePct > 0 && v >= 4 && totalEnemyDamage > 0) {
        bonusHeal += Math.round(totalEnemyDamage * setEff.lifestealHighFacePct);
      }
      // Executioner 6pc: execute non-boss enemies at ≤15% HP.
      // executeImmune の敵(ボス/最終ボス/一部章ボス)は即死しない。
      if (
        setEff.executePct > 0 &&
        !enemy.isBoss &&
        !enemy.executeImmune &&
        attackHp > 0 &&
        enemy.hp <= enemy.maxHp * setEff.executePct
      ) {
        totalEnemyDamage = enemy.hp;
        setLogs.push("処刑人セット: 処刑！ (即死)");
      }
      if (bonusHeal > 0) setLogs.push(`セット効果で ${bonusHeal} 回復`);

      let enemyHp = enemy.hp - totalEnemyDamage;
      let playerHp = state.player.hp - action.selfDamage + action.heal + bonusHeal;
      playerHp = Math.min(stats.maxHp, playerHp);

      let log = pushLogs(
        state.battleLog,
        [...action.logs, ...setLogs].map((text) => ({ text, tone: "good" as const })),
      );

      // 1) Enemy defeated by the player's attack?
      if (enemyHp <= 0) {
        const updatedEnemy = { ...enemy, hp: 0 };
        log = pushLogs(log, [{ text: `${enemy.name} を倒した！`, tone: "good" }]);
        const result = finishVictory(state, log, playerHp, updatedEnemy, {
          tookDamage: state.battleTookDamage,
          maxHit: Math.max(state.battleMaxHit, totalEnemyDamage),
        });
        set(result);
        persistFromSnapshot(result);
        return;
      }

      // 2) Self-damage could kill the player.
      if (playerHp <= 0) {
        const lost = finishDefeat(state, log, enemy, enemyHp);
        set(lost);
        persistFromSnapshot(lost);
        return;
      }

      // 3) Resolve existing status-over-time on the enemy (ignores defense).
      const tick = tickEnemyStatuses(enemy);
      let statuses = tick.statuses;
      if (tick.damage > 0) {
        enemyHp -= tick.damage;
        log = pushLogs(log, tick.logs.map((text) => ({ text, tone: "good" as const })));
      }

      // 4) Enemy finished off by status damage → victory without retaliation.
      if (enemyHp <= 0) {
        const updatedEnemy = { ...enemy, hp: 0, statuses };
        log = pushLogs(log, [{ text: `${enemy.name} は力尽きた！`, tone: "good" }]);
        const result = finishVictory(state, log, playerHp, updatedEnemy, {
          tookDamage: state.battleTookDamage,
          maxHit: Math.max(state.battleMaxHit, totalEnemyDamage),
        });
        set(result);
        persistFromSnapshot(result);
        return;
      }

      // 5) Apply the status freshly inflicted this turn (ticks from next turn).
      if (action.status) {
        statuses = addStatus(statuses, action.status);
      }

      // 6) Enemy turn — unless stunned. Stun applied this turn skips now.
      let stunTurns = (enemy.stunTurns ?? 0) + action.stun;
      let bonusDefense = enemy.bonusDefense ?? 0;
      let bonusDefenseTurns = enemy.bonusDefenseTurns ?? 0;
      // Weaken applied this turn affects the enemy's attack starting now.
      let weakenAmount = enemy.weakenAmount ?? 0;
      let weakenTurns = enemy.weakenTurns ?? 0;
      if (action.weaken > 0) {
        weakenAmount = action.weaken;
        weakenTurns = WEAKEN_TURNS;
      }
      // Boss gimmick state.
      let enraged = enemy.enraged ?? false;
      let charging = enemy.charging ?? false;
      let chargeCounter = enemy.chargeCounter ?? 0;
      // Player-side statuses inflicted by enemies (poison/stun).
      let playerStatuses = state.playerStatuses ?? [];
      let playerStunTurns = state.playerStunTurns ?? 0;
      // Enrage when a boss drops to half HP.
      if (enemy.isBoss && !enraged && enemyHp <= enemy.maxHp / 2) {
        enraged = true;
        log = pushLogs(log, [{ text: `${enemy.name} が激昂した！ 攻撃力が上がった`, tone: "bad" }]);
      }

      const decayWeaken = () => {
        if (weakenTurns > 0) {
          weakenTurns -= 1;
          if (weakenTurns === 0) weakenAmount = 0;
        }
      };

      // Track enemy-dealt damage this turn (for no-damage / perfect-clear titles).
      let enemyDamageThisTurn = 0;

      if (stunTurns > 0) {
        stunTurns -= 1;
        log = pushLogs(log, [{ text: `${enemy.name} はスタンして動けない！`, tone: "good" }]);
      } else if (enemy.isBoss) {
        // Boss-specific gimmick turn. 1000F final boss uses a JRPG "last boss"
        // pattern (phases / multi-action / charged ultimate); others use the
        // standard enrage + charge cycle + heal.
        const turn =
          enemy.templateId === "deus"
            ? resolveFinalBossTurn({ ...enemy, hp: enemyHp, enraged, weakenAmount, weakenTurns }, stats, action.guard)
            : resolveBossTurn({ ...enemy, enraged, weakenAmount, weakenTurns }, stats, action.guard);
        if (turn.enemyHeal > 0) enemyHp = Math.min(enemy.maxHp, enemyHp + turn.enemyHeal);
        charging = turn.charging;
        chargeCounter = turn.chargeCounter;
        decayWeaken();
        // 伝説賭博セット6pc: 回避（敵の攻撃を確率で無効化）。
        let bossDmg = turn.playerDamage;
        if (bossDmg > 0 && setEff.dodgeChance > 0 && Math.random() < setEff.dodgeChance) {
          bossDmg = 0;
          log = pushLogs(log, [{ text: "回避！ 伝説賭博セットで見切った！", tone: "good" }]);
        }
        playerHp -= bossDmg;
        enemyDamageThisTurn += bossDmg;
        log = pushLogs(log, turn.logs.map((text) => ({ text, tone: "bad" as const })));
        // Final boss can disrupt the player's dice (lose rerolls), mitigated by stun-resist gear.
        if (turn.playerStun && turn.playerStun > 0) {
          if (Math.random() < equippedResist(state.equipped).stun) {
            log = pushLogs(log, [{ text: "出目の乱れを耐えた！", tone: "good" }]);
          } else {
            playerStunTurns += turn.playerStun;
          }
        }

        if (playerHp <= 0) {
          const lost = finishDefeat(
            { ...state, player: { ...state.player, hp: 0 } },
            log,
            { ...enemy, statuses, stunTurns, bonusDefense, bonusDefenseTurns, weakenAmount, weakenTurns, enraged, charging, chargeCounter },
            enemyHp,
          );
          set(lost);
          persistFromSnapshot(lost);
          return;
        }
      } else {
        // Normal enemy: special ability or attack (weaken reduces its attack).
        const turn = resolveEnemyTurn({ ...enemy, weakenAmount, weakenTurns }, stats, action.guard);
        if (turn.enemyHeal > 0) {
          enemyHp = Math.min(enemy.maxHp, enemyHp + turn.enemyHeal);
        }
        if (turn.defendValue > 0) {
          bonusDefense = turn.defendValue;
          bonusDefenseTurns = 2;
        } else if (bonusDefenseTurns > 0) {
          bonusDefenseTurns -= 1;
          if (bonusDefenseTurns === 0) bonusDefense = 0;
        }
        decayWeaken();
        // 伝説賭博セット6pc: 回避（敵の攻撃を確率で無効化）。
        let normDmg = turn.playerDamage;
        if (normDmg > 0 && setEff.dodgeChance > 0 && Math.random() < setEff.dodgeChance) {
          normDmg = 0;
          log = pushLogs(log, [{ text: "回避！ 伝説賭博セットで見切った！", tone: "good" }]);
        }
        playerHp -= normDmg;
        enemyDamageThisTurn += normDmg;
        log = pushLogs(log, turn.logs.map((text) => ({ text, tone: "bad" as const })));
        // Enemy-inflicted player statuses (mitigated by resistance gear).
        const resist = equippedResist(state.equipped);
        if (turn.playerPoison > 0) {
          const dmg = Math.max(1, Math.round(turn.playerPoison * (1 - resist.poison)));
          playerStatuses = addStatus(playerStatuses, {
            kind: "poison",
            damagePerTurn: dmg,
            remainingTurns: PLAYER_POISON_TURNS,
          });
        }
        if (turn.playerStun > 0) {
          if (Math.random() < resist.stun) {
            log = pushLogs(log, [{ text: "麻痺を耐えた！", tone: "good" }]);
          } else {
            playerStunTurns += turn.playerStun;
          }
        }

        if (playerHp <= 0) {
          const lost = finishDefeat(
            { ...state, player: { ...state.player, hp: 0 } },
            log,
            { ...enemy, statuses, stunTurns, bonusDefense, bonusDefenseTurns, weakenAmount, weakenTurns, enraged, charging, chargeCounter },
            enemyHp,
          );
          set(lost);
          persistFromSnapshot(lost);
          return;
        }
      }

      // Player poison/burn ticks at the end of the round.
      if (playerStatuses.length > 0) {
        let dot = 0;
        const remain: ActiveStatus[] = [];
        for (const s of playerStatuses) {
          dot += s.damagePerTurn;
          if (s.remainingTurns - 1 > 0) remain.push({ ...s, remainingTurns: s.remainingTurns - 1 });
        }
        playerStatuses = remain;
        if (dot > 0) {
          playerHp -= dot;
          enemyDamageThisTurn += dot;
          log = pushLogs(log, [{ text: `毒で ${dot} ダメージ`, tone: "bad" }]);
          if (playerHp <= 0) {
            const lost = finishDefeat(
              { ...state, player: { ...state.player, hp: 0 } },
              log,
              { ...enemy, hp: enemyHp, statuses, stunTurns, bonusDefense, bonusDefenseTurns, weakenAmount, weakenTurns, enraged, charging, chargeCounter },
              enemyHp,
            );
            set(lost);
            persistFromSnapshot(lost);
            return;
          }
        }
      }

      // Stun makes the player lose rerolls next turn, then ticks down.
      const nextRerolls = playerStunTurns > 0 ? 0 : stats.rerolls;
      const nextStun = Math.max(0, playerStunTurns - 1);
      if (playerStunTurns > 0) {
        log = pushLogs(log, [{ text: "スタン！ 次のターンはリロール不可", tone: "bad" }]);
      }

      // Next turn: fresh roll + rerolls. Carry the per-battle title flags forward.
      const nextRoll = rollWithLuckInfo();
      set({
        currentEnemy: { ...enemy, hp: enemyHp, statuses, stunTurns, bonusDefense, bonusDefenseTurns, weakenAmount, weakenTurns, enraged, charging, chargeCounter, bossTurns: (enemy.bossTurns ?? 0) + 1 },
        player: { ...state.player, hp: playerHp },
        diceValue: nextRoll.value,
        twoDice: nextRoll.pair,
        rerollsLeft: nextRerolls,
        playerStatuses,
        playerStunTurns: nextStun,
        battleTookDamage: state.battleTookDamage || enemyDamageThisTurn > 0,
        battleMaxHit: Math.max(state.battleMaxHit, totalEnemyDamage),
        battleLog: log,
      });
    },

    enterCurrentFloor: () => {
      // モード戦（日替わり/ボスラッシュ）中は通常フロア進行を起動しない。
      // リロード等で戦闘状態(battleState)が失われた場合はここで再開し、消費した回数を
      // 無駄にしない。終了済みセッションの残骸(modeCleared)は掃除して通常へ戻す。
      if (get().runMode !== "normal") {
        if (get().modeCleared) {
          get().exitMode();
        } else if (get().battleState === "idle") {
          get().startBattle();
        }
        return;
      }
      const floor = get().currentFloor;
      // Leaving the result/world-clear screen always dismisses the overlay flag.
      if (get().worldCleared !== null) set({ worldCleared: null });
      if (isShopFloor(floor)) {
        set({
          battleState: "shop",
          currentEnemy: null,
          shopStock: generateShopStock(floor),
        });
      } else {
        get().startBattle();
      }
    },

    buyShopItem: (key: string) => {
      const state = get();
      const entry = state.shopStock.find((e) => e.key === key);
      if (!entry || entry.sold || state.player.gold < entry.price) return;

      const markSold = () =>
        state.shopStock.map((e) => (e.key === key ? { ...e, sold: true } : e));
      const goldAfter = state.player.gold - entry.price;

      if (entry.kind === "equipment" && entry.equipment) {
        const capped = capInventory([...state.inventory, { ...entry.equipment }], state.favorites);
        set({
          player: { ...state.player, gold: goldAfter },
          inventory: capped.kept,
          gachaPoints: state.gachaPoints + capped.material,
          shopStock: markSold(),
          progress: { ...state.progress, discoveredItems: discover(state.progress.discoveredItems, entry.equipment.id) },
        });
      } else if (entry.kind === "consumable" && entry.consumable) {
        const c = entry.consumable;
        let player = { ...state.player, gold: goldAfter };
        let buffs = state.activeBuffs;
        if (c.kind === "heal") {
          const maxHp = currentStats(player, state.equipped, buffs).maxHp;
          player = { ...player, hp: Math.min(maxHp, player.hp + c.value) };
        } else {
          buffs = [...buffs, { kind: c.kind, value: c.value, battlesLeft: c.battles }];
        }
        set({ player, activeBuffs: buffs, shopStock: markSold() });
      } else {
        return;
      }
      persist();
    },

    buyAffordableShop: () => {
      // Buy each not-sold item the player can currently afford (gold updates live).
      for (const e of get().shopStock) {
        if (!e.sold && get().player.gold >= e.price) get().buyShopItem(e.key);
      }
    },

    leaveShop: () => {
      // Move past the shop floor and start the next encounter.
      set({ currentFloor: get().currentFloor + 1, battleState: "idle" });
      get().enterCurrentFloor();
      persist();
    },

    equipItem: (itemIndex: number) => {
      const state = get();
      const item = state.inventory[itemIndex];
      if (!item) return;
      // Class equip restriction.
      if (!canEquip(item, state.classId)) return;

      const slot = item.slot;
      const previously = state.equipped[slot];

      const inventory = state.inventory.filter((_, i) => i !== itemIndex);
      if (previously) inventory.push(previously);

      const equipped: EquippedItems = { ...state.equipped, [slot]: item };

      // Re-clamp hp to the new computed max.
      const stats = currentStats(state.player, equipped);
      const player = { ...state.player, hp: Math.min(state.player.hp, stats.maxHp) };

      // 称号用: フル装備に達したセットを記録。
      let setsCompleted = state.progress.setsCompleted;
      const counts: Record<string, number> = {};
      for (const sl of EQUIP_SLOTS) {
        const it = equipped[sl];
        if (it?.setId) counts[it.setId] = (counts[it.setId] ?? 0) + 1;
      }
      for (const [key, n] of Object.entries(counts)) {
        const def = getSetDef(key);
        if (!def) continue;
        const maxPieces = Math.max(...def.bonuses.map((b) => b.pieces));
        if (n >= maxPieces) setsCompleted = addUnique(setsCompleted, key);
      }

      set({
        equipped,
        inventory,
        player,
        diceFaces: buildFaces(equipped, state.classId),
        progress: setsCompleted === state.progress.setsCompleted ? state.progress : { ...state.progress, setsCompleted },
      });
      applyTitleGrants();
      persist();
    },

    unequipItem: (slot: keyof EquippedItems) => {
      const state = get();
      const item = state.equipped[slot];
      if (!item) return;
      const equipped: EquippedItems = { ...state.equipped, [slot]: null };
      const inventory = [...state.inventory, item];
      const stats = currentStats(state.player, equipped);
      const player = { ...state.player, hp: Math.min(state.player.hp, stats.maxHp) };
      set({
        equipped,
        inventory,
        player,
        diceFaces: buildFaces(equipped, state.classId),
      });
      persist();
    },

    equipBest: () => {
      const state = get();
      const score = (it: Equipment) =>
        it.attack * 2 + it.defense * 1.5 + it.maxHp * 0.4 + it.rerollModifier * 25 + (it.modTier ?? 0) * 5;
      const equipped: EquippedItems = { ...state.equipped };
      let inventory = [...state.inventory];

      for (const slot of EQUIP_SLOTS) {
        // Best candidate in inventory for this slot (class-eligible).
        let bestIdx = -1;
        let bestScore = equipped[slot] ? score(equipped[slot] as Equipment) : -Infinity;
        inventory.forEach((it, i) => {
          if (it.slot !== slot || !canEquip(it, state.classId)) return;
          const s = score(it);
          if (s > bestScore) {
            bestScore = s;
            bestIdx = i;
          }
        });
        if (bestIdx < 0) continue; // nothing better than what's equipped
        const chosen = inventory[bestIdx];
        inventory = inventory.filter((_, i) => i !== bestIdx);
        if (equipped[slot]) inventory.push(equipped[slot] as Equipment);
        equipped[slot] = chosen;
      }

      const stats = currentStats(state.player, equipped);
      set({
        equipped,
        inventory,
        player: { ...state.player, hp: Math.min(state.player.hp, stats.maxHp) },
        diceFaces: buildFaces(equipped, state.classId),
      });
      persist();
    },

    forgeItem: (loc, index, protect) => {
      const state = get();
      const item = loc === "inv" ? state.inventory[index] : state.equipped[loc];
      if (!item || item.noModifier) return;
      const level = item.forgeLevel ?? 0;
      const fmax = forgeMax(isCleared1000(state.progress)); // 1000階踏破で上限解放
      if (level >= fmax) return;
      let cost = forgeCost(level);
      if (protect) cost = Math.round(cost * 1.5);
      if (state.gachaPoints < cost) return;

      const streak = item.forgeStreak ?? 0;
      const out = rollForge(level, streak, protect);
      const newLevel = out.kind === "fail" ? level : Math.min(fmax, level + out.delta);
      const newStreak = out.kind === "fail" ? streak + 1 : 0;
      const forged = getItemInstance(item.id, item.affixId, item.modTier, item.quality, newLevel, newStreak);
      if (!forged) return;

      const partial = placeForged(state, loc, index, forged);
      const success = out.kind !== "fail";
      set({
        ...partial,
        gachaPoints: state.gachaPoints - cost + out.refund,
        lastForge: { kind: out.kind, from: level, to: newLevel },
        progress: {
          ...state.progress,
          forgeCount: state.progress.forgeCount + (success ? 1 : 0),
          maxForgeLevel: Math.max(state.progress.maxForgeLevel, newLevel),
        },
      });
      applyTitleGrants();
      persist();
    },

    forgeCombine: (loc, index) => {
      const state = get();
      const item = loc === "inv" ? state.inventory[index] : state.equipped[loc];
      if (!item || item.noModifier) return;
      const level = item.forgeLevel ?? 0;
      const fmax = forgeMax(isCleared1000(state.progress)); // 1000階踏破で上限解放
      if (level >= fmax) return;
      // Cheapest same-slot spare in inventory (not the target, not locked).
      const score = (it: Equipment) => it.attack + it.defense + it.maxHp + (it.modTier ?? 0) * 5;
      let feederIdx = -1;
      let feederScore = Infinity;
      state.inventory.forEach((it, i) => {
        if (loc === "inv" && i === index) return;
        if (it.slot !== item.slot) return;
        if (it.noSell || state.favorites.includes(itemKey(it))) return;
        const s = score(it);
        if (s < feederScore) {
          feederScore = s;
          feederIdx = i;
        }
      });
      if (feederIdx < 0) return;
      const feeder = state.inventory[feederIdx];
      // Same base id → +2 (duplicate rescue), else +1.
      const delta = feeder.id === item.id ? 2 : 1;
      const newLevel = Math.min(fmax, level + delta);
      const forged = getItemInstance(item.id, item.affixId, item.modTier, item.quality, newLevel, item.forgeStreak);
      if (!forged) return;

      // Remove the feeder, then place the forged target.
      let inventory = state.inventory.filter((_, i) => i !== feederIdx);
      const lastForge = { kind: "normal" as ForgeKind, from: level, to: newLevel };
      const forgeProgress = {
        ...state.progress,
        forgeCount: state.progress.forgeCount + 1,
        maxForgeLevel: Math.max(state.progress.maxForgeLevel, newLevel),
      };
      if (loc === "inv") {
        const tIdx = feederIdx < index ? index - 1 : index;
        inventory = inventory.map((it, i) => (i === tIdx ? forged : it));
        set({ inventory, lastForge, progress: forgeProgress });
      } else {
        const equipped: EquippedItems = { ...state.equipped, [loc]: forged };
        const stats = currentStats(state.player, equipped, state.activeBuffs);
        set({
          inventory,
          equipped,
          player: { ...state.player, hp: Math.min(state.player.hp, stats.maxHp) },
          diceFaces: buildFaces(equipped, state.classId),
          lastForge,
          progress: forgeProgress,
        });
      }
      applyTitleGrants();
      persist();
    },

    forgeInjectStar: (loc, index) => {
      const state = get();
      const item = loc === "inv" ? state.inventory[index] : state.equipped[loc];
      if (!item || item.noModifier) return;
      const cur = item.modTier ?? 0;
      const cap = modTierForFloor(state.progress.highestFloorReached) + 2;
      if (cur >= cap) return;
      const cost = starInjectCost(cur);
      if (state.gachaPoints < cost) return;
      const forged = getItemInstance(item.id, item.affixId, cur + 1, item.quality, item.forgeLevel, item.forgeStreak);
      if (!forged) return;
      const partial = placeForged(state, loc, index, forged);
      set({ ...partial, gachaPoints: state.gachaPoints - cost });
      persist();
    },

    clearLastForge: () => set({ lastForge: null }),

    // ===== 日替わりダンジョン / ボスラッシュ =====
    refreshDailyLimits: () => {
      const s = get();
      const key = todayKey();
      if (s.modeResetKey === key) return;
      set({
        dailyUses: maxDailyUses(s.progress.highestFloorReached),
        rushUses: maxRushUses(s.progress.highestFloorReached),
        modeResetKey: key,
      });
      persist();
    },

    enterDailyDungeon: (level: number) => {
      const s = get();
      if (s.dailyUses <= 0) return;
      const lvl = Math.max(1, Math.min(Math.floor(level), maxDailyLevel(s.progress.highestFloorReached)));
      const stats = currentStats(s.player, s.equipped);
      set({
        dailyUses: s.dailyUses - 1,
        runMode: "daily",
        modeLevel: lvl,
        modeFloor: dailyLevelFloor(lvl),
        modeStep: 0,
        modeTotal: 1,
        modeCleared: null,
        player: { ...s.player, hp: stats.maxHp }, // 入場で全回復
        activeBuffs: [],
        winStreak: 0,
      });
      get().startBattle();
      flushSave(); // 入場(回数消費)とモード状態を即時・原子的に保存（リロードで回数だけ失わない）
    },

    enterBossRush: () => {
      const s = get();
      if (s.rushUses <= 0) return;
      const stats = currentStats(s.player, s.equipped);
      set({
        rushUses: s.rushUses - 1,
        runMode: "rush",
        modeLevel: 0,
        modeFloor: rushBossFloor(s.progress.highestFloorReached, 0),
        modeStep: 0,
        modeTotal: RUSH_BOSS_COUNT,
        modeCleared: null,
        player: { ...s.player, hp: stats.maxHp },
        activeBuffs: [],
        winStreak: 0,
      });
      get().startBattle();
      flushSave(); // 同上
    },

    exitMode: () => {
      set({
        runMode: "normal",
        modeCleared: null,
        modeStep: 0,
        modeTotal: 0,
        modeFloor: 0,
        modeLevel: 0,
        battleState: "idle",
        lastResult: null,
      });
      persist();
    },

    forgeStarWithMaterials: (loc, index) => {
      const s = get();
      const item = loc === "inv" ? s.inventory[index] : s.equipped[loc];
      if (!item || item.noModifier) return;
      const cur = item.modTier ?? 0;
      const cost = starMaterialCost(cur);
      if (!canAffordMats(s.materials, cost)) return;
      const forged = getItemInstance(item.id, item.affixId, cur + 1, item.quality, item.forgeLevel, item.forgeStreak);
      if (!forged) return;
      const partial = placeForged(s, loc, index, forged);
      set({ ...partial, materials: spendMats(s.materials, cost) });
      persist();
    },

    markDailyStorySeen: () => {
      if (get().seenDailyStory) return;
      set({ seenDailyStory: true });
      persist();
    },
    markDailyHelpSeen: () => {
      if (get().seenDailyHelp) return;
      set({ seenDailyHelp: true });
      persist();
    },

    // ===== ログインボーナス / デイリー・ウィークリークエスト =====
    refreshQuests: () => {
      const s = get();
      const patch: Partial<GameState> = {};
      const dk = todayKey();
      if (s.dailyQuestKey !== dk) {
        patch.dailyQuestKey = dk;
        patch.dailyQuestBase = questCounters(s.progress);
        patch.dailyClaimed = [];
      }
      const wk = weekKey();
      if (s.weeklyQuestKey !== wk) {
        patch.weeklyQuestKey = wk;
        patch.weeklyQuestBase = questCounters(s.progress);
        patch.weeklyClaimed = [];
      }
      if (Object.keys(patch).length > 0) {
        set(patch);
        persist();
      }
    },

    claimLogin: () => {
      const s = get();
      if (s.loginClaimKey === todayKey()) return; // 本日受領済み
      const reward = LOGIN_CALENDAR[s.loginDay % LOGIN_CYCLE];
      set({
        ...rewardPatch(s, reward),
        loginDay: (s.loginDay + 1) % LOGIN_CYCLE,
        loginClaimKey: todayKey(),
      });
      persist();
    },

    rollDailyDice: (faceId) => {
      const s = get();
      if (s.dailyDiceKey === todayKey()) return; // 本日は振り済み
      const { value, reward } = spinDailyDice(faceId, todayKey());
      set({
        ...rewardPatch(s, reward),
        dailyDiceKey: todayKey(),
        dailyDiceFace: faceId,
        dailyDiceValue: value,
      });
      persist();
    },

    submitFireworksScore: (score) => {
      const s = get();
      const best = Math.round(score);
      if (!Number.isFinite(score) || best <= s.progress.summerBest) return;
      // 自己ベストは Progress に保存（称号判定 summer_hanabi が参照）。
      set({ progress: { ...s.progress, summerBest: best } });
      // 8000到達で限定称号「夏の花火師」を解放（souls 付与込み）。
      applyTitleGrants();
      persist();
    },

    claimSummerReward: (id) => {
      const s = get();
      const m = SUMMER_MILESTONES.find((x) => x.id === id);
      if (!m) return;
      if (s.progress.summerBest < m.minScore || s.summerClaimed.includes(id)) return;
      set({
        ...rewardPatch(s, m.reward),
        summerClaimed: [...s.summerClaimed, id],
      });
      persist();
    },

    claimQuest: (scope, id) => {
      const s = get();
      const defs = scope === "daily" ? DAILY_QUESTS : WEEKLY_QUESTS;
      const q = defs.find((d) => d.id === id);
      if (!q) return;
      const base = scope === "daily" ? s.dailyQuestBase : s.weeklyQuestBase;
      const claimed = scope === "daily" ? s.dailyClaimed : s.weeklyClaimed;
      if (claimed.includes(id)) return;
      if (!questDone(questCounters(s.progress), base, q)) return;
      const patch = rewardPatch(s, q.reward);
      if (scope === "daily") patch.dailyClaimed = [...claimed, id];
      else patch.weeklyClaimed = [...claimed, id];
      set(patch);
      persist();
    },

    toggleFavorite: (key: string) => {
      const state = get();
      const favorites = state.favorites.includes(key)
        ? state.favorites.filter((k) => k !== key)
        : [...state.favorites, key];
      set({ favorites });
      persist();
    },

    markHelpSeen: () => {
      if (get().seenHelp) return;
      set({ seenHelp: true });
      persist();
    },

    dismissAchievement: () => {
      const q = get().achievementQueue;
      if (q.length === 0) return;
      set({ achievementQueue: q.slice(1) });
    },

    setTitle: (id: string) => {
      set({ titleId: id });
      persist();
    },

    setDifficulty: (id: Difficulty) => {
      set({ difficulty: id });
      persist();
    },

    setHandedness: (h: "right" | "left") => {
      set({ handedness: h });
      persist();
    },

    setTapToBuy: (v: boolean) => {
      set({ tapToBuy: v });
      persist();
    },

    setStartFloor: (floor: number) => {
      const state = get();
      // Only floor 1, one floor past a reached 50-mark checkpoint (51,101…), or
      // the 1000F final boss once it has been reached (retry the last battle).
      const allowed =
        floor === 1 ||
        (floor > 1 && (floor - 1) % 50 === 0 && floor - 1 <= state.checkpoint) ||
        (floor === FINAL_FLOOR && state.progress.highestFloorReached >= FINAL_FLOOR);
      if (!allowed) return;
      // Start a chosen run at full HP.
      const maxHp = currentStats(state.player, state.equipped).maxHp;
      set({
        currentFloor: floor,
        startFloorPref: floor,
        player: { ...state.player, hp: maxHp },
        battleState: "idle",
        currentEnemy: null,
        lastResult: null,
        // 通常プレイ開始時はモード状態を必ずクリア（リロードで残ったモードに乗っ取られない）。
        runMode: "normal",
        modeCleared: null,
      });
      persist();
    },

    clearWorldClear: () => set({ worldCleared: null }),

    newGamePlus: () => {
      const state = get();
      const starter = getItemById("rusty_sword");
      const equipped: EquippedItems = { ...emptyEquipped(), weapon: starter };
      // 強くてニューゲーム: lose level/gear/gold, keep souls & artifacts, gain the
      // ending title and the one-and-only 神機マキナ.
      set({
        player: createPlayer(),
        equipped,
        inventory: [makeMakina()],
        currentFloor: 1,
        currentEnemy: null,
        battleState: "idle",
        battleLog: [],
        lastResult: null,
        activeBuffs: [],
        gachaPoints: 0,
        lastPull: null,
        classId: DEFAULT_CLASS_ID,
        winStreak: 0,
        checkpoint: 1,
        startFloorPref: 1,
        worldCleared: null,
        pendingEnding: false,
        endlessMessage: null,
        titleId: ENDING_TITLE_ID,
        progress: {
          ...state.progress,
          endingSeen: true,
          ngPlus: state.progress.ngPlus + 1,
          makinaGranted: true,
          rebirths: state.progress.rebirths + 1,
        },
        diceFaces: buildFaces(equipped, DEFAULT_CLASS_ID),
      });
      persist();
    },

    declineEnding: () => {
      const state = get();
      set({
        pendingEnding: false,
        progress: { ...state.progress, endingSeen: true },
      });
      persist();
      get().enterCurrentFloor();
    },

    clearEndlessMessage: () => set({ endlessMessage: null }),

    currentRankingEntry: (playerName: string) => {
      const s = get();
      const score = EQUIP_SLOTS.reduce((sum, slot) => {
        const it = s.equipped[slot];
        return it
          ? sum + it.attack * 2 + it.defense * 1.5 + it.maxHp * 0.3 + it.rerollModifier * 20 + (it.modTier ?? 0) * 10
          : sum;
      }, 0);
      const hi = s.progress.highestFloorReached;
      return {
        playerName,
        highestFloorReached: hi,
        cleared1000: hi >= FINAL_FLOOR || s.progress.endingSeen,
        endlessAbyssFloor: hi > FINAL_FLOOR ? hi - FINAL_FLOOR : 0,
        job: s.classId,
        difficulty: s.difficulty,
        title: s.titleId,
        hasShinkiMakina: s.progress.makinaGranted,
        equippedWeaponName: s.equipped.weapon?.name ?? "",
        equipmentScore: Math.round(score),
        totalPlayTime: s.progress.playSeconds,
        updatedAt: new Date().toISOString(),
      };
    },

    grantEchoRewards: (r, item) => {
      const s = get();
      const capped = item
        ? capInventory([...s.inventory, item], s.favorites)
        : { kept: s.inventory, material: 0 };
      set({
        player: { ...s.player, gold: s.player.gold + r.gold },
        gachaPoints: s.gachaPoints + r.gachaPoints + capped.material,
        inventory: capped.kept,
        progress: { ...s.progress, rankPoints: s.progress.rankPoints + r.rankPoints, echoWins: s.progress.echoWins + 1 },
      });
      applyTitleGrants();
      persist();
    },

    exportSaveData: () => {
      flushSave(); // ensure any pending debounced write is on disk first
      return exportSave();
    },

    importSaveData: (code: string) => {
      cancelSave(); // don't let a pending write clobber the imported save
      if (!importSave(code)) return false;
      const loaded = loadGame();
      if (!loaded) return false;
      applyLoaded(loaded);
      return true;
    },

    scrapItem: (itemIndex: number) => {
      const state = get();
      const item = state.inventory[itemIndex];
      if (!item) return;
      // Locked items and the unique 神機マキナ can't be scrapped.
      if (item.noSell || state.favorites.includes(itemKey(item))) return;
      const gain = SCRAP_VALUE[item.rarity];
      set({
        inventory: state.inventory.filter((_, i) => i !== itemIndex),
        gachaPoints: state.gachaPoints + gain,
      });
      persist();
    },

    scrapBulk: (maxRarity: Rarity) => {
      const state = get();
      const threshold = rarityRank[maxRarity];
      let gain = 0;
      const kept: Equipment[] = [];
      for (const item of state.inventory) {
        const locked = item.noSell || state.favorites.includes(itemKey(item));
        if (!locked && rarityRank[item.rarity] <= threshold) {
          gain += SCRAP_VALUE[item.rarity];
        } else {
          kept.push(item);
        }
      }
      if (gain === 0) return;
      set({ inventory: kept, gachaPoints: state.gachaPoints + gain });
      persist();
    },

    sellLegendaries: () => {
      const state = get();
      // Bulk-DISMANTLE legendaries into material (gachaPoints), not gold — this
      // feeds the gacha/forge economy. (Equipped items aren't in inventory.)
      const PER = 24; // material per legendary (> single scrap of 12)
      let gain = 0;
      const kept: Equipment[] = [];
      for (const item of state.inventory) {
        const locked = item.noSell || state.favorites.includes(itemKey(item));
        if (item.rarity === "legendary" && !locked) {
          gain += PER;
        } else {
          kept.push(item);
        }
      }
      if (gain === 0) return;
      set({ inventory: kept, gachaPoints: state.gachaPoints + gain });
      persist();
    },

    pullGacha: () => {
      const state = get();
      if (state.gachaPoints < GACHA_COST) return;
      const pulled = pullGachaItem();
      set({
        gachaPoints: state.gachaPoints - GACHA_COST,
        inventory: [...state.inventory, pulled],
        lastPull: pulled,
        progress: { ...state.progress, discoveredItems: discover(state.progress.discoveredItems, pulled.id) },
      });
      persist();
    },

    pullPremium: () => {
      const state = get();
      if (state.gachaPoints < PREMIUM_COST) return;
      // ★ modifier is capped by the deepest floor reached — no future-tier gear.
      const pulled = pullPremiumItem(modTierForFloor(state.progress.highestFloorReached));
      set({
        gachaPoints: state.gachaPoints - PREMIUM_COST,
        inventory: [...state.inventory, pulled],
        lastPull: pulled,
        progress: { ...state.progress, discoveredItems: discover(state.progress.discoveredItems, pulled.id) },
      });
      persist();
    },

    pullTargeted: (slot: EquipmentSlot) => {
      const state = get();
      if (slot === "emblem") return; // 紋章は3000階+ボス限定ドロップ。ガチャ対象外。
      if (state.gachaPoints < TARGETED_COST) return;
      // Reference = the player's current best for this slot, so the pull lands
      // around (±) their owned power instead of a random low roll.
      let refTier = 0;
      let refMod = 0;
      const consider = (it: Equipment | null) => {
        if (!it || it.slot !== slot) return;
        const t = estimateTier(it);
        if (t > refTier) refTier = t;
        refMod = Math.max(refMod, it.modTier ?? 0);
      };
      consider(state.equipped[slot]);
      for (const it of state.inventory) consider(it);
      const pulled = pullTargetedItem(slot, refTier, refMod);
      set({
        gachaPoints: state.gachaPoints - TARGETED_COST,
        inventory: [...state.inventory, pulled],
        lastPull: pulled,
        progress: { ...state.progress, discoveredItems: discover(state.progress.discoveredItems, pulled.id) },
      });
      persist();
    },

    clearLastPull: () => set({ lastPull: null }),

    casinoSettle: (goldDelta: number, prize?: Equipment | null) => {
      const state = get();
      const gold = Math.max(0, state.player.gold + goldDelta);
      const progress = prize
        ? {
            ...state.progress,
            jackpots: state.progress.jackpots + 1,
            discoveredItems: discover(state.progress.discoveredItems, prize.id),
          }
        : state.progress;
      set({
        player: { ...state.player, gold },
        inventory: prize ? [...state.inventory, { ...prize }] : state.inventory,
        progress,
      });
      persist();
    },

    buyCoins: (coinAmount: number) => {
      const s = get();
      const amt = Math.max(0, Math.floor(coinAmount));
      // 価格は所持カジノコインに応じて上昇(買いづらく)。
      const cost = coinBuyCost(amt, s.coins);
      if (amt <= 0 || s.player.gold < cost) return;
      set({ player: { ...s.player, gold: s.player.gold - cost }, coins: s.coins + amt });
      persist();
    },

    addCoins: (delta: number) => {
      const s = get();
      set({ coins: Math.max(0, s.coins + Math.round(delta)) });
      persist();
    },

    addHiCoins: (delta: number) => {
      const s = get();
      set({ hiCoins: Math.max(0, s.hiCoins + Math.round(delta)) });
      persist();
    },

    kingPlay: () => {
      const s = get();
      if (s.coins < KING_BET) return null;
      // 天井つき: 小当たりなしで KING_SMALL_CEILING 回まわすと小当たり確定。
      const { result: r, nextPity } = kingSpinWithPity(s.kingPity);
      set({
        coins: Math.max(0, s.coins - KING_BET + r.coins),
        hiCoins: s.hiCoins + r.hi,
        kingPity: nextPity,
        // カジノ王は独立台。通常スロットのダイスラッシュ(共有 atGames)とは連動させない。
      });
      persist();
      return r;
    },

    kingBuyLegend: (slot: EquipmentSlot): Equipment | null => {
      const state = get();
      if (state.hiCoins < LEGEND_PIECE_HI) return null;
      // バランス壊れ＝所持装備を大きく上回る高ティア＋高★で付与。
      let refTier = 0;
      let refMod = 0;
      const consider = (it: Equipment | null) => {
        if (!it) return;
        refTier = Math.max(refTier, estimateTier(it));
        refMod = Math.max(refMod, it.modTier ?? 0);
      };
      for (const sl of EQUIP_SLOTS) consider(state.equipped[sl]);
      for (const it of state.inventory) consider(it);
      const tier = Math.max(refTier, 80) + 20;
      const piece = applyModifier(genSetItem("legendgambler", slot, tier), Math.max(refMod, 10));
      const capped = capInventory([...state.inventory, piece], state.favorites);
      set({
        hiCoins: state.hiCoins - LEGEND_PIECE_HI,
        inventory: capped.kept,
        gachaPoints: state.gachaPoints + capped.material,
        lastPull: piece,
        progress: { ...state.progress, discoveredItems: discover(state.progress.discoveredItems, piece.id) },
      });
      persist();
      return piece;
    },

    slotSpin: (): SlotSpinResult | null => {
      const state = get();
      // 6時間の設定シャッフルを跨いだら、台の天井/ゾーン/カウンタをリセット。
      const bucket = settingBucket();
      const reset = bucket !== state.slotBucket;
      const cur = {
        spins: reset ? 0 : state.slotSpins,
        zone: reset ? 0 : state.slotZone,
        at: reset ? 0 : state.atGames,
        total: reset ? 0 : state.slotTotal,
        big: reset ? 0 : state.slotBig,
        reg: reset ? 0 : state.slotReg,
        maxHamari: reset ? 0 : state.slotMaxHamari,
        hits: reset ? [] : state.slotHits,
      };

      // ---- ダイスラッシュ(AT) free spin ----
      if (cur.at > 0) {
        const pay = atSpinPayout();
        const add = atRensho();
        // 安全弁: 万一の発散を防ぐためAT残りに上限。
        const remaining = Math.min(2000, cur.at - 1 + add);
        const coins = state.coins + pay;
        // AT終了時は連チャンゾーン(高確)へ → ストック機的な連チャンの波。
        const slotZone = remaining <= 0 ? ZONE_SPINS : cur.zone;
        set({
          coins,
          atGames: remaining,
          slotZone,
          slotBucket: bucket,
          slotTotal: cur.total + 1,
          slotSpins: cur.spins,
          slotBig: cur.big,
          slotReg: cur.reg,
          slotMaxHamari: cur.maxHamari,
          slotHits: cur.hits,
          progress: { ...state.progress, totalCoinsWon: state.progress.totalCoinsWon + Math.max(0, pay) },
        });
        applyTitleGrants();
        persist();
        return {
          outcome: "at",
          reels: add > 0 ? [7, 7, 7] : [2, 2, 2],
          reach: null,
          payout: pay,
          free: true,
          replayNext: false,
          prize: null,
          atRemaining: remaining,
          atStart: false,
          atAdd: add,
          coins,
        };
      }

      const free = state.slotReplay;
      const cost = free ? 0 : SLOT_BET;
      if (state.coins < cost) return null;

      // 設定差(隠し設定1-6) × 連チャンゾーン でBIG/REG確率を底上げ。
      // イベントデー中は実効設定(上書き後)で抽選する。
      const setting = effectiveSlotSettings(bucket)[state.slotMachine] ?? 1;
      const inZone = cur.zone > 0;
      const bonusMult = settingMult(setting) * (inZone ? ZONE_MULT : 1);
      // 天井: ハマるほど近づく救済(設定で天井Gが変動)。到達でBIG確定。
      const atCeiling = cur.spins + 1 >= ceilingSpins(setting);
      const outcome: SlotOutcome = atCeiling ? "big" : drawSlotOutcome(bonusMult);
      const win = outcome === "big" || outcome === "reg";
      const reach: ReachDef | null = win
        ? pickReach(true)
        : outcome === "miss" && Math.random() < GASE_REACH_CHANCE
          ? pickReach(false)
          : null;
      const reels = slotReels(outcome, reach !== null);
      let inventory = state.inventory;
      let gachaPoints = state.gachaPoints;
      let progress = state.progress;
      let prize: Equipment | null = null;
      let atGames = 0;

      const payout = slotPayout(outcome);
      if (outcome === "big") {
        atGames = AT_GAMES;
        progress = { ...progress, jackpots: progress.jackpots + 1 };
        if (Math.random() < 0.5) {
          // 賞品の3割は「現在階に見合う手続き生成武器」(残りは従来のカジノ専用賞品)。
          // 深層ほど強い武器が当たり、序盤の入れ食いにはならない形でプールに混ぜる。
          prize =
            Math.random() < 0.3
              ? applyModifier(rollGenDrop(state.currentFloor, 0, "weapon"), modTierForFloor(state.currentFloor))
              : randomCasinoPrize();
          const capped = capInventory([...inventory, { ...prize }], state.favorites);
          inventory = capped.kept;
          gachaPoints += capped.material;
          progress = { ...progress, discoveredItems: discover(progress.discoveredItems, prize.id) };
        }
      }

      progress = {
        ...progress,
        slotBigCount: progress.slotBigCount + (outcome === "big" ? 1 : 0),
        totalCoinsWon: progress.totalCoinsWon + Math.max(0, payout),
      };
      const coins = state.coins - cost + payout;
      // データカウンタ: 総回転/BIG/REG/最大ハマり/直近の当たり履歴。
      const reachedHamari = outcome === "big" ? cur.spins : cur.spins + 1;
      const isBonus = outcome === "big" || outcome === "reg";
      const now = Date.now();
      // スピン毎に呼ばれるため spread+filter の二重確保を避け、1ループで構築する。
      const slotHits: number[] = [];
      for (const t of cur.hits) {
        if (now - t <= HIT_WINDOW_MS) slotHits.push(t);
      }
      if (isBonus) slotHits.push(now); // BIG/REGの当たりを履歴に追加(now-now=0で必ず窓内)
      set({
        coins,
        slotReplay: outcome === "replay",
        atGames,
        // 天井カウンタ: BIGで0リセット、それ以外は+1。連チャンゾーンは消化で減る。
        slotSpins: outcome === "big" ? 0 : cur.spins + 1,
        slotZone: outcome === "big" ? 0 : Math.max(0, cur.zone - 1),
        slotBucket: bucket,
        slotTotal: cur.total + 1,
        slotBig: cur.big + (outcome === "big" ? 1 : 0),
        slotReg: cur.reg + (outcome === "reg" ? 1 : 0),
        slotMaxHamari: Math.max(cur.maxHamari, reachedHamari),
        slotHits,
        inventory,
        gachaPoints,
        progress,
      });
      applyTitleGrants();
      persist();
      return {
        outcome,
        reels,
        reach,
        payout,
        free,
        replayNext: outcome === "replay",
        prize,
        atRemaining: atGames,
        atStart: outcome === "big",
        atAdd: 0,
        coins,
      };
    },

    selectMachine: (i: number) => {
      const idx = Math.max(0, Math.min(MACHINE_COUNT - 1, Math.floor(i)));
      // 別の台に座る = データカウンタ・天井・ゾーンをリセット(新しい台)。
      set({
        slotMachine: idx,
        slotSpins: 0,
        slotZone: 0,
        atGames: 0,
        slotBucket: settingBucket(),
        slotTotal: 0,
        slotBig: 0,
        slotReg: 0,
        slotMaxHamari: 0,
        slotHits: [],
      });
      persist();
    },

    daiPan: () => {
      const s = get();
      const count = s.daiPanCount + 1;
      // 累計の台パン回数(称号用)はリセットされない別カウンタ。
      const progress = { ...s.progress, daipanCount: s.progress.daipanCount + 1 };
      if (count >= DAIPAN_LIMIT) {
        // 出禁: ボスを BAN_BOSSES 体倒すまでカジノ入店禁止。
        set({ daiPanCount: 0, casinoBan: s.progress.bossKills + BAN_BOSSES, progress: { ...progress, casinoBanned: true } });
        applyTitleGrants();
        persist();
        return { count, banned: true };
      }
      set({ daiPanCount: count, progress });
      applyTitleGrants();
      return { count, banned: false };
    },

    coinBuySetWeapon: (setKey: string): Equipment | null => {
      const state = get();
      if (state.coins < SET_WEAPON_COIN) return null;
      if (!getSetDef(setKey)) return null;
      // Tier scales to the player's best owned gear, so it's relevant late-game.
      let refTier = 0;
      let refMod = 0;
      const consider = (it: Equipment | null) => {
        if (!it) return;
        refTier = Math.max(refTier, estimateTier(it));
        refMod = Math.max(refMod, it.modTier ?? 0);
      };
      for (const slot of EQUIP_SLOTS) consider(state.equipped[slot]);
      for (const it of state.inventory) consider(it);
      // 武器に限らず、防具・アクセも含めたランダム部位を交換（セット完成を狙える）。
      const slot = SLOT_LIST[Math.floor(Math.random() * SLOT_LIST.length)];
      const piece = applyModifier(genSetItem(setKey, slot, Math.max(refTier, 30)), refMod);
      const capped = capInventory([...state.inventory, piece], state.favorites);
      set({
        coins: state.coins - SET_WEAPON_COIN,
        inventory: capped.kept,
        gachaPoints: state.gachaPoints + capped.material,
        lastPull: piece,
        progress: { ...state.progress, discoveredItems: discover(state.progress.discoveredItems, piece.id) },
      });
      persist();
      return piece;
    },

    coinBuySignatureWeapon: (): Equipment | null => {
      const state = get();
      // コイン不足ガード(2000枚)。
      if (state.coins < SIGNATURE_WEAPON_COIN) return null;
      if (SIGNATURE_WEAPON_IDS.length === 0) return null;
      // 固有武器をランダムに1つ抽選。固有武器は通常アイテム(id持ち)なのでセーブ互換に影響なし。
      const id = SIGNATURE_WEAPON_IDS[Math.floor(Math.random() * SIGNATURE_WEAPON_IDS.length)];
      const base = getItemById(id);
      if (!base) return null;
      // 終盤でも腐らないよう、所持ベスト装備の★modを引き継いで付与。
      let refMod = 0;
      const consider = (it: Equipment | null) => {
        if (it) refMod = Math.max(refMod, it.modTier ?? 0);
      };
      for (const slot of EQUIP_SLOTS) consider(state.equipped[slot]);
      for (const it of state.inventory) consider(it);
      const weapon = refMod > 0 && !base.noModifier ? applyModifier(base, refMod) : base;
      const capped = capInventory([...state.inventory, weapon], state.favorites);
      set({
        coins: state.coins - SIGNATURE_WEAPON_COIN,
        inventory: capped.kept,
        gachaPoints: state.gachaPoints + capped.material,
        lastPull: weapon,
        progress: { ...state.progress, discoveredItems: discover(state.progress.discoveredItems, weapon.id) },
      });
      persist();
      return weapon;
    },

    coinBuySouls: (n: number) => {
      const state = get();
      const amt = Math.max(1, Math.floor(n));
      const cost = amt * SOULS_COIN;
      if (state.coins < cost) return;
      set({ coins: state.coins - cost, souls: state.souls + amt });
      persist();
    },

    upgradeArtifact: (id: ArtifactId) => {
      const state = get();
      const level = state.artifacts[id] ?? 0;
      const cost = artifactUpgradeCost(id, level);
      if (state.souls < cost) return;
      const artifacts: ArtifactLevels = { ...state.artifacts, [id]: level + 1 };
      // Recompute hp cap against the new artifact maxHp (don't auto-heal).
      set({ souls: state.souls - cost, artifacts });
      persist();
    },

    offerToAltar: () => {
      const state = get();
      const cost = soulAltarCost(state.soulAltar);
      if (state.souls < cost) return;
      set({ souls: state.souls - cost, soulAltar: state.soulAltar + 1 });
      persist();
    },

    rebirth: () => {
      const state = get();
      const starter = getItemById("rusty_sword");
      const equipped: EquippedItems = { ...emptyEquipped(), weapon: starter };
      // Reset the run; keep only souls (+gain) and permanent artifacts.
      set({
        player: createPlayer(),
        equipped,
        inventory: [],
        currentFloor: 1,
        currentEnemy: null,
        battleState: "idle",
        battleLog: [],
        lastResult: null,
        activeBuffs: [],
        gachaPoints: 0,
        lastPull: null,
        // モード状態もクリア。
        runMode: "normal",
        modeCleared: null,
        // Souls are no longer earned by rebirthing — only by reaching NEW depth
        // milestones (#17). Rebirth is purely a run reset now.
        souls: state.souls,
        // Rebirth returns you to the base class.
        classId: DEFAULT_CLASS_ID,
        winStreak: 0,
        checkpoint: 1,
        startFloorPref: 1,
        worldCleared: null,
        // Lifetime fields (highestFloorReached / claimed milestones) survive rebirth.
        progress: {
          ...state.progress,
          rebirths: state.progress.rebirths + 1,
          maxFloor: Math.max(state.progress.maxFloor, state.currentFloor),
        },
        diceFaces: buildFaces(equipped, DEFAULT_CLASS_ID),
      });
      persist();
    },

    changeClass: (id: ClassId) => {
      const state = get();
      // 転職は初期クラス中・敗北直後・セーブポイント階のいずれか。
      if (!canChangeClassNow(state)) return;
      if (id === state.classId) return;
      if (!isClassUnlocked(id, state.progress)) return;
      const cls = getClass(id);

      // Unequip gear the new class can't use; return it to the inventory.
      const equipped: EquippedItems = { ...state.equipped };
      const inventory = [...state.inventory];
      for (const slot of EQUIP_SLOTS) {
        const it = equipped[slot];
        if (it && !canEquip(it, id)) {
          inventory.push(it);
          equipped[slot] = null;
        }
      }

      const diceFaces = buildFaces(equipped, id);
      // Re-clamp hp to the new class's max (don't auto-heal).
      const stats = computeStats(state.player, equipped, state.activeBuffs, {
        attack: artifactBonus(state.artifacts).attack + cls.statMods.attack,
        defense: artifactBonus(state.artifacts).defense + cls.statMods.defense,
        maxHp: artifactBonus(state.artifacts).maxHp + cls.statMods.maxHp,
        reroll: artifactBonus(state.artifacts).reroll + cls.statMods.reroll,
      });
      set({
        classId: id,
        equipped,
        inventory,
        diceFaces,
        player: { ...state.player, hp: Math.min(state.player.hp, stats.maxHp) },
        progress: { ...state.progress, classesUsed: addUnique(state.progress.classesUsed, id) },
      });
      applyTitleGrants();
      persist();
    },
  };

  // ===== victory / defeat helpers (closures over set/get not needed) =====

  type Snapshot = Partial<GameState>;

  function finishVictory(
    state: GameState,
    log: BattleLogEntry[],
    playerHp: number,
    enemy: Enemy,
    battle: { tookDamage: boolean; maxHit: number } = { tookDamage: true, maxHit: 0 },
  ): Snapshot {
    // 日替わりダンジョン / ボスラッシュは別処理（通常フロア進行・チェックポイント・節目に触れない）。
    if (state.runMode !== "normal") return finishModeVictory(state, log, playerHp, enemy);
    // Win-streak bonus: +10% gold/exp per consecutive win after the first, capped +50%.
    const winStreak = state.winStreak + 1;
    const streakBonusPct = Math.min(50, (winStreak - 1) * 10);
    const streakMult = 1 + streakBonusPct / 100;
    // Difficulty reward multiplier + daily gold bonus + 魂の祭壇(ゴールド/EXP取得アップ)。
    const rewardMult = getDifficulty(state.difficulty).rewardMult;
    const daily = getDailyBonus();
    const altarMult = soulAltarMult(state.soulAltar);
    const goldMult = streakMult * rewardMult * altarMult * (daily.stat === "gold" ? 1 + daily.value / 100 : 1);
    const expGained = Math.round(enemy.exp * streakMult * rewardMult * altarMult);
    const goldGained = Math.round(enemy.gold * goldMult);

    // Difficulty governs how many drops and how big the upswing (#6). Each drop
    // is anchored to the floor's ★ modifier tier (#8), with a chance to roll higher.
    const diff = getDifficulty(state.difficulty);
    const dropCount = diff.dropMin + Math.floor(Math.random() * (diff.dropMax - diff.dropMin + 1));
    // Smart drops: with 6 slots, bias procedural drops toward the weakest/empty
    // slot so gearing up doesn't take 2× as long as it did with 3 slots.
    const weakSlot = weakestSlot(state.equipped);
    // 伝説賭博セット6pc: ドロップ率2倍＋レアドロップ比率増加。
    const setEff = computeSetEffects(state.equipped, state.classId, state.currentFloor);
    const lootEnemy =
      setEff.dropRateMult !== 1
        ? { ...enemy, dropRate: Math.min(1, enemy.dropRate * setEff.dropRateMult) }
        : enemy;
    const rareBonus = diff.rareBonus + setEff.rareDropBonus;
    const drops: Equipment[] = [];
    for (let i = 0; i < dropCount; i++) {
      const hint = Math.random() < 0.6 ? weakSlot : undefined;
      let d = rollLoot(lootEnemy, state.currentFloor, rareBonus, hint, state.classId);
      if (!d) continue;
      let modTier = rollDropModTier(state.currentFloor, diff.upswing);
      // 【隠し】伝説賭博セット完成(6pc)の裏効果: 一定確率で「強化ドロップ」化
      // (その階層の★最大+1・変動ステを最大級アフィックスに)。UIには表示しない。
      if (setEff.dropUpgradeChance > 0 && Math.random() < setEff.dropUpgradeChance) {
        modTier = Math.max(modTier, modTierForFloor(state.currentFloor) + 1);
        if (!d.affixId) d = applyMaxAffix(d);
      }
      drops.push(applyModifier(d, modTier));
    }
    const drop = drops[0] ?? null;

    let leveledPlayer: Player = { ...state.player, hp: playerHp, gold: state.player.gold + goldGained };
    const { player: leveled, leveledUp } = applyExp(leveledPlayer, expGained);
    leveledPlayer = leveled;

    let finalLog = pushLogs(log, [
      { text: `EXP +${expGained} / ゴールド +${goldGained}`, tone: "good" },
    ]);
    if (streakBonusPct > 0) {
      finalLog = pushLogs(finalLog, [
        { text: `🔥 ${winStreak}連勝！ ボーナス +${streakBonusPct}%`, tone: "good" },
      ]);
    }
    if (leveledUp) {
      finalLog = pushLogs(finalLog, [
        { text: `レベルアップ！ Lv${leveledPlayer.level} (全回復)`, tone: "good" },
      ]);
    }
    const inventory = drops.length ? [...state.inventory, ...drops] : state.inventory;
    for (const d of drops) {
      finalLog = pushLogs(finalLog, [{ text: `${d.name} を手に入れた！`, tone: "good" }]);
    }

    // Consumables are auto-used the instant they drop.
    // Count down existing buffs (active this battle) before adding any new one.
    let buffs = tickBuffs(state.activeBuffs);
    const consumable: Consumable | null = rollConsumable(enemy);
    let healed = 0;
    if (consumable) {
      if (consumable.kind === "heal") {
        const maxHp = currentStats(leveledPlayer, state.equipped, buffs).maxHp;
        const before = leveledPlayer.hp;
        leveledPlayer = { ...leveledPlayer, hp: Math.min(maxHp, before + consumable.value) };
        healed = leveledPlayer.hp - before;
        finalLog = pushLogs(finalLog, [
          { text: `${consumable.name} を使用！ HP +${healed}`, tone: "good" },
        ]);
      } else {
        buffs = [...buffs, { kind: consumable.kind, value: consumable.value, battlesLeft: consumable.battles }];
        finalLog = pushLogs(finalLog, [
          { text: `${consumable.name} を使用！ ${consumable.description}`, tone: "good" },
        ]);
      }
    }

    const result: BattleResult = {
      victory: true,
      expGained,
      goldGained,
      goldLost: 0,
      drop,
      dropCount: drops.length,
      leveledUp,
      consumable,
      healed,
      winStreak,
      streakBonusPct,
    };

    const newFloor = state.currentFloor + 1;
    // A checkpoint is earned by CLEARING a 50-floor boss (not merely reaching it).
    // Clearing floor 50 unlocks restart/start from 51, etc. The death-restart
    // anchor (startFloorPref) auto-advances to just past the cleared checkpoint.
    let checkpoint = state.checkpoint;
    let startFloorPref = state.startFloorPref;
    if (state.currentFloor % 50 === 0 && state.currentFloor > checkpoint) {
      checkpoint = state.currentFloor;
      startFloorPref = checkpoint + 1;
      finalLog = pushLogs(finalLog, [
        { text: `💾 セーブポイント到達！(${checkpoint}階クリア) 以降の敗北は${checkpoint + 1}階から再開`, tone: "good" },
      ]);
    }
    // 最終決戦のセーブポイント: 1000階(ラスボス)に到達したら、敗北しても1000階から
    // 再挑戦できるよう復帰アンカーを1000に固定する。
    if (newFloor === FINAL_FLOOR) {
      startFloorPref = FINAL_FLOOR;
      finalLog = pushLogs(finalLog, [
        { text: `💾 最終セーブポイント！ ラスボス 機神デウス＝エクス＝マキナ。敗北しても1000階から再挑戦できる。`, tone: "good" },
      ]);
    }
    let discoveredItems = state.progress.discoveredItems;
    for (const d of drops) discoveredItems = discover(discoveredItems, d.id);

    // 大ボス(50階区切り)からは「覇者の刻印」が0.5%で落ちる（★アップ素材。ボスラッシュでも同様）。
    let materials = state.materials;
    if (enemy.isBoss && state.currentFloor % 50 === 0 && Math.random() < RARE_SIGIL_RATE) {
      materials = { ...materials, sigil: materials.sigil + 1 };
      finalLog = pushLogs(finalLog, [{ text: "✨ 覇者の刻印 を発見！(★アップ素材)", tone: "good" }]);
    }

    // ===== Rebirth-point milestones & floor achievements (#15, #17) =====
    // Souls/material are awarded ONLY for reaching a NEW highest floor — never
    // from death, checkpoint farming, or re-clearing old floors.
    const prevHighest = state.progress.highestFloorReached;
    const newHighest = Math.max(prevHighest, newFloor);
    let souls = state.souls;
    let bonusGacha = 0;
    let claimedMilestones = state.progress.claimedMilestones;
    let claimedFloorAchievements = state.progress.claimedFloorAchievements;
    if (newHighest > prevHighest) {
      for (const mf of crossedMilestones(prevHighest, newHighest)) {
        if (claimedMilestones.includes(mf)) continue;
        const pts = milestoneSouls(mf);
        if (pts > 0) {
          souls += pts;
          claimedMilestones = [...claimedMilestones, mf];
          finalLog = pushLogs(finalLog, [
            { text: `🔮 ${mf}階 初到達！ 転生ポイント +${pts}`, tone: "good" },
          ]);
        }
      }
      for (const fa of newlyEarnedFloorAchievements(newHighest, claimedFloorAchievements)) {
        bonusGacha += fa.gachaPoints;
        if (fa.souls) souls += fa.souls;
        claimedFloorAchievements = [...claimedFloorAchievements, fa.id];
        finalLog = pushLogs(finalLog, [
          { text: `🏅 実績「${fa.name}」 素材+${fa.gachaPoints}${fa.souls ? ` / 転生+${fa.souls}` : ""}`, tone: "good" },
        ]);
      }
    }

    // ===== Ending / Endless Abyss narrative =====
    let endingPending = false;
    let endlessMessage: string | null = null;
    let makinaGranted = state.progress.makinaGranted;
    let claimedEndlessMessages = state.progress.claimedEndlessMessages;
    let invWithGrants = inventory;

    // 1000F: DEUS EX MACHINA defeated → trigger the one-time, unskippable ending.
    if (state.currentFloor === FINAL_FLOOR && !state.progress.endingSeen) {
      endingPending = true;
    }
    // Endless story lines (NO route), shown once when first crossing each floor.
    if (newHighest > prevHighest) {
      for (const m of ENDLESS_MESSAGES) {
        if (m.floor <= prevHighest || m.floor > newHighest) continue;
        if (claimedEndlessMessages.includes(m.floor)) continue;
        endlessMessage = m.text;
        claimedEndlessMessages = [...claimedEndlessMessages, m.floor];
        if (m.floor === MAKINA_FLOOR && !makinaGranted) {
          invWithGrants = [...invWithGrants, makeMakina()];
          makinaGranted = true;
          finalLog = pushLogs(finalLog, [{ text: "神機マキナ を授かった。", tone: "good" }]);
        }
      }
    }

    const noDmg = !battle.tookDamage;
    let progress: Progress = {
      ...state.progress,
      kills: state.progress.kills + 1,
      bossKills: state.progress.bossKills + (enemy.isBoss ? 1 : 0),
      maxFloor: Math.max(state.progress.maxFloor, newFloor),
      maxStreak: Math.max(state.progress.maxStreak, winStreak),
      defeatedEnemies: addUnique(state.progress.defeatedEnemies, enemy.templateId),
      discoveredItems,
      highestFloorReached: newHighest,
      claimedMilestones,
      claimedFloorAchievements,
      makinaGranted,
      claimedEndlessMessages,
      playSeconds: state.progress.playSeconds + 8,
      // Title tracking: biggest single hit, no-damage clears / boss kills.
      maxSingleHit: Math.max(state.progress.maxSingleHit, battle.maxHit),
      perfectClears: state.progress.perfectClears + (noDmg ? 1 : 0),
      noDamageBossKills: state.progress.noDamageBossKills + (enemy.isBoss && noDmg ? 1 : 0),
    };

    // Unlock + soul-reward any newly satisfied titles (one-time via claimedTitles).
    let soulsAfter = souls;
    {
      const granted = grantTitles(progress, soulsAfter);
      progress = granted.progress;
      soulsAfter = granted.souls;
      if (granted.unlocked.length > 0) {
        finalLog = pushLogs(
          finalLog,
          granted.unlocked.map((id) => ({
            text: `🎖️ 称号「${getTitle(id).name}」獲得！ 転生ポイント+${titleSouls(getTitle(id))}`,
            tone: "good" as const,
          })),
        );
      }
    }

    // World-clear overlay when a 100th-floor world boss falls — except the 1000F
    // boss, where the ending takes over instead (#3).
    const worldCleared =
      isWorldBossFloor(state.currentFloor) && state.currentFloor !== FINAL_FLOOR
        ? state.currentFloor
        : null;

    // Keep the inventory from ballooning (deep-floor freeze fix): auto-dismantle
    // the weakest non-locked overflow into material.
    const capped = capInventory(invWithGrants, state.favorites);
    if (capped.material > 0) {
      finalLog = pushLogs(finalLog, [
        { text: `📦 所持上限(${MAX_INVENTORY})到達: 弱い装備を自動分解 素材+${capped.material}`, tone: "neutral" },
      ]);
    }

    return {
      player: leveledPlayer,
      inventory: capped.kept,
      currentEnemy: enemy,
      currentFloor: newFloor,
      battleState: "won",
      battleLog: finalLog,
      lastResult: result,
      activeBuffs: buffs,
      winStreak,
      progress,
      checkpoint,
      startFloorPref,
      souls: soulsAfter,
      gachaPoints: state.gachaPoints + bonusGacha + capped.material,
      materials,
      worldCleared,
      pendingEnding: endingPending,
      endlessMessage,
    };
  }

  function finishDefeat(
    state: GameState,
    log: BattleLogEntry[],
    enemy: Enemy,
    enemyHp: number,
  ): Snapshot {
    if (state.runMode !== "normal") return finishModeDefeat(state, log, enemy, enemyHp);
    // Softer, predictable penalty: reached-floor × 100 gold, but never the whole
    // purse (cap at 90% of current gold) and never below zero (#5).
    const penalty = state.currentFloor * 100;
    const maxLoss = Math.floor(state.player.gold * 0.9);
    const goldLost = Math.max(0, Math.min(penalty, maxLoss));
    // Restart from the checkpoint at FULL HP.
    const restartMaxHp = currentStats(state.player, state.equipped).maxHp;
    const player: Player = {
      ...state.player,
      hp: restartMaxHp,
      gold: state.player.gold - goldLost,
    };

    const result: BattleResult = {
      victory: false,
      expGained: 0,
      goldGained: 0,
      goldLost,
      drop: null,
      leveledUp: false,
      consumable: null,
      healed: 0,
      winStreak: 0,
      streakBonusPct: 0,
    };

    // Restart at the run's chosen start floor (auto-advances to the cleared
    // checkpoint+1, or whatever the player picked in the title pulldown).
    const restart = state.startFloorPref >= 1 ? state.startFloorPref : 1;
    const finalLog = pushLogs(log, [
      { text: `力尽きた… ゴールド -${goldLost}`, tone: "bad" },
      {
        text: restart > 1 ? `セーブポイント(${restart}階)から再開する。` : "ダンジョンの最初に戻される。",
        tone: "bad",
      },
    ]);

    return {
      player,
      currentEnemy: { ...enemy, hp: Math.max(0, enemyHp) },
      currentFloor: restart,
      battleState: "lost",
      battleLog: finalLog,
      lastResult: result,
      // Temporary buffs and the win streak don't survive a run reset.
      activeBuffs: [],
      winStreak: 0,
    };
  }

  // ===== 日替わりダンジョン / ボスラッシュの勝敗処理（通常進行に干渉しない）=====
  function finishModeVictory(
    state: GameState,
    log: BattleLogEntry[],
    playerHp: number,
    enemy: Enemy,
  ): Snapshot {
    const isRush = state.runMode === "rush";
    const diff = getDifficulty(state.difficulty);
    const altarMult = soulAltarMult(state.soulAltar);
    // ボスラッシュは深く潜るほど報酬倍率が伸びる（上げ損防止）。
    const rushMult = isRush ? rushRewardMult(state.progress.highestFloorReached) : 1;
    const rewardMult = rushMult * diff.rewardMult * altarMult;
    const expGained = Math.round(enemy.exp * rewardMult);
    const goldGained = Math.round(enemy.gold * rewardMult);

    let leveledPlayer: Player = { ...state.player, hp: playerHp, gold: state.player.gold + goldGained };
    const { player: leveled, leveledUp } = applyExp(leveledPlayer, expGained);
    leveledPlayer = leveled;

    const rushMultLabel = Number.isInteger(rushMult) ? `${rushMult}` : rushMult.toFixed(1);
    let finalLog = pushLogs(log, [
      { text: `EXP +${expGained} / ゴールド +${goldGained}${isRush ? `（×${rushMultLabel}）` : ""}`, tone: "good" },
    ]);
    if (leveledUp) {
      finalLog = pushLogs(finalLog, [{ text: `レベルアップ！ Lv${leveledPlayer.level} (全回復)`, tone: "good" }]);
    }

    // ---- ドロップ ----
    let materials = state.materials;
    let inventory = state.inventory;
    let discoveredItems = state.progress.discoveredItems;
    if (state.runMode === "daily") {
      const md = dailyDrop(state.modeLevel);
      materials = { ...materials, shard: materials.shard + md.shard, core: materials.core + md.core };
      finalLog = pushLogs(finalLog, [{ text: `🔹欠片 +${md.shard} / 🔶核 +${md.core}`, tone: "good" }]);
    } else {
      // ボスラッシュ: 通常装備を周回ドロップ。
      const drops: Equipment[] = [];
      const count = diff.dropMin + Math.floor(Math.random() * (diff.dropMax - diff.dropMin + 1));
      for (let i = 0; i < count; i++) {
        const d = rollLoot(enemy, state.modeFloor, diff.rareBonus, undefined, state.classId);
        if (d) drops.push(applyModifier(d, rollDropModTier(state.modeFloor, diff.upswing)));
      }
      if (drops.length) {
        inventory = [...inventory, ...drops];
        for (const d of drops) {
          discoveredItems = discover(discoveredItems, d.id);
          finalLog = pushLogs(finalLog, [{ text: `${d.name} を手に入れた！`, tone: "good" }]);
        }
      }
    }
    // 大ボス0.5%: 覇者の刻印。
    if (Math.random() < RARE_SIGIL_RATE) {
      materials = { ...materials, sigil: materials.sigil + 1 };
      finalLog = pushLogs(finalLog, [{ text: "✨ 覇者の刻印 を発見！", tone: "good" }]);
    }

    const capped = capInventory(inventory, state.favorites);
    const nextStep = state.modeStep + 1;
    const done = nextStep >= state.modeTotal;

    if (!done) {
      // ボスラッシュ次戦へ（回復なし・オーバーレイなしで連戦）。
      const nextFloor = rushBossFloor(state.progress.highestFloorReached, nextStep);
      const stats = currentStats(leveledPlayer, state.equipped);
      const nextEnemy = generateEnemy(nextFloor, difficultyScale(state.difficulty));
      const opening = rollWithLuckInfo();
      finalLog = pushLogs(finalLog, [
        { text: `ボスラッシュ ${nextStep + 1}/${state.modeTotal} — ${nextEnemy.name} が現れた！`, tone: "neutral" },
      ]);
      return {
        player: leveledPlayer,
        inventory: capped.kept,
        currentEnemy: nextEnemy,
        battleState: "player",
        diceFaces: refreshFaces(),
        diceValue: opening.value,
        twoDice: opening.pair,
        rerollsLeft: stats.rerolls,
        lastResult: null,
        playerStatuses: [],
        playerStunTurns: 0,
        battleTookDamage: false,
        battleMaxHit: 0,
        battleLog: finalLog,
        materials,
        modeFloor: nextFloor,
        modeStep: nextStep,
        gachaPoints: state.gachaPoints + capped.material,
        progress: { ...state.progress, discoveredItems },
      };
    }

    // ---- モード踏破 ----
    const dailyCleared =
      state.runMode === "daily" && !state.dailyCleared.includes(state.modeLevel)
        ? [...state.dailyCleared, state.modeLevel]
        : state.dailyCleared;
    finalLog = pushLogs(finalLog, [
      { text: isRush ? "🏆 ボスラッシュ踏破！" : `🏆 日替Lv${state.modeLevel} 踏破！`, tone: "good" },
    ]);
    const result: BattleResult = {
      victory: true,
      expGained,
      goldGained,
      goldLost: 0,
      drop: null,
      dropCount: 0,
      leveledUp,
      consumable: null,
      healed: 0,
      winStreak: 0,
      streakBonusPct: 0,
    };
    return {
      player: leveledPlayer,
      inventory: capped.kept,
      currentEnemy: { ...enemy, hp: 0 },
      battleState: "won",
      battleLog: finalLog,
      lastResult: result,
      materials,
      dailyCleared,
      modeCleared: state.runMode === "rush" ? "rush" : "daily",
      modeStep: nextStep,
      gachaPoints: state.gachaPoints + capped.material,
      progress: { ...state.progress, discoveredItems, dungeonClears: state.progress.dungeonClears + 1 },
    };
  }

  function finishModeDefeat(
    state: GameState,
    log: BattleLogEntry[],
    enemy: Enemy,
    enemyHp: number,
  ): Snapshot {
    // モードは optional コンテンツ。ゴールド没収はせず、HP全回復で通常に戻す（回数は消費済み）。
    const restartMaxHp = currentStats(state.player, state.equipped).maxHp;
    const player: Player = { ...state.player, hp: restartMaxHp };
    const finalLog = pushLogs(log, [{ text: "力尽きた… (回数は消費済み)", tone: "bad" }]);
    const result: BattleResult = {
      victory: false,
      expGained: 0,
      goldGained: 0,
      goldLost: 0,
      drop: null,
      dropCount: 0,
      leveledUp: false,
      consumable: null,
      healed: 0,
      winStreak: 0,
      streakBonusPct: 0,
    };
    return {
      player,
      currentEnemy: { ...enemy, hp: Math.max(0, enemyHp) },
      battleState: "lost",
      battleLog: finalLog,
      lastResult: result,
      activeBuffs: [],
      modeCleared: state.runMode === "rush" ? "rush" : "daily",
    };
  }

  // Callers always set() the snapshot into state BEFORE calling this, so the
  // debounced persist() (which reads get()) already captures it.
  function persistFromSnapshot(_snap: Snapshot): void {
    persist();
  }

  // Flush any pending save when the tab is hidden/closed so progress isn't lost.
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flushSave);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) flushSave();
    });
  }
});
