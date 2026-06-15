// ===== World progression =====
// The dungeon is split into 100-floor "worlds" (chapters). Floors 1-1000 cover
// ten themed chapters; 1001+ is the Endless Abyss. Backgrounds are pure CSS
// gradients (no image assets) so the look changes as the player descends.

export interface World {
  /** 1-based chapter number (11 = Endless Abyss). */
  chapter: number;
  /** First floor of the chapter (inclusive). */
  start: number;
  /** Last floor of the chapter (inclusive); Infinity for the Endless Abyss. */
  end: number;
  /** Display name. */
  name: string;
  /** Short romanized / sub label. */
  subtitle: string;
  /** CSS gradient applied as the screen background. */
  background: string;
  /** Accent color (headings / borders). */
  accent: string;
}

/** The ten themed chapters plus the Endless Abyss. */
export const WORLDS: readonly World[] = [
  {
    chapter: 1,
    start: 1,
    end: 100,
    name: "始まりの草原",
    subtitle: "Verdant Plains",
    background: "linear-gradient(160deg,#0b2e1a 0%,#14532d 55%,#04210f 100%)",
    accent: "#4ade80",
  },
  {
    chapter: 2,
    start: 101,
    end: 200,
    name: "深き洞窟",
    subtitle: "Deep Caverns",
    background: "linear-gradient(160deg,#1c1410 0%,#2d2117 55%,#080503 100%)",
    accent: "#b08968",
  },
  {
    chapter: 3,
    start: 201,
    end: 300,
    name: "古代遺跡",
    subtitle: "Ancient Ruins",
    background: "linear-gradient(160deg,#26220f 0%,#4a3f1e 55%,#15130a 100%)",
    accent: "#e6c878",
  },
  {
    chapter: 4,
    start: 301,
    end: 400,
    name: "氷結世界",
    subtitle: "Frozen World",
    background: "linear-gradient(160deg,#0c2536 0%,#1e4a66 55%,#081420 100%)",
    accent: "#7dd3fc",
  },
  {
    chapter: 5,
    start: 401,
    end: 500,
    name: "灼熱火山",
    subtitle: "Blazing Volcano",
    background: "linear-gradient(160deg,#2a0a06 0%,#5a160c 55%,#160402 100%)",
    accent: "#fb7185",
  },
  {
    chapter: 6,
    start: 501,
    end: 600,
    name: "奈落",
    subtitle: "The Abyss",
    background: "linear-gradient(160deg,#1a0a26 0%,#2e1245 55%,#0a0414 100%)",
    accent: "#c084fc",
  },
  {
    chapter: 7,
    start: 601,
    end: 700,
    name: "天界",
    subtitle: "The Heavens",
    background: "linear-gradient(160deg,#2b2a20 0%,#4a4636 55%,#c9ba84 100%)",
    accent: "#fde68a",
  },
  {
    chapter: 8,
    start: 701,
    end: 800,
    name: "星界",
    subtitle: "Astral Realm",
    background: "linear-gradient(160deg,#0a0e2e 0%,#1a2356 55%,#04061a 100%)",
    accent: "#a5b4fc",
  },
  {
    chapter: 9,
    start: 801,
    end: 900,
    name: "虚無",
    subtitle: "The Void",
    background: "linear-gradient(160deg,#15171a 0%,#26292e 55%,#090a0c 100%)",
    accent: "#9ca3af",
  },
  {
    chapter: 10,
    start: 901,
    end: 1000,
    name: "機械神界",
    subtitle: "DEUS EX MACHINA",
    background:
      "linear-gradient(160deg,#0a0a0a 0%,#1a1606 50%,#3a2e0a 100%),repeating-linear-gradient(45deg,rgba(212,175,55,0.04) 0 14px,transparent 14px 28px)",
    accent: "#facc15",
  },
];

/** The Endless Abyss chapter (1001+). */
export const ENDLESS_WORLD: World = {
  chapter: 11,
  start: 1001,
  end: Infinity,
  name: "Endless Abyss",
  subtitle: "無限回廊",
  background: "linear-gradient(160deg,#0a0510 0%,#1a0a2e 55%,#050309 100%)",
  accent: "#a78bfa",
};

/** Highest non-endless floor (the final goal). */
export const FINAL_FLOOR = 1000;

/** The world a given floor belongs to. */
export function getWorld(floor: number): World {
  if (floor > FINAL_FLOOR) return ENDLESS_WORLD;
  for (const w of WORLDS) {
    if (floor >= w.start && floor <= w.end) return w;
  }
  return WORLDS[0];
}

/** True once the player is in the Endless Abyss. */
export function isEndless(floor: number): boolean {
  return floor > FINAL_FLOOR;
}

/**
 * True if `floor` is a world-boss floor (the 100th floor of a chapter, 1-1000).
 * Clearing it advances to the next world.
 */
export function isWorldBossFloor(floor: number): boolean {
  return floor % 100 === 0 && floor >= 100 && floor <= FINAL_FLOOR;
}
