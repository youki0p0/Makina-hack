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

function svgLayer(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** "#rrggbb" → "rgba(r,g,b,a)". */
function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

interface BgTheme {
  /** Foreground texture (tiled SVG). */
  texture: string;
  /** Size for the texture tile in px. */
  tile: number;
  /** A bottom "horizon" glow color. */
  glow: string;
}

/** A detailed, themed texture + glow per chapter (pure SVG/CSS, no images). */
function themeFor(world: World): BgTheme {
  const a = world.accent;
  const svg = (inner: string, size: number) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>${inner}</svg>`;

  switch (world.chapter) {
    case 1: // 草原 — grass blades + pollen motes
      return {
        tile: 56,
        glow: "#22c55e",
        texture: svg(
          `<g opacity='.5'><path d='M6 56q2-10 4-18' stroke='${a}' stroke-width='1' fill='none'/><path d='M9 56q-1-8 0-14' stroke='${a}' stroke-width='1' fill='none'/><path d='M40 56q3-12 6-22' stroke='${a}' stroke-width='1' fill='none'/></g><circle cx='30' cy='14' r='1' fill='#fde68a' opacity='.5'/><circle cx='48' cy='30' r='1' fill='#fef08a' opacity='.4'/>`,
          56,
        ),
      };
    case 2: // 洞窟 — stalactites + drips
      return {
        tile: 60,
        glow: "#7c3a12",
        texture: svg(
          `<g fill='${a}' opacity='.18'><path d='M0 0l4 16 4-16z'/><path d='M22 0l5 22 5-22z'/><path d='M48 0l4 14 4-14z'/></g><circle cx='27' cy='34' r='1' fill='${a}' opacity='.4'/><circle cx='10' cy='48' r='1' fill='${a}' opacity='.3'/>`,
          60,
        ),
      };
    case 3: // 古代遺跡 — engraved stone bricks
      return {
        tile: 64,
        glow: "#caa14a",
        texture: svg(
          `<g stroke='${a}' stroke-width='1' fill='none' opacity='.14'><path d='M0 21H64M0 43H64M21 0V21M43 21V43M21 43V64'/></g><g fill='${a}' opacity='.1'><circle cx='32' cy='32' r='3'/></g>`,
          64,
        ),
      };
    case 4: // 氷結 — snow + frost shards
      return {
        tile: 64,
        glow: "#7dd3fc",
        texture: svg(
          `<g opacity='.5'><circle cx='10' cy='12' r='1.3' fill='#fff'/><circle cx='40' cy='24' r='1' fill='${a}'/><circle cx='24' cy='48' r='1.4' fill='#fff'/><circle cx='54' cy='54' r='1' fill='${a}'/></g><g stroke='${a}' stroke-width='.7' opacity='.25'><path d='M30 4v8M26 8h8M48 36v6M45 39h6'/></g>`,
          64,
        ),
      };
    case 5: // 灼熱火山 — rising embers + cracks
      return {
        tile: 56,
        glow: "#ef4444",
        texture: svg(
          `<g><circle cx='10' cy='48' r='1.5' fill='#fb923c' opacity='.6'/><circle cx='28' cy='30' r='1.1' fill='#fbbf24' opacity='.5'/><circle cx='44' cy='40' r='1.3' fill='#fb7185' opacity='.45'/><circle cx='20' cy='14' r='1' fill='#fdba74' opacity='.4'/></g><path d='M0 40l12-6 10 5' stroke='#7f1d1d' stroke-width='1' fill='none' opacity='.3'/>`,
          56,
        ),
      };
    case 6: // 奈落 — drifting voidlight
      return {
        tile: 60,
        glow: "#7c3aed",
        texture: svg(
          `<g fill='${a}'><circle cx='14' cy='16' r='1.4' opacity='.4'/><circle cx='42' cy='30' r='1' opacity='.3'/><circle cx='26' cy='50' r='1.2' opacity='.35'/></g><circle cx='30' cy='30' r='12' fill='none' stroke='${a}' opacity='.08'/>`,
          60,
        ),
      };
    case 7: // 天界 — light rays + golden motes
      return {
        tile: 64,
        glow: "#fde68a",
        texture: svg(
          `<g stroke='${a}' stroke-width='1' opacity='.12'><path d='M32 -4L18 64M32 -4L46 64M32 -4L4 64M32 -4L60 64'/></g><circle cx='20' cy='40' r='1' fill='#fffbeb' opacity='.5'/><circle cx='46' cy='24' r='1' fill='#fef3c7' opacity='.45'/>`,
          64,
        ),
      };
    case 8: // 星界 — starfield + constellations
      return {
        tile: 80,
        glow: "#3b3a86",
        texture: svg(
          `<g fill='#fff'><circle cx='10' cy='14' r='1.2' opacity='.7'/><circle cx='54' cy='8' r='.8' opacity='.5'/><circle cx='30' cy='40' r='1.4' opacity='.8'/><circle cx='70' cy='52' r='1' opacity='.6'/><circle cx='44' cy='68' r='.8' opacity='.5'/><circle cx='18' cy='60' r='1' opacity='.6'/></g><path d='M10 14L30 40L54 8' stroke='${a}' stroke-width='.5' fill='none' opacity='.3'/>`,
          80,
        ),
      };
    case 9: // 虚無 — sparse grey static
      return {
        tile: 50,
        glow: "#374151",
        texture: svg(
          `<g fill='${a}'><circle cx='8' cy='10' r='.8' opacity='.25'/><circle cx='30' cy='26' r='.8' opacity='.2'/><circle cx='44' cy='42' r='.8' opacity='.18'/><circle cx='18' cy='44' r='.8' opacity='.2'/></g>`,
          50,
        ),
      };
    case 10: // 機械神界 — circuit grid + nodes
      return {
        tile: 48,
        glow: "#a16207",
        texture: svg(
          `<g stroke='${a}' fill='none'><path d='M0 0H48M0 0V48' stroke-width='1' opacity='.14'/><path d='M0 24H48M24 0V48' stroke-width='.5' opacity='.08'/><path d='M24 24h12v12' stroke-width='1' opacity='.16'/></g><circle cx='24' cy='24' r='2.2' fill='none' stroke='${a}' opacity='.25'/><circle cx='36' cy='36' r='1.4' fill='${a}' opacity='.3'/>`,
          48,
        ),
      };
    default: // 11 endless — deep violet starfield
      return {
        tile: 80,
        glow: "#6d28d9",
        texture: svg(
          `<g fill='#e9d5ff'><circle cx='12' cy='18' r='1.2' opacity='.6'/><circle cx='50' cy='10' r='.8' opacity='.45'/><circle cx='32' cy='44' r='1.4' opacity='.7'/><circle cx='68' cy='58' r='1' opacity='.5'/><circle cx='22' cy='66' r='.8' opacity='.45'/></g>`,
          80,
        ),
      };
  }
}

/** Scale down every opacity in an SVG so a texture reads as a faint hint. */
function dampenSvg(svg: string, factor: number): string {
  return svg.replace(/opacity='([\d.]+)'/g, (_m, v) =>
    `opacity='${(parseFloat(v) * factor).toFixed(2)}'`,
  );
}

/**
 * Fully procedural background for a world (no image assets), tuned for
 * READABILITY: the chapter keeps its color identity, but a dark scrim sits over
 * everything and the themed texture is heavily dampened so text stays legible.
 */
export function getWorldBackground(world: World): string {
  const t = themeFor(world);
  const a = world.accent;
  return [
    // very faint themed texture (top)
    `${svgLayer(dampenSvg(t.texture, 0.4))} 0 0 / ${t.tile}px ${t.tile}px repeat`,
    // readability scrim — darkens everything beneath for high text contrast
    `linear-gradient(rgba(6,6,10,0.62), rgba(6,6,10,0.72))`,
    // gentle accent glow + horizon glow (muted)
    `radial-gradient(120% 70% at 50% -12%, ${hexA(a, 0.1)} 0%, transparent 60%)`,
    `radial-gradient(120% 55% at 50% 116%, ${hexA(t.glow, 0.14)} 0%, transparent 70%)`,
    // edge vignette for depth
    `radial-gradient(120% 92% at 50% 40%, transparent 50%, rgba(0,0,0,.55) 100%)`,
    // base chapter gradient (bottom)
    world.background,
  ].join(", ");
}

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
