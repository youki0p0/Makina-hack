import { ALL_CARDS } from "@/data/arena/cards";
import { FIELDS } from "@/data/arena/fields";
import type { FieldId, GameMode, MonsterBuild, RunState } from "@/types/arena";

export interface ModeConfig {
  id: GameMode;
  label: string;
  targetWins: number;
  lives: number;
  maxRounds: number;
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  short: { id: "short", label: "ショートバトル", targetWins: 10, lives: 3, maxRounds: 12 },
  long: { id: "long", label: "ロングバトル", targetWins: 15, lives: 5, maxRounds: 19 },
};

export function rollField(): FieldId {
  return FIELDS[Math.floor(Math.random() * FIELDS.length)].id;
}

/** ラウンドに応じた3枚のドラフトを生成（後半ほどレアが出やすい）。 */
export function generateDraft(round: number): string[] {
  const weightOf = (rarity: number) => {
    if (rarity === 1) return 5;
    if (rarity === 2) return 2 + round * 0.22;
    return 0.4 + round * 0.28;
  };
  const picks: string[] = [];
  const pool = [...ALL_CARDS];
  for (let n = 0; n < 3 && pool.length > 0; n++) {
    const total = pool.reduce((a, c) => a + weightOf(c.rarity), 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= weightOf(pool[i].rarity);
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    picks.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return picks;
}

export function newRun(
  mode: GameMode,
  operatorId: string,
  monsterIds: string[],
): RunState {
  const cfg = MODE_CONFIG[mode];
  const builds: MonsterBuild[] = monsterIds.slice(0, 3).map((id) => ({
    monsterId: id,
    equipmentIds: [],
    skillIds: [],
  }));
  return {
    mode,
    operatorId,
    builds,
    round: 1,
    wins: 0,
    losses: 0,
    life: cfg.lives,
    field: rollField(),
    draft: generateDraft(1),
    rerolls: 2,
    phase: "draft",
    lastResult: null,
  };
}

/** 1体に集中している技数（集中/分散の判定用）。 */
export function maxSkillsOnOne(builds: MonsterBuild[]): number {
  return builds.reduce((m, b) => Math.max(m, b.skillIds.length), 0);
}
