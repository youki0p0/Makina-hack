export type Difficulty = "normal" | "hard" | "hell" | "expert";

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  /** Flat enemy HP/attack multiplier. */
  enemyMult: number;
  /** Per-floor enemy HP growth (1 + floor*hpPerFloor). Steeper = harsher curve. */
  hpPerFloor: number;
  /** Per-floor enemy attack growth. */
  atkPerFloor: number;
  /** Additive bonus per enemy ★ tier (every 50F). Higher = brutal late game. */
  enemyStarBonus: number;
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

// Curve philosophy:
// - normal: gentle (light/casual players). The current eased balance.
// - hard:   noticeably steeper.
// - hell:   ~the old brutal curve (the "超鬼畜" fans missed) and then some.
// - expert: beyond brutal — for masochists.
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  normal: {
    id: "normal",
    name: "ノーマル",
    enemyMult: 1,
    hpPerFloor: 0.13,
    atkPerFloor: 0.095,
    enemyStarBonus: 0.13,
    rewardMult: 1,
    dropMin: 1,
    dropMax: 1,
    rareBonus: 0,
    upswing: 0,
    desc: "ライト向け。ゆるやかな成長曲線。ドロップ1個。",
  },
  hard: {
    id: "hard",
    name: "ハード",
    enemyMult: 1.25,
    hpPerFloor: 0.16,
    atkPerFloor: 0.11,
    enemyStarBonus: 0.16,
    rewardMult: 1.5,
    dropMin: 1,
    dropMax: 2,
    rareBonus: 15,
    upswing: 0.1,
    desc: "手応えあり。敵の伸びが急。報酬+50%・ドロップ1〜2個。",
  },
  hell: {
    id: "hell",
    name: "ヘル",
    enemyMult: 1.6,
    hpPerFloor: 0.19,
    atkPerFloor: 0.13,
    enemyStarBonus: 0.2,
    rewardMult: 2.2,
    dropMin: 1,
    dropMax: 3,
    rareBonus: 30,
    upswing: 0.2,
    desc: "旧来の鬼畜カーブ。深層で激重。報酬2.2倍・ドロップ1〜3個。",
  },
  expert: {
    id: "expert",
    name: "エキスパート",
    enemyMult: 2.2,
    hpPerFloor: 0.23,
    atkPerFloor: 0.15,
    enemyStarBonus: 0.24,
    rewardMult: 3,
    dropMin: 2,
    dropMax: 4,
    rareBonus: 50,
    upswing: 0.35,
    desc: "超鬼畜。乗算的に重い最高難度。報酬3倍・ドロップ2〜4個。",
  },
};

/** Enemy scaling derived from a difficulty (passed into generateEnemy). */
export interface EnemyScale {
  enemyMult: number;
  hpPerFloor: number;
  atkPerFloor: number;
  enemyStarBonus: number;
}

export function difficultyScale(id: Difficulty): EnemyScale {
  const d = getDifficulty(id);
  return {
    enemyMult: d.enemyMult,
    hpPerFloor: d.hpPerFloor,
    atkPerFloor: d.atkPerFloor,
    enemyStarBonus: d.enemyStarBonus,
  };
}

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
