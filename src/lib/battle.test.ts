import { describe, expect, it } from "vitest";
import { baseDiceFaces } from "@/data/diceFaces";
import { generateEnemy } from "@/data/enemies";
import {
  applyExp,
  computeStats,
  expForLevel,
  luckFloor,
  resolveEnemyTurn,
  resolveFinalBossTurn,
  resolvePlayerAction,
  tickEnemyStatuses,
} from "@/lib/battle";
import type { ActiveBuff, DiceFace, EquippedItems, Player } from "@/types/game";

const emptyEquip: EquippedItems = {
  weapon: null,
  helm: null,
  armor: null,
  gloves: null,
  boots: null,
  accessory: null,
};

function basePlayer(): Player {
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

function face(value: 1 | 2 | 3 | 4 | 5 | 6): DiceFace {
  return JSON.parse(JSON.stringify(baseDiceFaces.find((f) => f.value === value)));
}

describe("computeStats", () => {
  it("returns base stats with no equipment/buffs", () => {
    const s = computeStats(basePlayer(), emptyEquip);
    expect(s.attack).toBe(8);
    expect(s.defense).toBe(2);
    expect(s.maxHp).toBe(50);
    expect(s.rerolls).toBe(1);
  });

  it("adds temporary buffs and artifact bonus", () => {
    const buffs: ActiveBuff[] = [
      { kind: "attack", value: 4, battlesLeft: 1 },
      { kind: "reroll", value: 1, battlesLeft: 1 },
    ];
    const s = computeStats(basePlayer(), emptyEquip, buffs, {
      attack: 2,
      defense: 0,
      maxHp: 10,
      reroll: 0,
    });
    expect(s.attack).toBe(8 + 4 + 2);
    expect(s.maxHp).toBe(60);
    expect(s.rerolls).toBe(2); // base 1 + buff 1
  });
});

describe("resolvePlayerAction", () => {
  it("normal attack deals attack*mult minus defense", () => {
    const enemy = generateEnemy(1);
    enemy.defense = 0;
    const stats = computeStats(basePlayer(), emptyEquip);
    const out = resolvePlayerAction(face(3), stats, enemy);
    expect(out.enemyDamage).toBe(Math.max(1, Math.round(stats.attack * 1) - 0));
  });

  it("miss deals no damage", () => {
    const enemy = generateEnemy(1);
    const stats = computeStats(basePlayer(), emptyEquip);
    const out = resolvePlayerAction(face(1), stats, enemy);
    expect(out.enemyDamage).toBe(0);
  });
});

describe("tickEnemyStatuses", () => {
  it("sums damage and decrements turns", () => {
    const enemy = generateEnemy(1);
    enemy.statuses = [{ kind: "poison", damagePerTurn: 3, remainingTurns: 2 }];
    const res = tickEnemyStatuses(enemy);
    expect(res.damage).toBe(3);
    expect(res.statuses[0].remainingTurns).toBe(1);
  });

  it("drops expired statuses", () => {
    const enemy = generateEnemy(1);
    enemy.statuses = [{ kind: "burn", damagePerTurn: 5, remainingTurns: 1 }];
    const res = tickEnemyStatuses(enemy);
    expect(res.damage).toBe(5);
    expect(res.statuses).toHaveLength(0);
  });
});

describe("applyExp", () => {
  it("levels up when exp exceeds threshold", () => {
    const p = basePlayer();
    const { player, leveledUp } = applyExp(p, p.expToNext + 1);
    expect(leveledUp).toBe(true);
    expect(player.level).toBe(2);
  });
});

describe("resolveEnemyTurn player statuses", () => {
  const stats = computeStats(basePlayer(), emptyEquip);

  it("poison enemies can inflict player poison", () => {
    const enemy = { ...generateEnemy(1), ability: "poison" as const };
    let saw = false;
    for (let i = 0; i < 300; i++) {
      if (resolveEnemyTurn(enemy, stats, 0).playerPoison > 0) saw = true;
    }
    expect(saw).toBe(true);
  });

  it("a plain enemy inflicts no player status", () => {
    const enemy = { ...generateEnemy(1), ability: null };
    const t = resolveEnemyTurn(enemy, stats, 0);
    expect(t.playerPoison).toBe(0);
    expect(t.playerStun).toBe(0);
  });
});

describe("resolveFinalBossTurn (1000F last boss)", () => {
  const stats = computeStats(basePlayer(), emptyEquip);
  const deus = () => ({ ...generateEnemy(1000), charging: false, chargeCounter: 0 });

  it("unleashes a big hit when charging", () => {
    const t = resolveFinalBossTurn({ ...deus(), charging: true }, stats, 0);
    expect(t.playerDamage).toBeGreaterThan(0);
    expect(t.charging).toBe(false);
    expect(t.logs.join("")).toContain("終焉のサイコロ");
  });

  it("telegraphs a charge after a few turns", () => {
    const t = resolveFinalBossTurn({ ...deus(), chargeCounter: 3 }, stats, 0);
    expect(t.charging).toBe(true);
  });

  it("can act twice and disrupt dice in the final phase (low HP)", () => {
    const low = { ...deus(), hp: 1 }; // phase 3
    let sawStun = false;
    let multiActionLogs = 0;
    for (let i = 0; i < 200; i++) {
      const t = resolveFinalBossTurn({ ...low, chargeCounter: 0 }, stats, 0);
      if (t.playerStun && t.playerStun > 0) sawStun = true;
      if (!t.charging && t.logs.length >= 2) multiActionLogs++;
    }
    expect(sawStun).toBe(true);
    expect(multiActionLogs).toBeGreaterThan(0);
  });
});

describe("luckFloor", () => {
  it("returns the highest luck minimum (capped at 6)", () => {
    expect(luckFloor([])).toBe(1);
    expect(luckFloor([{ kind: "luck", value: 3, battlesLeft: 1 }])).toBe(3);
    expect(luckFloor([{ kind: "luck", value: 9, battlesLeft: 1 }])).toBe(6);
  });
});
