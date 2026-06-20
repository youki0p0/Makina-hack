import { describe, expect, it } from "vitest";
import { spinReels } from "./reels";
import { planPayout, stepTowards, counterStep, particlesThisFrame } from "./payout";
import { buildPegs, launchBall, stepBall } from "./physics";
import { getSymbol, SYMBOLS } from "./symbols";
import { BOARD } from "./config";
import { pickBattleBoss } from "./battle";
import { BOSS_TEMPLATES } from "@/data/enemies";

// 決定的 RNG（線形合同法）でテストを安定させる。
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe("symbols", () => {
  it("has 7 weapon symbols, 777 is the jackpot", () => {
    expect(SYMBOLS).toHaveLength(7);
    expect(getSymbol(7).tier).toBe("jackpot");
    expect(getSymbol(7).name).toBe("神機マキナ");
    // 7以外も当たりになり得る（payout > 0）。
    for (let id = 1; id <= 7; id++) expect(getSymbol(id).payout).toBeGreaterThan(0);
  });
});

describe("spinReels", () => {
  it("a win always shows three identical symbols; a miss never does", () => {
    const rng = seeded(12345);
    for (let i = 0; i < 2000; i++) {
      const r = spinReels(i % 2 === 0 ? "normal" : "complete", rng);
      const [a, b, c] = r.symbols;
      const allSame = a === b && b === c;
      expect(r.win).toBe(allSame);
      if (r.win) {
        expect(r.symbolId).toBe(a);
        expect(r.payout).toBeGreaterThan(0);
      } else {
        expect(r.payout).toBe(0);
      }
    }
  });

  it("complete mode wins more often than normal mode", () => {
    const rngN = seeded(7);
    const rngC = seeded(7);
    let nWins = 0;
    let cWins = 0;
    for (let i = 0; i < 4000; i++) {
      if (spinReels("normal", rngN).win) nWins++;
      if (spinReels("complete", rngC).win) cWins++;
    }
    expect(cWins).toBeGreaterThan(nWins);
  });

  it("only 777 is the jackpot, and 4/5/6/7 enter Complete Mode", () => {
    const rng = seeded(99);
    for (let i = 0; i < 3000; i++) {
      const r = spinReels("normal", rng);
      if (!r.win) continue;
      expect(r.jackpot).toBe(r.symbolId === 7);
      expect(r.enterComplete).toBe((r.symbolId ?? 0) >= 4);
    }
  });

  it("reach production metadata is self-consistent and acts as a reliability gauge", () => {
    const rng = seeded(31337);
    let winSuSum = 0,
      winN = 0,
      missSuSum = 0,
      missN = 0;
    for (let i = 0; i < 6000; i++) {
      const r = spinReels(i % 2 === 0 ? "normal" : "complete", rng);
      // su は 0..4。
      expect(r.su).toBeGreaterThanOrEqual(0);
      expect(r.su).toBeLessThanOrEqual(4);
      // reachKind は reach と整合（テンパイなしなら none、テンパイありなら none 以外）。
      expect(r.reachKind === "none").toBe(!r.reach);
      // spName / chanceUp は SP のときだけ。
      if (r.reachKind === "sp") expect(r.spName).toBeTruthy();
      else {
        expect(r.spName).toBeNull();
        expect(r.chanceUp).toBe(0);
      }
      // プレミアは当たりのときだけ（出たら当確の世界観）。
      if (r.premium) expect(r.win).toBe(true);
      if (r.win) {
        winSuSum += r.su;
        winN++;
      } else {
        missSuSum += r.su;
        missN++;
      }
    }
    // 信頼度ゲージ: 当たりの平均SUステップはハズレより明確に高い。
    expect(winSuSum / winN).toBeGreaterThan(missSuSum / missN);
  });

  it("promotion chains start at the rolled symbol and only climb", () => {
    const rng = seeded(2024);
    for (let i = 0; i < 5000; i++) {
      const r = spinReels("complete", rng);
      if (!r.win || r.promotion.length < 2) continue;
      for (let k = 1; k < r.promotion.length; k++) {
        expect(r.promotion[k]).toBeGreaterThan(r.promotion[k - 1]);
      }
      // 昇格後の最終図柄が結果に一致。
      expect(r.promotion[r.promotion.length - 1]).toBe(r.symbolId);
    }
  });
});

describe("pickBattleBoss", () => {
  it("returns a valid boss for any ren and rotates over BOSS_TEMPLATES", () => {
    const ids = new Set(BOSS_TEMPLATES.map((b) => b.id));
    // ren=1 は先頭、以降は順送り（巡回）。
    expect(pickBattleBoss(1).id).toBe(BOSS_TEMPLATES[0].id);
    expect(pickBattleBoss(2).id).toBe(BOSS_TEMPLATES[1].id);
    // 1周回ると先頭に戻る。
    expect(pickBattleBoss(BOSS_TEMPLATES.length + 1).id).toBe(BOSS_TEMPLATES[0].id);
    // どんな ren でも有効なボス（id/name/emoji が埋まっている）。
    for (let ren = -2; ren <= BOSS_TEMPLATES.length * 2 + 1; ren++) {
      const b = pickBattleBoss(ren);
      expect(ids.has(b.id)).toBe(true);
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.emoji.length).toBeGreaterThan(0);
    }
    // 連続する ren で全種類が網羅される。
    const seen = new Set<string>();
    for (let ren = 1; ren <= BOSS_TEMPLATES.length; ren++) seen.add(pickBattleBoss(ren).id);
    expect(seen.size).toBe(BOSS_TEMPLATES.length);
  });
});

describe("payout", () => {
  it("planPayout returns null for a miss and scales budget for a win", () => {
    const rng = seeded(5);
    let miss: ReturnType<typeof spinReels> | null = null;
    let win: ReturnType<typeof spinReels> | null = null;
    for (let i = 0; i < 500 && (!miss || !win); i++) {
      const r = spinReels("normal", rng);
      if (r.win) win = r;
      else miss = r;
    }
    expect(planPayout(miss!)).toBeNull();
    const plan = planPayout(win!)!;
    expect(plan.balls).toBe(win!.payout);
    expect(plan.particleBudget).toBeGreaterThan(0);
  });

  it("jackpot plan is rainbow and uses the larger particle cap", () => {
    // 強制的に 777 を作る（payout テーブル経由）。
    const sym = getSymbol(7);
    const fake = {
      symbols: [7, 7, 7] as [number, number, number],
      win: true,
      symbolId: 7,
      tier: sym.tier,
      payout: sym.payout,
      durationMs: sym.durationMs,
      reach: true,
      group: "makina" as const,
      enterComplete: true,
      jackpot: true,
      promotion: [7],
      su: 4,
      reachKind: "sp" as const,
      spName: "神機降臨SPリーチ",
      chanceUp: 3,
      premium: true,
    };
    const plan = planPayout(fake)!;
    expect(plan.rainbow).toBe(true);
    expect(plan.particleBudget).toBeGreaterThan(0);
  });

  it("stepTowards never overshoots and counterStep drains in time", () => {
    expect(stepTowards(0, 100, 24)).toBe(24);
    expect(stepTowards(90, 100, 24)).toBe(100);
    // 一定フレームで必ず消化される。
    let cur = 0;
    const target = 1500;
    let frames = 0;
    while (cur < target && frames < 600) {
      cur = stepTowards(cur, target, counterStep(target - cur, 300 - frames));
      frames++;
    }
    expect(cur).toBe(target);
    expect(particlesThisFrame(0)).toBe(0);
    expect(particlesThisFrame(1000)).toBeGreaterThan(0);
  });
});

describe("physics", () => {
  it("every launched ball eventually settles (pocket or fall) and stays in bounds", () => {
    const pegs = buildPegs();
    const rng = seeded(42);
    let pocketed = 0;
    for (let n = 0; n < 200; n++) {
      const ball = launchBall(BOARD, rng);
      let event: ReturnType<typeof stepBall> = null;
      for (let step = 0; step < 4000 && !event; step++) {
        event = stepBall(ball, pegs);
        // 横方向は常に盤内。
        expect(ball.x).toBeGreaterThanOrEqual(-1);
        expect(ball.x).toBeLessThanOrEqual(BOARD.width + 1);
      }
      expect(event === "pocket" || event === "fall").toBe(true);
      expect(ball.active).toBe(false);
      if (event === "pocket") pocketed++;
    }
    // 入賞口はそれなりに狭いが、まれには入る（0ではない）。
    expect(pocketed).toBeGreaterThan(0);
  });
});
