export type Difficulty = "normal" | "hard" | "hell";

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  /** Enemy HP/attack multiplier. */
  enemyMult: number;
  /** EXP/gold reward multiplier. */
  rewardMult: number;
  desc: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  normal: { id: "normal", name: "ノーマル", enemyMult: 1, rewardMult: 1, desc: "標準的な難易度。" },
  hard: { id: "hard", name: "ハード", enemyMult: 1.4, rewardMult: 1.4, desc: "敵が強く、報酬+40%。" },
  hell: { id: "hell", name: "ヘル", enemyMult: 1.9, rewardMult: 2, desc: "高難度。報酬2倍。" },
};

export const DIFFICULTY_LIST: DifficultyDef[] = [
  DIFFICULTIES.normal,
  DIFFICULTIES.hard,
  DIFFICULTIES.hell,
];

export function getDifficulty(id: Difficulty): DifficultyDef {
  return DIFFICULTIES[id] ?? DIFFICULTIES.normal;
}

export function normalizeDifficulty(id?: string): Difficulty {
  return id === "hard" || id === "hell" ? id : "normal";
}
