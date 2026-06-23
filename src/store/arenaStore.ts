"use client";

import { create } from "zustand";
import { cardCost, getCard, isEquipment } from "@/data/arena/cards";
import { simulateBattle } from "@/lib/arena/battle";
import {
  evaluateAchievements,
  loadAchievements,
  unlockAchievements,
} from "@/lib/arena/achievements";
import { offerBlessings } from "@/lib/arena/blessings";
import {
  budgetForRound,
  generateDraft,
  MODE_CONFIG,
  newRun,
  rollField,
} from "@/lib/arena/gameState";
import { loadRank, recordResult } from "@/lib/arena/rank";
import type { GameMode, RankRecord, RunState } from "@/types/arena";

const RUN_KEY = "arena-run-v1";

interface ArenaStore {
  hydrated: boolean;
  run: RunState | null;
  ranks: { short: RankRecord; long: RankRecord };
  achievements: string[];
  freshAchievements: string[];

  hydrate: () => void;
  clearFreshAchievements: () => void;
  startRun: (mode: GameMode, operatorId: string, monsterIds: string[]) => void;
  assignCard: (cardId: string, slot: number) => void;
  confirmPrep: () => void;
  finishBattle: () => void;
  chooseBlessing: (id: string) => void;
  nextRound: () => void;
  quitToMenu: () => void;
}

function persistRun(run: RunState | null) {
  if (typeof window === "undefined") return;
  try {
    if (run) window.localStorage.setItem(RUN_KEY, JSON.stringify(run));
    else window.localStorage.removeItem(RUN_KEY);
  } catch {
    /* ignore */
  }
}

function loadRun(): RunState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    // 旧セーブ互換（祝福/予算が無い場合の補完）
    if (run.blessings == null) run.blessings = [];
    if (run.pendingBlessings == null) run.pendingBlessings = [];
    if (typeof run.budget !== "number") run.budget = budgetForRound(run.round, run.blessings);
    return run;
  } catch {
    return null;
  }
}

/** 次ラウンドの初期状態（祝福を反映した予算・新ドラフト）。 */
function startNextRound(run: RunState): RunState {
  const round = run.round + 1;
  return {
    ...run,
    round,
    field: rollField(),
    draft: generateDraft(round),
    budget: budgetForRound(round, run.blessings),
    phase: "draft",
    lastResult: null,
    pendingBlessings: [],
  };
}

export const useArenaStore = create<ArenaStore>((set, get) => ({
  hydrated: false,
  run: null,
  ranks: {
    short: { bestWins: 0, bestRound: 0, games: 0, wins: 0 },
    long: { bestWins: 0, bestRound: 0, games: 0, wins: 0 },
  },
  achievements: [],
  freshAchievements: [],

  hydrate: () => {
    if (get().hydrated) return;
    set({
      hydrated: true,
      run: loadRun(),
      ranks: { short: loadRank("short"), long: loadRank("long") },
      achievements: loadAchievements(),
    });
  },

  clearFreshAchievements: () => set({ freshAchievements: [] }),

  startRun: (mode, operatorId, monsterIds) => {
    const run = newRun(mode, operatorId, monsterIds);
    persistRun(run);
    set({ run });
  },

  assignCard: (cardId, slot) => {
    const run = get().run;
    if (!run) return;
    const card = getCard(cardId);
    if (!card) return;
    const cost = cardCost(card);
    if (cost > run.budget) return; // 予算オーバーは割り当て不可
    const builds = run.builds.map((b, i) => {
      if (i !== slot) return b;
      if (isEquipment(card)) return { ...b, equipmentIds: [...b.equipmentIds, cardId] };
      return { ...b, skillIds: [...b.skillIds, cardId] };
    });
    const next: RunState = {
      ...run,
      builds,
      draft: run.draft.filter((id) => id !== cardId),
      budget: run.budget - cost,
    };
    persistRun(next);
    set({ run: next });
  },

  confirmPrep: () => {
    const run = get().run;
    if (!run) return;
    const result = simulateBattle(
      run.builds,
      run.operatorId,
      run.field,
      run.round,
      run.mode,
      run.blessings,
      run.losses, // 逆境ボーナス：負け数に応じて味方を底上げ
    );
    const next: RunState = { ...run, phase: "battle", lastResult: result };
    persistRun(next);
    set({ run: next });
  },

  finishBattle: () => {
    const run = get().run;
    if (!run || !run.lastResult) return;
    const cfg = MODE_CONFIG[run.mode];
    const win = run.lastResult.win;
    const wins = run.wins + (win ? 1 : 0);
    const losses = run.losses + (win ? 0 : 1);
    const life = win ? run.life : run.life - 1;

    let phase: RunState["phase"];
    let cleared = false;
    let pendingBlessings: string[] = [];
    if (wins >= cfg.targetWins) {
      phase = "victory";
      cleared = true;
    } else if (life <= 0) {
      phase = "gameover";
    } else if (win) {
      // 勝利（継続）→ 祝福3択へ
      phase = "blessing";
      pendingBlessings = offerBlessings(run.round * 7919 + wins * 31 + 1);
    } else {
      phase = "result";
    }

    const next: RunState = { ...run, wins, losses, life, phase, pendingBlessings };

    let ranks = get().ranks;
    if (phase === "victory" || phase === "gameover") {
      const rec = recordResult(run.mode, wins, run.round, cleared);
      ranks = { ...ranks, [run.mode]: rec };
    }

    const { all, fresh } = unlockAchievements(evaluateAchievements(next, win));

    persistRun(next);
    set({ run: next, ranks, achievements: all, freshAchievements: fresh });
  },

  chooseBlessing: (id) => {
    const run = get().run;
    if (!run || run.phase !== "blessing") return;
    const withBlessing: RunState = { ...run, blessings: [...run.blessings, id] };
    const next = startNextRound(withBlessing);
    persistRun(next);
    set({ run: next });
  },

  nextRound: () => {
    const run = get().run;
    if (!run) return;
    if (run.phase === "victory" || run.phase === "gameover") {
      get().quitToMenu();
      return;
    }
    const next = startNextRound(run);
    persistRun(next);
    set({ run: next });
  },

  quitToMenu: () => {
    persistRun(null);
    set({ run: null });
  },
}));
