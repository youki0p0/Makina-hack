"use client";

import { create } from "zustand";
import { defaultProgress } from "@/data/achievements";
import {
  artifactBonus,
  artifactUpgradeCost,
  computeRebirthGain,
  defaultArtifactLevels,
} from "@/data/artifacts";
import {
  classStatBonus,
  DEFAULT_CLASS_ID,
  getClass,
} from "@/data/classes";
import { generateEnemy } from "@/data/enemies";
import { getItemById } from "@/data/items";
import {
  addStatus,
  applyExp,
  computeStats,
  EQUIP_SLOTS,
  expForLevel,
  luckFloor,
  resolveEnemyTurn,
  resolvePlayerAction,
  tickBuffs,
  tickEnemyStatuses,
  WEAKEN_TURNS,
} from "@/lib/battle";
import { applyEquipmentModifiers, rollDice } from "@/lib/dice";
import { GACHA_COST, pullGachaItem, rollConsumable, rollLoot, SCRAP_VALUE } from "@/lib/loot";
import { generateShopStock, isShopFloor, type ShopEntry } from "@/lib/shop";
import { clearSave, loadGame, saveGame } from "@/lib/save";
import type {
  ActiveBuff,
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
  Player,
  Progress,
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

  // gacha
  scrapItem: (itemIndex: number) => void;
  pullGacha: () => void;
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

  /** Sum of permanent artifact bonuses and the current class's stat mods. */
  function passiveBonus(): StatBonus {
    const a = artifactBonus(get().artifacts);
    const c = classStatBonus(get().classId);
    return {
      attack: a.attack + c.attack,
      defense: a.defense + c.defense,
      maxHp: a.maxHp + c.maxHp,
      reroll: a.reroll + c.reroll,
    };
  }

  /** Compute stats including artifact bonuses and the active class. */
  function currentStats(
    player: Player,
    equipped: EquippedItems,
    buffs: ActiveBuff[] = [],
  ): ComputedStats {
    return computeStats(player, equipped, buffs, passiveBonus());
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
    gachaPoints: 0,
    lastPull: null,
    souls: 0,
    artifacts: defaultArtifactLevels(),
    classId: DEFAULT_CLASS_ID,
    winStreak: 0,
    progress: defaultProgress(),
    shopStock: [],

    stats: () => currentStats(get().player, get().equipped, get().activeBuffs),
    currentFace: () => faceByValue(get().diceFaces, get().diceValue),
    rebirthGain: () => computeRebirthGain(get().currentFloor, get().player.level),
    // 転職は3階ごと、または初期クラスのときに可能。
    canChangeClass: () =>
      get().classId === DEFAULT_CLASS_ID || get().currentFloor % 3 === 0,

    hydrate: () => {
      if (get().hydrated) return;
      const loaded = loadGame();
      if (loaded) {
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
          hydrated: true,
        });
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
        hydrated: true,
      });
      set({ diceFaces: refreshFaces() });
      persist();
    },

    startBattle: () => {
      const { currentFloor, player } = get();
      const stats = currentStats(player, get().equipped, get().activeBuffs);
      const enemy = generateEnemy(currentFloor);
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
      if (stunTurns > 0) {
        stunTurns -= 1;
        log = pushLogs(log, [{ text: `${enemy.name} はスタンして動けない！`, tone: "good" }]);
      } else {
        // Special ability or normal attack (weaken reduces its attack).
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
        if (weakenTurns > 0) {
          weakenTurns -= 1;
          if (weakenTurns === 0) weakenAmount = 0;
        }
        playerHp -= turn.playerDamage;
        log = pushLogs(log, turn.logs.map((text) => ({ text, tone: "bad" as const })));

        if (playerHp <= 0) {
          const lost = finishDefeat(
            { ...state, player: { ...state.player, hp: 0 } },
            log,
            { ...enemy, statuses, stunTurns, bonusDefense, bonusDefenseTurns, weakenAmount, weakenTurns },
            enemyHp,
          );
          set(lost);
          persistFromSnapshot(lost);
          return;
        }
      }

      // Next turn: fresh roll + rerolls.
      set({
        currentEnemy: { ...enemy, hp: enemyHp, statuses, stunTurns, bonusDefense, bonusDefenseTurns, weakenAmount, weakenTurns },
        player: { ...state.player, hp: playerHp },
        diceValue: rollWithLuck(),
        rerollsLeft: stats.rerolls,
        battleLog: log,
      });
    },

    enterCurrentFloor: () => {
      const floor = get().currentFloor;
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

    scrapItem: (itemIndex: number) => {
      const state = get();
      const item = state.inventory[itemIndex];
      if (!item) return;
      const gain = SCRAP_VALUE[item.rarity];
      set({
        inventory: state.inventory.filter((_, i) => i !== itemIndex),
        gachaPoints: state.gachaPoints + gain,
      });
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
      const gain = computeRebirthGain(state.currentFloor, state.player.level);
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
        souls: state.souls + gain,
        // Rebirth returns you to the base class.
        classId: DEFAULT_CLASS_ID,
        winStreak: 0,
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
      if (!(state.classId === DEFAULT_CLASS_ID || state.currentFloor % 3 === 0)) return;
      if (id === state.classId) return;
      const cls = getClass(id);
      const diceFaces = applyEquipmentModifiers([
        { name: cls.name, diceModifiers: cls.diceModifiers },
        state.equipped.weapon,
        state.equipped.armor,
        state.equipped.accessory,
      ]);
      // Re-clamp hp to the new class's max (don't auto-heal).
      const stats = computeStats(state.player, state.equipped, state.activeBuffs, {
        attack: artifactBonus(state.artifacts).attack + cls.statMods.attack,
        defense: artifactBonus(state.artifacts).defense + cls.statMods.defense,
        maxHp: artifactBonus(state.artifacts).maxHp + cls.statMods.maxHp,
        reroll: artifactBonus(state.artifacts).reroll + cls.statMods.reroll,
      });
      set({
        classId: id,
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
    const mult = 1 + streakBonusPct / 100;
    const expGained = Math.round(enemy.exp * mult);
    const goldGained = Math.round(enemy.gold * mult);
    const drop = rollLoot(enemy, state.currentFloor);

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
    const inventory = drop ? [...state.inventory, drop] : state.inventory;
    if (drop) {
      finalLog = pushLogs(finalLog, [{ text: `${drop.name} を手に入れた！`, tone: "good" }]);
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
    const progress: Progress = {
      ...state.progress,
      kills: state.progress.kills + 1,
      bossKills: state.progress.bossKills + (enemy.isBoss ? 1 : 0),
      maxFloor: Math.max(state.progress.maxFloor, newFloor),
      maxStreak: Math.max(state.progress.maxStreak, winStreak),
      defeatedEnemies: addUnique(state.progress.defeatedEnemies, enemy.templateId),
      discoveredItems: drop
        ? addUnique(state.progress.discoveredItems, drop.id)
        : state.progress.discoveredItems,
    };

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
    };
  }

  function finishDefeat(
    state: GameState,
    log: BattleLogEntry[],
    enemy: Enemy,
    enemyHp: number,
  ): Snapshot {
    const goldLost = Math.round(state.player.gold * 0.3);
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

    const finalLog = pushLogs(log, [
      { text: `力尽きた… ゴールド -${goldLost}`, tone: "bad" },
      { text: "ダンジョンの最初に戻される。", tone: "bad" },
    ]);

    return {
      player,
      currentEnemy: { ...enemy, hp: Math.max(0, enemyHp) },
      currentFloor: 1,
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
    });
  }
});
