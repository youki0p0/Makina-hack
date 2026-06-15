export type Difficulty = "normal" | "hard" | "hell" | "expert";

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  /** Enemy HP/attack multiplier. */
  enemyMult: number;
  /** EXP/gold reward multiplier. */
  rewardMult: number;
  /** Min/max equipment drops per kill (#6). */
  dropMin: number;
  dropMax: number;
  /** Extra weight added to epic/legendary/cursed in the drop roll (#6). */
  rareBonus: number;
  /** Extra chance for a drop to roll an additional ★ modifier (#6). */
  upswing: number;
  desc: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  normal: {
    id: "normal",
    name: "ノーマル",
    enemyMult: 1,
    rewardMult: 1,
    dropMin: 1,
    dropMax: 1,
    rareBonus: 0,
    upswing: 0,
    desc: "標準。ドロップ1個。",
  },
  hard: {
    id: "hard",
    name: "ハード",
    enemyMult: 1.4,
    rewardMult: 1.4,
    dropMin: 1,
    dropMax: 2,
    rareBonus: 15,
    upswing: 0.1,
    desc: "敵が強く報酬+40%。ドロップ1〜2個。",
  },
  hell: {
    id: "hell",
    name: "ヘル",
    enemyMult: 1.9,
    rewardMult: 2,
    dropMin: 1,
    dropMax: 3,
    rareBonus: 30,
    upswing: 0.2,
    desc: "高難度・報酬2倍。ドロップ1〜3個。",
  },
  expert: {
    id: "expert",
    name: "エキスパート",
    enemyMult: 2.6,
    rewardMult: 2.8,
    dropMin: 2,
    dropMax: 4,
    rareBonus: 50,
    upswing: 0.35,
    desc: "極限。報酬2.8倍・高レア多。ドロップ2〜4個。",
  },
};

export const DIFFICULTY_LIST: DifficultyDef[] = [
  DIFFICULTIES.normal,
  DIFFICULTIES.hard,
  DIFFICULTIES.hell,
  DIFFICULTIES.expert,
];

export function getDifficulty(id: Difficulty): DifficultyDef {
  return DIFFICULTIES[id] ?? DIFFICULTIES.normal;
}

export function normalizeDifficulty(id?: string): Difficulty {
  return id === "hard" || id === "hell" || id === "expert" ? id : "normal";
}
