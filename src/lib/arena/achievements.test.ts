import { describe, expect, it } from "vitest";
import { evaluateAchievements } from "@/lib/arena/achievements";
import { MODE_CONFIG } from "@/lib/arena/gameState";
import type { BattleResult, RunState } from "@/types/arena";

function baseRun(over: Partial<RunState>): RunState {
  return {
    mode: "short",
    operatorId: "calibrator",
    builds: [],
    round: 1,
    wins: 0,
    losses: 0,
    life: 3,
    field: "forest",
    draft: [],
    budget: 5,
    phase: "result",
    lastResult: null,
    blessings: [],
    pendingBlessings: [],
    ...over,
  };
}

const bossResult: BattleResult = {
  win: true,
  reason: "wipe",
  frames: [],
  log: [],
  allyHpLeft: 1,
  enemyHpLeft: 0,
  field: "forest",
  round: 5,
  boss: true,
};

describe("evaluateAchievements", () => {
  it("ラウンド勝利で初陣", () => {
    expect(evaluateAchievements(baseRun({}), true)).toContain("first_win");
  });

  it("ボス勝利でボスキラー", () => {
    const run = baseRun({ round: 5, lastResult: bossResult });
    expect(evaluateAchievements(run, true)).toContain("boss_slayer");
  });

  it("10回戦到達で歴戦", () => {
    expect(evaluateAchievements(baseRun({ round: 10 }), true)).toContain("reach_r10");
  });

  it("ショート優勝でclear_short、ライフ満タンならflawlessも", () => {
    const run = baseRun({ phase: "victory", wins: 10, life: MODE_CONFIG.short.lives });
    const ids = evaluateAchievements(run, true);
    expect(ids).toContain("clear_short");
    expect(ids).toContain("flawless");
  });

  it("ライフが減った優勝はflawlessが付かない", () => {
    const run = baseRun({ phase: "victory", wins: 10, life: 1 });
    const ids = evaluateAchievements(run, true);
    expect(ids).toContain("clear_short");
    expect(ids).not.toContain("flawless");
  });

  it("敗北では初陣が付かない", () => {
    expect(evaluateAchievements(baseRun({}), false)).not.toContain("first_win");
  });
});
