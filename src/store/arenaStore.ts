"use client";

import { create } from "zustand";
import { getCard, isEquipment } from "@/data/arena/cards";
import { simulateBattle } from "@/lib/arena/battle";
import { generateDraft, MODE_CONFIG, newRun, rollField } from "@/lib/arena/gameState";
import { loadRank, recordResult } from "@/lib/arena/rank";
import type { GameMode, RankRecord, RunState } from "@/types/arena";

const RUN_KEY = "arena-run-v1";

interface ArenaStore {
  hydrated: boolean;
  run: RunState | null;
  ranks: { short: RankRecord; long: RankRecord };

  hydrate: () => void;
  startRun: (mode: GameMode, operatorId: string, monsterIds: string[]) => void;
  rerollDraft: () => void;
  assignCard: (cardId: string, slot: number) => void;
  discardCard: (cardId: string) => void;
  confirmPrep: () => void;
  finishBattle: () => void;
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
    return JSON.parse(raw) as RunState;
  } catch {
    return null;
  }
}

export const useArenaStore = create<ArenaStore>((set, get) => ({
  hydrated: false,
  run: null,
  ranks: { short: { bestWins: 0, bestRound: 0, games: 0, wins: 0 }, long: { bestWins: 0, bestRound: 0, games: 0, wins: 0 } },

  hydrate: () => {
    if (get().hydrated) return;
    set({
      hydrated: true,
      run: loadRun(),
      ranks: { short: loadRank("short"), long: loadRank("long") },
    });
  },

  startRun: (mode, operatorId, monsterIds) => {
    const run = newRun(mode, operatorId, monsterIds);
    persistRun(run);
    set({ run });
  },

  rerollDraft: () => {
    const run = get().run;
    if (!run || run.rerolls <= 0) return;
    const next: RunState = {
      ...run,
      draft: generateDraft(run.round),
      rerolls: run.rerolls - 1,
    };
    persistRun(next);
    set({ run: next });
  },

  assignCard: (cardId, slot) => {
    const run = get().run;
    if (!run) return;
    const card = getCard(cardId);
    if (!card) return;
    const builds = run.builds.map((b, i) => {
      if (i !== slot) return b;
      if (isEquipment(card)) return { ...b, equipmentIds: [...b.equipmentIds, cardId] };
      return { ...b, skillIds: [...b.skillIds, cardId] };
    });
    const next: RunState = {
      ...run,
      builds,
      draft: run.draft.filter((id) => id !== cardId),
    };
    persistRun(next);
    set({ run: next });
  },

  discardCard: (cardId) => {
    const run = get().run;
    if (!run) return;
    const next: RunState = { ...run, draft: run.draft.filter((id) => id !== cardId) };
    persistRun(next);
    set({ run: next });
  },

  confirmPrep: () => {
    const run = get().run;
    if (!run) return;
    const result = simulateBattle(run.builds, run.operatorId, run.field, run.round, run.mode);
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

    let phase: RunState["phase"] = "result";
    let cleared = false;
    if (wins >= cfg.targetWins) {
      phase = "victory";
      cleared = true;
    } else if (life <= 0) {
      phase = "gameover";
    }

    const next: RunState = { ...run, wins, losses, life, phase };

    let ranks = get().ranks;
    if (phase === "victory" || phase === "gameover") {
      const rec = recordResult(run.mode, wins, run.round, cleared);
      ranks = { ...ranks, [run.mode]: rec };
    }
    persistRun(next);
    set({ run: next, ranks });
  },

  nextRound: () => {
    const run = get().run;
    if (!run) return;
    if (run.phase === "victory" || run.phase === "gameover") {
      get().quitToMenu();
      return;
    }
    const next: RunState = {
      ...run,
      round: run.round + 1,
      field: rollField(),
      draft: generateDraft(run.round + 1),
      rerolls: 2,
      phase: "draft",
      lastResult: null,
    };
    persistRun(next);
    set({ run: next });
  },

  quitToMenu: () => {
    persistRun(null);
    set({ run: null });
  },
}));
