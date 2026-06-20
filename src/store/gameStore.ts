"use client";

import { create } from "zustand";
import { defaultProgress, newlyEarnedAchievements } from "@/data/achievements";
import { difficultyScale, getDifficulty, normalizeDifficulty, type Difficulty } from "@/data/difficulty";
import { getDailyBonus } from "@/lib/daily";
import {
  artifactBonus,
  artifactUpgradeCost,
  computeRebirthGain,
  defaultArtifactLevels,
} from "@/data/artifacts";
import {
  canEquip,
  classStatBonus,
  DEFAULT_CLASS_ID,
  getClass,
  isClassUnlocked,
} from "@/data/classes";
import { generateEnemy } from "@/data/enemies";
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
import { computeSetEffects, getSetDef } from "@/data/sets";
import { getTitle, titleSouls } from "@/data/titles";
import { grantTitles } from "@/lib/titleAward";
import { jobAttackMult } from "@/data/jobBalance";
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
  expForLevel,
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
import { applyEquipmentModifiers, rollDice } from "@/lib/dice";
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
  COIN_VALUE,
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
import { runDailyMaintenance } from "@/lib/maintenance";
import { kingSpinWithPity, KING_BET, LEGEND_PIECE_HI } from "@/lib/casinoKing";
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
  Enemy,
  Equipment,
  EquippedItems,
  EquipmentSlot,
  Player,
  Progress,
  Rarity,
} from "@/types/game";
import { faceByValue } from "@/data/diceFaces";

const LOG_LIMIT = 14;

/** 1000階(DEUS EX MACHINA)を踏破済みか（到達 or エンディング視聴）。 */
function isCleared1000(progress: Progress): boolean {
  return progress.highestFloorReached >= FINAL_FLOOR || progress.endingSeen;
}

/** セーブポイントの階層（1, 51, 101…）。ここでは転職を常に許可する。 */
function isSavePointFloor(floor: number): boolean {
  return floor >= 1 && (floor - 1) % 50 === 0;
}

/** 転職可能か（初期クラス中・敗北直後・セーブポイント階のいずれか）。 */
function canChangeClassNow(state: {
  classId: ClassId;
  battleState: BattleState;
  currentFloor: number;
}): boolean {
  return (
    state.classId === DEFAULT_CLASS_ID ||
    state.battleState === "lost" ||
    isSavePointFloor(state.currentFloor)
  );
}

function createPlayer(): Player {
  return {
    level: 1,
    exp: 0,
    expToNext: expForLevel(1),
    maxHp: 50,
    hp: 50,
    baseAttack: 8,
    baseDefense: 2,
    gold: 0,
  };
}

function emptyEquipped(): EquippedItems {
  return {
    weapon: null,
    helm: null,
    armor: null,
    gloves: null,
    boots: null,
    accessory: null,
  };
}

/** Add an id to a list if not already present (set-union). */
function addUnique(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

/**
 * Record a *curated* item id for the collection (図鑑). Procedural gear
 * (`gen_*` / `setp_*`) is intentionally NOT tracked: the collection only counts
 * the finite curated registry, so storing infinite procedural ids just bloats the
 * save — at floor 700+ `discoveredItems` grew into thousands of entries, and
 * spreading/serializing it on every victory made the browser freeze and the save
 * slow to load. Skipping them keeps the array bounded to the curated set.
 */
function discover(list: string[], id: string): string[] {
  if (id.startsWith("gen_") || id.startsWith("setp_")) return list;
  return addUnique(list, id);
}

/**
 * Hard cap on inventory size. With infinite drops over hundreds of floors the
 * inventory would balloon and make every save/render freeze the browser. When
 * it overflows we auto-dismantle the WEAKEST non-locked items into material —
 * locked/favorited and 神機マキナ are never touched.
 */
const MAX_INVENTORY = 150;

function capInventory(
  inv: Equipment[],
  favorites: string[],
): { kept: Equipment[]; material: number } {
  if (inv.length <= MAX_INVENTORY) return { kept: inv, material: 0 };
  const score = (it: Equipment) =>
    it.attack * 2 + it.defense * 1.5 + it.maxHp * 0.4 + (it.modTier ?? 0) * 5 + (it.forgeLevel ?? 0) * 8;
  const locked: Equipment[] = [];
  const removable: Equipment[] = [];
  for (const it of inv) {
    if (it.noSell || favorites.includes(itemKey(it))) locked.push(it);
    else removable.push(it);
  }
  removable.sort((a, b) => score(a) - score(b)); // weakest first
  const toRemove = Math.max(0, locked.length + removable.length - MAX_INVENTORY);
  let material = 0;
  const kept = [...locked];
  removable.forEach((it, i) => {
    if (i < toRemove) material += SCRAP_VALUE[it.rarity];
    else kept.push(it);
  });
  return { kept, material };
}

/** The emptiest/weakest equipped slot (for biasing "smart drops"). */
function weakestSlot(eq: EquippedItems): EquipmentSlot {
  let worst: EquipmentSlot = EQUIP_SLOTS[0];
  let worstScore = Infinity;
  for (const slot of EQUIP_SLOTS) {
    const it = eq[slot];
    const score = it ? it.attack + it.defense + it.maxHp : -1;
    if (score < worstScore) {
      worstScore = score;
      worst = slot;
    }
  }
  return worst;
}

/** Sum status-resistance from equipped gear (clamped to 0.9). */
function equippedResist(eq: EquippedItems): { poison: number; stun: number } {
  let poison = 0;
  let stun = 0;
  for (const slot of EQUIP_SLOTS) {
    const it = eq[slot];
    if (!it) continue;
    poison += it.poisonResist ?? 0;
    stun += it.stunResist ?? 0;
  }
  return { poison: Math.min(0.9, poison), stun: Math.min(0.9, stun) };
}

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
  /** Casino coins (medals) for the slot machine. */
  coins: number;
  /** ハイコイン: カジノ王の一撃台でのみ稼ぐ上位通貨（伝説賭博セット交換用）。 */
  hiCoins: number;
  /** カジノ王の天井カウンタ: 一撃なしで回した回転数（KING_CEILINGで一撃確定）。 */
  kingPity: number;
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
  cashoutCoins: () => void;
  /** カジノコインを増減（甘ダイス発射/払い出し・BJ 用。0未満にはしない）。 */
  addCoins: (delta: number) => void;
  addHiCoins: (delta: number) => void;
  /** カジノ王の一撃台を1回プレイ（100コインBET）。結果を返す。 */
  kingPlay: () => { coins: number; hi: number; kind: string } | null;
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
      coins: s.coins,
      hiCoins: s.hiCoins,
      kingPity: s.kingPity,
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

  /** Build the dice table from class + all equipped slots + set bonuses. */
  function buildFaces(equipped: EquippedItems, classId: ClassId): DiceFace[] {
    const cls = getClass(classId);
    const setEff = computeSetEffects(equipped, classId);
    // Class first, then equipment (so gear overrides), then set rewrites last.
    return applyEquipmentModifiers([
      { name: cls.name, diceModifiers: cls.diceModifiers },
      ...EQUIP_SLOTS.map((s) => equipped[s]),
      { name: "セット", diceModifiers: setEff.diceModifiers },
    ]);
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
    if (computeSetEffects(get().equipped, get().classId).rollTwoDice) {
      const second = Math.max(rollDice(), min) as DiceValue;
      return { value: Math.max(first, second) as DiceValue, pair: [first, second] };
    }
    return { value: first, pair: null };
  }

  /** Sum of artifacts, the current class's mods, set bonuses, and the daily bonus. */
  function passiveBonus(): StatBonus {
    const a = artifactBonus(get().artifacts);
    const c = classStatBonus(get().classId);
    const set = computeSetEffects(get().equipped, get().classId).statBonus;
    const daily = getDailyBonus();
    const d: StatBonus = {
      attack: daily.stat === "attack" ? daily.value : 0,
      defense: daily.stat === "defense" ? daily.value : 0,
      maxHp: 0,
      reroll: daily.stat === "reroll" ? daily.value : 0,
    };
    return {
      attack: a.attack + c.attack + d.attack + set.attack,
      defense: a.defense + c.defense + d.defense + set.defense,
      maxHp: a.maxHp + c.maxHp + d.maxHp + set.maxHp,
      reroll: a.reroll + c.reroll + d.reroll + set.reroll,
    };
  }

  /** Compute stats including artifact bonuses, active class, and job balance. */
  function currentStats(
    player: Player,
    equipped: EquippedItems,
    buffs: ActiveBuff[] = [],
  ): ComputedStats {
    const base = computeStats(player, equipped, buffs, passiveBonus());
    // 固有共鳴/セット集中の最終倍率(★スケール後に乗算)。装備IDからLIVE計算され
    // セーブ非互換にならない。
    const setEff = computeSetEffects(equipped, get().classId);
    // Job balance: per-class attack multiplier (centralized in jobBalance.ts).
    const attack = Math.round(base.attack * jobAttackMult(get().classId) * (1 + setEff.attackPct));
    const maxHp = Math.round(base.maxHp * (1 + setEff.maxHpPct));
    return { ...base, attack, maxHp };
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
      coins: loaded.coins,
      hiCoins: loaded.hiCoins,
      kingPity: loaded.kingPity,
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
    coins: 0,
    hiCoins: 0,
    kingPity: 0,
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
      const { currentFloor, player } = get();
      const stats = currentStats(player, get().equipped, get().activeBuffs);
      const enemy = generateEnemy(currentFloor, difficultyScale(get().difficulty));
      // Heal a little between fights so runs are survivable but not free.
      const healed = Math.min(stats.maxHp, player.hp + Math.round(stats.maxHp * 0.15));
      const opening = rollWithLuckInfo();
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
          { text: `${currentFloor}階 — ${enemy.name} が現れた！`, tone: "neutral" },
        ]),
      });
    },

    reroll: () => {
      const state = get();
      const { rerollsLeft, battleState } = state;
      if (battleState !== "player" || rerollsLeft <= 0) return;
      // Oracle 2pc: reroll heals a little.
      const setEff = computeSetEffects(state.equipped, state.classId);
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
      const setEff = computeSetEffects(state.equipped, state.classId);
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

    cashoutCoins: () => {
      const s = get();
      if (s.coins <= 0) return;
      set({ player: { ...s.player, gold: s.player.gold + s.coins * COIN_VALUE }, coins: 0, slotReplay: false });
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
      // 天井つき: 一撃なしで KING_CEILING 回まわすと次の1回で一撃確定。
      const { result: r, nextPity } = kingSpinWithPity(s.kingPity);
      set({
        coins: Math.max(0, s.coins - KING_BET + r.coins),
        hiCoins: s.hiCoins + r.hi,
        kingPity: nextPity,
      });
      persist();
      return { coins: r.coins, hi: r.hi, kind: r.kind };
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
    // Win-streak bonus: +10% gold/exp per consecutive win after the first, capped +50%.
    const winStreak = state.winStreak + 1;
    const streakBonusPct = Math.min(50, (winStreak - 1) * 10);
    const streakMult = 1 + streakBonusPct / 100;
    // Difficulty reward multiplier + daily gold bonus.
    const rewardMult = getDifficulty(state.difficulty).rewardMult;
    const daily = getDailyBonus();
    const goldMult = streakMult * rewardMult * (daily.stat === "gold" ? 1 + daily.value / 100 : 1);
    const expGained = Math.round(enemy.exp * streakMult * rewardMult);
    const goldGained = Math.round(enemy.gold * goldMult);

    // Difficulty governs how many drops and how big the upswing (#6). Each drop
    // is anchored to the floor's ★ modifier tier (#8), with a chance to roll higher.
    const diff = getDifficulty(state.difficulty);
    const dropCount = diff.dropMin + Math.floor(Math.random() * (diff.dropMax - diff.dropMin + 1));
    // Smart drops: with 6 slots, bias procedural drops toward the weakest/empty
    // slot so gearing up doesn't take 2× as long as it did with 3 slots.
    const weakSlot = weakestSlot(state.equipped);
    // 伝説賭博セット2pc: ドロップの★ティアを底上げ。
    const dropTierBonus = computeSetEffects(state.equipped, state.classId).dropTierBonus;
    const drops: Equipment[] = [];
    for (let i = 0; i < dropCount; i++) {
      const hint = Math.random() < 0.6 ? weakSlot : undefined;
      const d = rollLoot(enemy, state.currentFloor, diff.rareBonus, hint);
      if (d) drops.push(applyModifier(d, rollDropModTier(state.currentFloor, diff.upswing) + dropTierBonus));
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
