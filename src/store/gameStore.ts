"use client";

import { create } from "zustand";
import { generateEnemy } from "@/data/enemies";
import { getItemById } from "@/data/items";
import {
  addStatus,
  applyExp,
  computeStats,
  EQUIP_SLOTS,
  expForLevel,
  luckFloor,
  resolveEnemyAttack,
  resolvePlayerAction,
  tickBuffs,
  tickEnemyStatuses,
} from "@/lib/battle";
import { applyEquipmentModifiers, rollDice } from "@/lib/dice";
import { rollConsumable, rollLoot } from "@/lib/loot";
import { clearSave, loadGame, saveGame } from "@/lib/save";
import type {
  ActiveBuff,
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

  // selectors
  stats: () => ComputedStats;
  currentFace: () => DiceFace;

  // lifecycle
  hydrate: () => void;
  newGame: () => void;

  // battle
  startBattle: () => void;
  reroll: () => void;
  confirm: () => void;

  // equipment
  equipItem: (itemIndex: number) => void;
  unequipItem: (slot: keyof EquippedItems) => void;
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
    return applyEquipmentModifiers([
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

    stats: () => computeStats(get().player, get().equipped, get().activeBuffs),
    currentFace: () => faceByValue(get().diceFaces, get().diceValue),

    hydrate: () => {
      if (get().hydrated) return;
      const loaded = loadGame();
      if (loaded) {
        set({
          player: loaded.player,
          equipped: loaded.equipped,
          inventory: loaded.inventory,
          currentFloor: loaded.currentFloor,
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
        hydrated: true,
      });
      set({ diceFaces: refreshFaces() });
      persist();
    },

    startBattle: () => {
      const { currentFloor, player } = get();
      const stats = computeStats(player, get().equipped, get().activeBuffs);
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

      const stats = computeStats(state.player, state.equipped, state.activeBuffs);
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

      // 6) Enemy retaliates.
      const enemyAtk = resolveEnemyAttack(enemy, stats, action.guard);
      playerHp -= enemyAtk.damage;
      log = pushLogs(log, [{ text: enemyAtk.log, tone: "bad" }]);

      if (playerHp <= 0) {
        const lost = finishDefeat(
          { ...state, player: { ...state.player, hp: 0 } },
          log,
          { ...enemy, statuses },
          enemyHp,
        );
        set(lost);
        persistFromSnapshot(lost);
        return;
      }

      // Next turn: fresh roll + rerolls.
      set({
        currentEnemy: { ...enemy, hp: enemyHp, statuses },
        player: { ...state.player, hp: playerHp },
        diceValue: rollWithLuck(),
        rerollsLeft: stats.rerolls,
        battleLog: log,
      });
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
      const stats = computeStats(state.player, equipped);
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
      const stats = computeStats(state.player, equipped);
      const player = { ...state.player, hp: Math.min(state.player.hp, stats.maxHp) };
      set({
        equipped,
        inventory,
        player,
        diceFaces: applyEquipmentModifiers([equipped.weapon, equipped.armor, equipped.accessory]),
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
    const expGained = enemy.exp;
    const goldGained = enemy.gold;
    const drop = rollLoot(enemy, state.currentFloor);

    let leveledPlayer: Player = { ...state.player, hp: playerHp, gold: state.player.gold + goldGained };
    const { player: leveled, leveledUp } = applyExp(leveledPlayer, expGained);
    leveledPlayer = leveled;

    let finalLog = pushLogs(log, [
      { text: `EXP +${expGained} / ゴールド +${goldGained}`, tone: "good" },
    ]);
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
        const maxHp = computeStats(leveledPlayer, state.equipped, buffs).maxHp;
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
    };

    return {
      player: leveledPlayer,
      inventory,
      currentEnemy: enemy,
      currentFloor: state.currentFloor + 1,
      battleState: "won",
      battleLog: finalLog,
      lastResult: result,
      activeBuffs: buffs,
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
      // Temporary buffs don't survive a run reset.
      activeBuffs: [],
    };
  }

  function persistFromSnapshot(snap: Snapshot): void {
    const s = get();
    saveGame({
      player: snap.player ?? s.player,
      equipped: snap.equipped ?? s.equipped,
      inventory: snap.inventory ?? s.inventory,
      currentFloor: snap.currentFloor ?? s.currentFloor,
    });
  }
});
