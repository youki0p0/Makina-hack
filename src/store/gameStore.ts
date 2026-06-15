"use client";

import { create } from "zustand";
import { defaultProgress } from "@/data/achievements";
import { getDifficulty, normalizeDifficulty, type Difficulty } from "@/data/difficulty";
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
import { getItemById } from "@/data/items";
import { applyModifier, rollDropModTier } from "@/data/modifiers";
import { jobAttackMult } from "@/data/jobBalance";
import {
  crossedMilestones,
  milestoneSouls,
  newlyEarnedFloorAchievements,
} from "@/data/milestones";
import { isWorldBossFloor, FINAL_FLOOR } from "@/data/worlds";
import {
  addStatus,
  applyExp,
  computeStats,
  EQUIP_SLOTS,
  expForLevel,
  luckFloor,
  resolveBossTurn,
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
import { generateShopStock, isShopFloor, type ShopEntry } from "@/lib/shop";
import { clearSave, exportSave, importSave, loadGame, saveGame, type LoadedState } from "@/lib/save";
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
  return { weapon: null, armor: null, accessory: null };
}

/** Add an id to a list if not already present (set-union). */
function addUnique(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
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

interface GameState {
  hydrated: boolean;
  player: Player;
  equipped: EquippedItems;
  inventory: Equipment[];
  currentEnemy: Enemy | null;
  currentFloor: number;
  battleState: BattleState;
  diceValue: DiceValue;
  diceFaces: DiceFace[];
  rerollsLeft: number;
  battleLog: BattleLogEntry[];
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
  /** Rebirth currency. */
  souls: number;
  /** Permanent artifact levels (persist across rebirths). */
  artifacts: ArtifactLevels;
  /** Current character class. */
  classId: ClassId;
  /** Consecutive-win count. */
  winStreak: number;
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
  leaveShop: () => void;

  // equipment
  equipItem: (itemIndex: number) => void;
  unequipItem: (slot: keyof EquippedItems) => void;

  // misc
  toggleFavorite: (key: string) => void;
  markHelpSeen: () => void;
  setTitle: (id: string) => void;
  setDifficulty: (id: Difficulty) => void;
  setHandedness: (h: "right" | "left") => void;
  setTapToBuy: (v: boolean) => void;
  /** Choose which floor to (re)start a run from: 1 or a reached checkpoint. */
  setStartFloor: (floor: number) => void;
  /** Dismiss the world-clear overlay. */
  clearWorldClear: () => void;
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

  // artifacts / rebirth
  upgradeArtifact: (id: ArtifactId) => void;
  rebirth: () => void;

  // class change (転職)
  changeClass: (id: ClassId) => void;
}

let logCounter = 0;

export const useGameStore = create<GameState>((set, get) => {
  function persist(): void {
    const s = get();
    saveGame({
      player: s.player,
      equipped: s.equipped,
      inventory: s.inventory,
      currentFloor: s.currentFloor,
      gachaPoints: s.gachaPoints,
      souls: s.souls,
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
    const { equipped } = get();
    const cls = getClass(get().classId);
    // Class rewrites apply before equipment so gear can still override faces.
    return applyEquipmentModifiers([
      { name: cls.name, diceModifiers: cls.diceModifiers },
      equipped.weapon,
      equipped.armor,
      equipped.accessory,
    ]);
  }

  /** Roll the die, honoring any active "luck" buff (minimum value). */
  function rollWithLuck(): DiceValue {
    const min = luckFloor(get().activeBuffs);
    return Math.max(rollDice(), min) as DiceValue;
  }

  /** Sum of artifacts, the current class's mods, and the daily bonus. */
  function passiveBonus(): StatBonus {
    const a = artifactBonus(get().artifacts);
    const c = classStatBonus(get().classId);
    const daily = getDailyBonus();
    const d: StatBonus = {
      attack: daily.stat === "attack" ? daily.value : 0,
      defense: daily.stat === "defense" ? daily.value : 0,
      maxHp: 0,
      reroll: daily.stat === "reroll" ? daily.value : 0,
    };
    return {
      attack: a.attack + c.attack + d.attack,
      defense: a.defense + c.defense + d.defense,
      maxHp: a.maxHp + c.maxHp + d.maxHp,
      reroll: a.reroll + c.reroll + d.reroll,
    };
  }

  /** Compute stats including artifact bonuses, active class, and job balance. */
  function currentStats(
    player: Player,
    equipped: EquippedItems,
    buffs: ActiveBuff[] = [],
  ): ComputedStats {
    const base = computeStats(player, equipped, buffs, passiveBonus());
    // Job balance: per-class attack multiplier (centralized in jobBalance.ts).
    return { ...base, attack: Math.round(base.attack * jobAttackMult(get().classId)) };
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
    diceFaces: [],
    rerollsLeft: 1,
    battleLog: [],
    lastResult: null,
    activeBuffs: [],
    playerStatuses: [],
    playerStunTurns: 0,
    gachaPoints: 0,
    lastPull: null,
    souls: 0,
    artifacts: defaultArtifactLevels(),
    classId: DEFAULT_CLASS_ID,
    winStreak: 0,
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
    shopStock: [],

    stats: () => currentStats(get().player, get().equipped, get().activeBuffs),
    currentFace: () => faceByValue(get().diceFaces, get().diceValue),
    rebirthGain: () => computeRebirthGain(get().currentFloor, get().player.level),
    // 転職できるのは倒れた後だけ（初期クラスのうちは常に可）。
    canChangeClass: () =>
      get().classId === DEFAULT_CLASS_ID || get().battleState === "lost",

    hydrate: () => {
      if (get().hydrated) return;
      const loaded = loadGame();
      if (loaded) {
        applyLoaded(loaded);
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
      const enemy = generateEnemy(currentFloor, getDifficulty(get().difficulty).enemyMult);
      // Heal a little between fights so runs are survivable but not free.
      const healed = Math.min(stats.maxHp, player.hp + Math.round(stats.maxHp * 0.15));
      set({
        currentEnemy: enemy,
        battleState: "player",
        diceFaces: refreshFaces(),
        diceValue: rollWithLuck(),
        rerollsLeft: stats.rerolls,
        lastResult: null,
        player: { ...player, hp: healed },
        // Player statuses are battle-scoped — clear at the start of each fight.
        playerStatuses: [],
        playerStunTurns: 0,
        battleLog: pushLogs([], [
          { text: `${currentFloor}階 — ${enemy.name} が現れた！`, tone: "neutral" },
        ]),
      });
    },

    reroll: () => {
      const { rerollsLeft, battleState } = get();
      if (battleState !== "player" || rerollsLeft <= 0) return;
      set({
        diceValue: rollWithLuck(),
        rerollsLeft: rerollsLeft - 1,
      });
    },

    confirm: () => {
      const state = get();
      if (state.battleState !== "player" || !state.currentEnemy) return;

      const stats = currentStats(state.player, state.equipped, state.activeBuffs);
      const face = faceByValue(state.diceFaces, state.diceValue);
      const enemy = state.currentEnemy;

      const action = resolvePlayerAction(face, stats, enemy);

      let enemyHp = enemy.hp - action.enemyDamage;
      let playerHp = state.player.hp - action.selfDamage + action.heal;
      playerHp = Math.min(stats.maxHp, playerHp);

      let log = pushLogs(
        state.battleLog,
        action.logs.map((text) => ({ text, tone: "good" as const })),
      );

      // 1) Enemy defeated by the player's attack?
      if (enemyHp <= 0) {
        const updatedEnemy = { ...enemy, hp: 0 };
        log = pushLogs(log, [{ text: `${enemy.name} を倒した！`, tone: "good" }]);
        const result = finishVictory(state, log, playerHp, updatedEnemy);
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
        const result = finishVictory(state, log, playerHp, updatedEnemy);
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

      if (stunTurns > 0) {
        stunTurns -= 1;
        log = pushLogs(log, [{ text: `${enemy.name} はスタンして動けない！`, tone: "good" }]);
      } else if (enemy.isBoss) {
        // Boss-specific gimmick turn (enrage + charge cycle + heal).
        const turn = resolveBossTurn({ ...enemy, enraged, weakenAmount, weakenTurns }, stats, action.guard);
        if (turn.enemyHeal > 0) enemyHp = Math.min(enemy.maxHp, enemyHp + turn.enemyHeal);
        charging = turn.charging;
        chargeCounter = turn.chargeCounter;
        decayWeaken();
        playerHp -= turn.playerDamage;
        log = pushLogs(log, turn.logs.map((text) => ({ text, tone: "bad" as const })));

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
        playerHp -= turn.playerDamage;
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

      // Next turn: fresh roll + rerolls.
      set({
        currentEnemy: { ...enemy, hp: enemyHp, statuses, stunTurns, bonusDefense, bonusDefenseTurns, weakenAmount, weakenTurns, enraged, charging, chargeCounter },
        player: { ...state.player, hp: playerHp },
        diceValue: rollWithLuck(),
        rerollsLeft: nextRerolls,
        playerStatuses,
        playerStunTurns: nextStun,
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
        set({
          player: { ...state.player, gold: goldAfter },
          inventory: [...state.inventory, { ...entry.equipment }],
          shopStock: markSold(),
          progress: { ...state.progress, discoveredItems: addUnique(state.progress.discoveredItems, entry.equipment.id) },
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

      set({
        equipped,
        inventory,
        player,
        diceFaces: applyEquipmentModifiers([equipped.weapon, equipped.armor, equipped.accessory]),
      });
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
        diceFaces: applyEquipmentModifiers([equipped.weapon, equipped.armor, equipped.accessory]),
      });
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
      // Only floor 1, or one floor past a reached 50-mark checkpoint (51,101…).
      const allowed =
        floor === 1 ||
        (floor > 1 && (floor - 1) % 50 === 0 && floor - 1 <= state.checkpoint);
      if (!allowed) return;
      set({
        currentFloor: floor,
        startFloorPref: floor,
        battleState: "idle",
        currentEnemy: null,
        lastResult: null,
      });
      persist();
    },

    clearWorldClear: () => set({ worldCleared: null }),

    exportSaveData: () => exportSave(),

    importSaveData: (code: string) => {
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
      // Favorited items are locked from scrapping.
      if (state.favorites.includes(itemKey(item))) return;
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
        const locked = state.favorites.includes(itemKey(item));
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
      // Equipped items are not in the inventory list, so they're naturally safe.
      const SELL_GOLD = 500; // per legendary
      let gold = 0;
      const kept: Equipment[] = [];
      for (const item of state.inventory) {
        const locked = state.favorites.includes(itemKey(item));
        if (item.rarity === "legendary" && !locked) {
          gold += SELL_GOLD;
        } else {
          kept.push(item);
        }
      }
      if (gold === 0) return;
      set({ inventory: kept, player: { ...state.player, gold: state.player.gold + gold } });
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
        progress: { ...state.progress, discoveredItems: addUnique(state.progress.discoveredItems, pulled.id) },
      });
      persist();
    },

    pullPremium: () => {
      const state = get();
      if (state.gachaPoints < PREMIUM_COST) return;
      const pulled = pullPremiumItem();
      set({
        gachaPoints: state.gachaPoints - PREMIUM_COST,
        inventory: [...state.inventory, pulled],
        lastPull: pulled,
        progress: { ...state.progress, discoveredItems: addUnique(state.progress.discoveredItems, pulled.id) },
      });
      persist();
    },

    pullTargeted: (slot: EquipmentSlot) => {
      const state = get();
      if (state.gachaPoints < TARGETED_COST) return;
      const pulled = pullTargetedItem(slot);
      set({
        gachaPoints: state.gachaPoints - TARGETED_COST,
        inventory: [...state.inventory, pulled],
        lastPull: pulled,
        progress: { ...state.progress, discoveredItems: addUnique(state.progress.discoveredItems, pulled.id) },
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
            discoveredItems: addUnique(state.progress.discoveredItems, prize.id),
          }
        : state.progress;
      set({
        player: { ...state.player, gold },
        inventory: prize ? [...state.inventory, { ...prize }] : state.inventory,
        progress,
      });
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
        diceFaces: applyEquipmentModifiers([equipped.weapon, equipped.armor, equipped.accessory]),
      });
      persist();
    },

    changeClass: (id: ClassId) => {
      const state = get();
      // 転職は倒れた後だけ（初期クラスのうちは自由）。
      if (!(state.classId === DEFAULT_CLASS_ID || state.battleState === "lost")) return;
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

      const diceFaces = applyEquipmentModifiers([
        { name: cls.name, diceModifiers: cls.diceModifiers },
        equipped.weapon,
        equipped.armor,
        equipped.accessory,
      ]);
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
      });
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
    const drops: Equipment[] = [];
    for (let i = 0; i < dropCount; i++) {
      const d = rollLoot(enemy, state.currentFloor, diff.rareBonus);
      if (d) drops.push(applyModifier(d, rollDropModTier(state.currentFloor, diff.upswing)));
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
      leveledUp,
      consumable,
      healed,
      winStreak,
      streakBonusPct,
    };

    const newFloor = state.currentFloor + 1;
    // Reaching a 50-floor mark sets a checkpoint to restart from on defeat.
    let checkpoint = state.checkpoint;
    if (newFloor % 50 === 0 && newFloor > checkpoint) {
      checkpoint = newFloor;
      finalLog = pushLogs(finalLog, [
        { text: `💾 セーブポイント到達！(${newFloor}階クリア) 以降の敗北は${newFloor + 1}階から再開`, tone: "good" },
      ]);
    }
    let discoveredItems = state.progress.discoveredItems;
    for (const d of drops) discoveredItems = addUnique(discoveredItems, d.id);

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

    const progress: Progress = {
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
    };

    // World-clear overlay when a 100th-floor world boss falls (#3).
    const worldCleared = isWorldBossFloor(state.currentFloor) ? state.currentFloor : null;

    return {
      player: leveledPlayer,
      inventory,
      currentEnemy: enemy,
      currentFloor: newFloor,
      battleState: "won",
      battleLog: finalLog,
      lastResult: result,
      activeBuffs: buffs,
      winStreak,
      progress,
      checkpoint,
      souls,
      gachaPoints: state.gachaPoints + bonusGacha,
      worldCleared,
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
    const player: Player = {
      ...state.player,
      hp: 0,
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

    // Restart just AFTER the cleared checkpoint boss (e.g. 50 -> 51).
    const restart = state.checkpoint > 1 ? state.checkpoint + 1 : 1;
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

  function persistFromSnapshot(snap: Snapshot): void {
    const s = get();
    saveGame({
      player: snap.player ?? s.player,
      equipped: snap.equipped ?? s.equipped,
      inventory: snap.inventory ?? s.inventory,
      currentFloor: snap.currentFloor ?? s.currentFloor,
      gachaPoints: snap.gachaPoints ?? s.gachaPoints,
      souls: snap.souls ?? s.souls,
      artifacts: snap.artifacts ?? s.artifacts,
      classId: snap.classId ?? s.classId,
      winStreak: snap.winStreak ?? s.winStreak,
      progress: snap.progress ?? s.progress,
      favorites: snap.favorites ?? s.favorites,
      seenHelp: snap.seenHelp ?? s.seenHelp,
      titleId: snap.titleId ?? s.titleId,
      difficulty: snap.difficulty ?? s.difficulty,
      handedness: snap.handedness ?? s.handedness,
      checkpoint: snap.checkpoint ?? s.checkpoint,
      tapToBuy: snap.tapToBuy ?? s.tapToBuy,
      startFloorPref: snap.startFloorPref ?? s.startFloorPref,
    });
  }
});
