// ===== Enemy / boss icons =====
// Every enemy/boss id maps to a recognisable silhouette + fitting palette, so
// the dot-art matches what the name evokes instead of a random shape.

import { blank, disc, hline, rect, ring, set, vline, type Grid } from "./grid";
import { renderToCache } from "./cache";

export interface EnemyIconSpec {
  templateId: string;
  isBoss: boolean;
  /** 1 small / 2 great / 3 chapter (0 for normal). */
  bossRank?: number;
  modTier: number;
  seed: number;
}

type CreaturePalette = { body: string; shade: string; eye: string };

// Named palettes so each creature can keep a colour that matches its identity
// (a slime is green, a skeleton is bone-white, a dragon is red …).
const CP: Record<string, CreaturePalette> = {
  slimeGreen: { body: "#65a30d", shade: "#3f6212", eye: "#fef9c3" },
  slimeTeal: { body: "#14b8a6", shade: "#0f766e", eye: "#ccfbf1" },
  goblinGreen: { body: "#4d7c0f", shade: "#365314", eye: "#fde047" },
  oliveGreen: { body: "#5b6e1f", shade: "#3f4d12", eye: "#fde047" },
  poisonGreen: { body: "#65a30d", shade: "#365314", eye: "#bef264" },
  beastBrown: { body: "#a16207", shade: "#713f12", eye: "#fde047" },
  furGray: { body: "#9ca3af", shade: "#4b5563", eye: "#fca5a5" },
  rockGray: { body: "#6b7280", shade: "#374151", eye: "#fbbf24" },
  bone: { body: "#e5e7eb", shade: "#9ca3af", eye: "#1f2937" },
  redCap: { body: "#dc2626", shade: "#991b1b", eye: "#1f2937" },
  demonRed: { body: "#dc2626", shade: "#7f1d1d", eye: "#fde68a" },
  bloodRed: { body: "#b91c1c", shade: "#7f1d1d", eye: "#fef08a" },
  demonPurple: { body: "#7c3aed", shade: "#4c1d95", eye: "#fbcfe8" },
  arcanePurple: { body: "#a855f7", shade: "#6b21a8", eye: "#f5d0fe" },
  aqua: { body: "#0891b2", shade: "#155e75", eye: "#a5f3fc" },
  ghostPale: { body: "#dbeafe", shade: "#93c5fd", eye: "#1e3a8a" },
  shadow: { body: "#334155", shade: "#1e293b", eye: "#f87171" },
  fireOrange: { body: "#f97316", shade: "#c2410c", eye: "#fef08a" },
  iceBlue: { body: "#38bdf8", shade: "#0369a1", eye: "#e0f2fe" },
  gold: { body: "#fbbf24", shade: "#b45309", eye: "#fffbeb" },
};

const BONE = "#e9eaec";
const FANG = "#f8fafc";

type CreatureKind =
  | "slime" | "bat" | "rodent" | "goblinoid" | "spider" | "serpent" | "wolf"
  | "skeleton" | "zombie" | "demon" | "boar" | "ghost" | "mushroom" | "scorpion"
  | "crab" | "bee" | "mummy" | "giant" | "harpy" | "lizard" | "gargoyle"
  | "vampire" | "golem" | "minotaur" | "wisp" | "knight" | "robed" | "tentacle"
  | "dragon" | "bird" | "angel" | "beast";

type CreatureOpt = "one" | "multi" | "crown" | "skull" | "void";

interface EnemyArt {
  kind: CreatureKind;
  pal: keyof typeof CP;
  opt?: CreatureOpt;
}

const ENEMY_ART: Record<string, EnemyArt> = {
  slime: { kind: "slime", pal: "slimeGreen" },
  bat: { kind: "bat", pal: "shadow" },
  rat: { kind: "rodent", pal: "furGray" },
  goblin: { kind: "goblinoid", pal: "goblinGreen" },
  spider: { kind: "spider", pal: "shadow" },
  snake: { kind: "serpent", pal: "poisonGreen" },
  wolf: { kind: "wolf", pal: "furGray" },
  skeleton: { kind: "skeleton", pal: "bone" },
  zombie: { kind: "zombie", pal: "poisonGreen" },
  imp: { kind: "demon", pal: "demonRed" },
  boar: { kind: "boar", pal: "beastBrown" },
  orc: { kind: "goblinoid", pal: "oliveGreen" },
  ghost: { kind: "ghost", pal: "ghostPale" },
  mushroom: { kind: "mushroom", pal: "redCap" },
  scorpion: { kind: "scorpion", pal: "beastBrown" },
  crab: { kind: "crab", pal: "bloodRed" },
  bee: { kind: "bee", pal: "gold" },
  mummy: { kind: "mummy", pal: "bone" },
  cyclops: { kind: "giant", pal: "beastBrown", opt: "one" },
  harpy: { kind: "harpy", pal: "beastBrown" },
  lizardman: { kind: "lizard", pal: "slimeGreen" },
  gargoyle: { kind: "gargoyle", pal: "rockGray" },
  wraith: { kind: "ghost", pal: "shadow" },
  werewolf: { kind: "wolf", pal: "shadow" },
  vampire: { kind: "vampire", pal: "shadow" },
  golem: { kind: "golem", pal: "rockGray" },
  troll: { kind: "giant", pal: "goblinGreen" },
  minotaur: { kind: "minotaur", pal: "beastBrown" },
  wisp: { kind: "wisp", pal: "iceBlue" },
  slimeking: { kind: "slime", pal: "slimeTeal", opt: "crown" },
  banshee: { kind: "ghost", pal: "ghostPale" },
  chimera: { kind: "beast", pal: "beastBrown", opt: "multi" },
  basilisk: { kind: "serpent", pal: "poisonGreen" },
  wyvern: { kind: "dragon", pal: "oliveGreen" },
  ogremage: { kind: "robed", pal: "demonPurple" },
  darkknight: { kind: "knight", pal: "shadow" },
  lich: { kind: "robed", pal: "ghostPale", opt: "skull" },
  behemoth: { kind: "giant", pal: "beastBrown" },
  kraken: { kind: "tentacle", pal: "aqua" },
  phoenix: { kind: "bird", pal: "fireOrange" },
  cerberus: { kind: "wolf", pal: "shadow", opt: "multi" },
  manticore: { kind: "beast", pal: "bloodRed" },
  djinn: { kind: "wisp", pal: "arcanePurple" },
  hydra: { kind: "dragon", pal: "poisonGreen", opt: "multi" },
  titan: { kind: "giant", pal: "rockGray" },
  specter: { kind: "ghost", pal: "shadow" },
  nightmare: { kind: "demon", pal: "shadow" },
  seraph: { kind: "angel", pal: "gold" },
  leviathan: { kind: "tentacle", pal: "aqua" },
  voidlord: { kind: "robed", pal: "shadow", opt: "void" },
  // bosses
  boss_ogre: { kind: "giant", pal: "demonRed" },
  boss_dragon: { kind: "dragon", pal: "demonRed" },
  boss_lich: { kind: "robed", pal: "ghostPale", opt: "skull" },
  boss_golem: { kind: "golem", pal: "rockGray" },
  boss_demon: { kind: "demon", pal: "demonPurple" },
  boss_leviathan: { kind: "tentacle", pal: "aqua" },
};

function eyes(g: Grid, x0: number, x1: number, y: number, c: string) {
  set(g, x0, y, c);
  set(g, x1, y, c);
}

// eslint-disable-next-line complexity
function drawCreature(g: Grid, kind: CreatureKind, p: CreaturePalette, opt?: CreatureOpt) {
  const { body, shade, eye } = p;
  switch (kind) {
    case "slime": {
      disc(g, 8, 10, 5, body);
      rect(g, 3, 13, 13, 13, shade);
      set(g, 6, 8, "#ffffff"); // shine
      eyes(g, 6, 10, 10, eye);
      hline(g, 7, 9, 12, shade); // mouth
      break;
    }
    case "bat": {
      disc(g, 8, 8, 2, body);
      set(g, 6, 5, body); set(g, 10, 5, body); // ears
      hline(g, 1, 5, 7, body); hline(g, 11, 15, 7, body); // wings
      hline(g, 2, 5, 8, shade); hline(g, 10, 13, 8, shade);
      set(g, 1, 6, body); set(g, 14, 6, body);
      eyes(g, 7, 8, 8, eye);
      break;
    }
    case "rodent": {
      disc(g, 7, 10, 3, body); // body
      disc(g, 11, 9, 2, body); // head
      set(g, 10, 6, body); set(g, 12, 6, body); // ears
      set(g, 13, 9, eye);
      set(g, 13, 10, shade); // snout
      set(g, 4, 11, shade); set(g, 3, 10, shade); set(g, 2, 10, shade); set(g, 1, 9, shade); // tail
      set(g, 6, 13, shade); set(g, 9, 13, shade);
      break;
    }
    case "goblinoid": {
      disc(g, 8, 6, 3, body); // head
      set(g, 3, 5, body); set(g, 4, 5, body); // ears
      set(g, 12, 5, body); set(g, 13, 5, body);
      eyes(g, 7, 9, 6, eye);
      set(g, 8, 8, shade); // nose
      set(g, 7, 9, FANG); set(g, 9, 9, FANG); // tusks
      rect(g, 6, 9, 10, 12, body); // torso
      set(g, 5, 10, shade); set(g, 11, 10, shade); // arms
      vline(g, 6, 13, 14, shade); vline(g, 10, 13, 14, shade);
      break;
    }
    case "spider": {
      disc(g, 8, 10, 3, body);
      disc(g, 8, 6, 1, body);
      eyes(g, 7, 9, 6, eye);
      for (let i = 0; i < 3; i++) {
        const y = 8 + i * 2;
        set(g, 4, y, shade); set(g, 3, y + 1, shade);
        set(g, 12, y, shade); set(g, 13, y + 1, shade);
      }
      break;
    }
    case "serpent": {
      const path: [number, number][] = [
        [8, 14], [8, 13], [7, 12], [6, 11], [6, 10], [7, 9], [8, 8], [9, 7], [9, 6],
      ];
      for (const [x, y] of path) { set(g, x, y, body); set(g, x + 1, y, shade); }
      disc(g, 8, 4, 2, body); // head
      eyes(g, 7, 9, 4, eye);
      set(g, 8, 2, "#ef4444"); set(g, 8, 1, "#ef4444"); // tongue
      break;
    }
    case "wolf": {
      rect(g, 4, 8, 11, 11, body);
      disc(g, 4, 7, 2, body); // head left
      set(g, 2, 5, body); set(g, 3, 5, body); // ear
      set(g, 3, 7, eye);
      set(g, 1, 8, shade); // snout
      set(g, 12, 7, body); set(g, 13, 6, body); // tail
      vline(g, 5, 12, 14, shade); vline(g, 8, 12, 13, shade); vline(g, 10, 12, 14, shade);
      if (opt === "multi") { disc(g, 9, 6, 1, body); set(g, 10, 6, eye); } // extra head
      break;
    }
    case "skeleton": {
      disc(g, 8, 6, 3, body); // skull
      set(g, 6, 6, shade); set(g, 10, 6, shade); // sockets
      set(g, 8, 8, shade);
      hline(g, 6, 10, 9, body); // jaw
      vline(g, 8, 10, 14, body); // spine
      hline(g, 6, 10, 11, body); hline(g, 6, 10, 13, body); // ribs
      break;
    }
    case "zombie": {
      disc(g, 8, 5, 2, body);
      set(g, 7, 5, eye); set(g, 9, 5, shade); // uneven eyes
      rect(g, 6, 7, 10, 12, body);
      set(g, 5, 8, body); set(g, 4, 8, body); set(g, 3, 8, shade); // arm out
      set(g, 8, 9, shade); // stitch
      vline(g, 6, 13, 14, shade); vline(g, 10, 13, 14, shade);
      break;
    }
    case "demon": {
      disc(g, 8, 6, 2, body);
      set(g, 5, 4, body); set(g, 5, 3, shade); // horns
      set(g, 11, 4, body); set(g, 11, 3, shade);
      eyes(g, 7, 9, 6, eye);
      rect(g, 6, 8, 10, 11, body);
      set(g, 4, 7, shade); set(g, 3, 8, shade); // wings
      set(g, 12, 7, shade); set(g, 13, 8, shade);
      set(g, 11, 12, shade); set(g, 12, 13, shade); // tail
      vline(g, 6, 12, 13, shade); vline(g, 10, 12, 13, shade);
      break;
    }
    case "boar": {
      rect(g, 4, 9, 12, 11, body);
      disc(g, 8, 9, 3, body);
      disc(g, 4, 9, 2, body); // snout head
      set(g, 2, 9, shade);
      set(g, 2, 10, FANG); // tusk
      set(g, 4, 8, eye);
      set(g, 7, 5, shade); set(g, 8, 4, shade); set(g, 9, 5, shade); // bristles
      vline(g, 6, 12, 14, shade); vline(g, 10, 12, 14, shade);
      break;
    }
    case "ghost": {
      disc(g, 8, 7, 4, body);
      rect(g, 4, 7, 12, 12, body);
      for (const x of [4, 6, 8, 10, 12]) set(g, x, 13, body); // wavy hem
      eyes(g, 6, 10, 7, eye);
      set(g, 8, 9, eye); // mouth
      break;
    }
    case "mushroom": {
      disc(g, 8, 6, 4, body);
      rect(g, 4, 6, 12, 7, body); // cap
      set(g, 6, 5, "#fff7ed"); set(g, 10, 6, "#fff7ed"); set(g, 8, 4, "#fff7ed"); // spots
      rect(g, 7, 8, 9, 13, "#f5e6c8"); // stem
      eyes(g, 7, 9, 10, shade); // little eyes on stem
      break;
    }
    case "scorpion": {
      disc(g, 7, 10, 3, body);
      set(g, 4, 8, body); set(g, 3, 9, body); set(g, 2, 8, shade); // left claw
      set(g, 4, 12, body); set(g, 3, 12, shade);
      set(g, 10, 9, body); set(g, 11, 8, body); set(g, 12, 7, body); set(g, 12, 6, body); set(g, 11, 5, body); // tail
      set(g, 11, 4, "#ef4444"); // stinger
      set(g, 5, 13, shade); set(g, 7, 13, shade); set(g, 9, 13, shade); // legs
      eyes(g, 6, 8, 9, eye);
      break;
    }
    case "crab": {
      disc(g, 8, 9, 4, body);
      rect(g, 4, 9, 12, 11, body);
      vline(g, 6, 5, 7, shade); set(g, 6, 5, eye); // eyestalks
      vline(g, 10, 5, 7, shade); set(g, 10, 5, eye);
      set(g, 2, 9, body); set(g, 1, 9, body); set(g, 1, 8, shade); // claws
      set(g, 14, 9, body); set(g, 15, 9, body); set(g, 15, 8, shade);
      set(g, 4, 12, shade); set(g, 6, 12, shade); set(g, 10, 12, shade); set(g, 12, 12, shade); // legs
      break;
    }
    case "bee": {
      disc(g, 8, 9, 3, body);
      hline(g, 6, 10, 8, shade); hline(g, 6, 10, 10, shade); // stripes
      disc(g, 8, 5, 1, shade); // head
      set(g, 5, 6, "#e0f2fe"); set(g, 6, 6, "#e0f2fe"); // wings
      set(g, 10, 6, "#e0f2fe"); set(g, 11, 6, "#e0f2fe");
      set(g, 8, 13, shade); // stinger
      eyes(g, 7, 5, 5, eye);
      break;
    }
    case "mummy": {
      disc(g, 8, 5, 2, body);
      rect(g, 6, 7, 10, 13, body);
      set(g, 8, 5, shade); // single eye glint
      hline(g, 6, 10, 8, shade); hline(g, 6, 10, 11, shade); set(g, 7, 12, shade); set(g, 9, 10, shade); // bandages
      set(g, 5, 8, body); set(g, 4, 8, body); set(g, 11, 8, body); set(g, 12, 8, body); // arms out
      break;
    }
    case "giant": {
      disc(g, 8, 5, 3, body); // big head
      if (opt === "one") { disc(g, 8, 5, 1, eye); set(g, 8, 5, shade); }
      else eyes(g, 7, 9, 5, eye);
      rect(g, 5, 8, 11, 13, body); // torso
      vline(g, 4, 9, 12, shade); vline(g, 12, 9, 12, shade); // arms
      vline(g, 6, 14, 15, shade); vline(g, 10, 14, 15, shade); // legs
      break;
    }
    case "harpy": {
      disc(g, 8, 5, 2, body);
      eyes(g, 7, 9, 5, eye);
      rect(g, 7, 7, 9, 11, body); // slim torso
      for (let i = 0; i < 4; i++) { set(g, 6 - i, 7 + i, shade); set(g, 10 + i, 7 + i, shade); } // wings
      set(g, 7, 12, "#fbbf24"); set(g, 9, 12, "#fbbf24"); // talons
      break;
    }
    case "lizard": {
      disc(g, 7, 5, 2, body);
      set(g, 9, 5, shade); set(g, 10, 5, shade); // snout
      set(g, 6, 5, eye);
      set(g, 8, 3, shade); set(g, 7, 4, shade); // crest
      rect(g, 6, 7, 9, 11, body); // torso
      set(g, 10, 11, body); set(g, 11, 12, body); set(g, 12, 12, shade); set(g, 13, 13, shade); // tail
      vline(g, 6, 12, 14, shade); vline(g, 9, 12, 14, shade);
      break;
    }
    case "gargoyle": {
      disc(g, 8, 6, 2, body);
      set(g, 6, 4, shade); set(g, 10, 4, shade); // horns
      eyes(g, 7, 9, 6, eye);
      rect(g, 6, 8, 10, 11, body);
      set(g, 4, 7, shade); set(g, 3, 7, shade); set(g, 3, 8, shade); // stone wings
      set(g, 11, 7, shade); set(g, 12, 7, shade); set(g, 12, 8, shade);
      vline(g, 6, 12, 13, shade); vline(g, 10, 12, 13, shade);
      break;
    }
    case "vampire": {
      disc(g, 8, 5, 2, "#e5e7eb"); // pale face
      set(g, 7, 5, eye); set(g, 9, 5, eye);
      set(g, 7, 7, FANG); set(g, 9, 7, FANG); // fangs
      set(g, 5, 6, "#b91c1c"); set(g, 11, 6, "#b91c1c"); // collar
      rect(g, 6, 7, 10, 13, body);
      set(g, 4, 8, shade); set(g, 3, 9, shade); set(g, 12, 8, shade); set(g, 13, 9, shade); // cape
      break;
    }
    case "golem": {
      rect(g, 4, 4, 11, 13, body);
      set(g, 3, 5, shade); set(g, 12, 5, shade); // shoulders
      eyes(g, 6, 9, 7, eye); // glowing eyes
      set(g, 8, 6, shade); set(g, 8, 7, shade); set(g, 7, 10, shade); set(g, 9, 11, shade); // cracks
      rect(g, 5, 14, 6, 15, shade); rect(g, 9, 14, 10, 15, shade);
      break;
    }
    case "minotaur": {
      disc(g, 8, 5, 3, body);
      set(g, 3, 4, BONE); set(g, 4, 4, BONE); set(g, 12, 4, BONE); set(g, 13, 4, BONE); // horns
      eyes(g, 7, 9, 5, eye);
      set(g, 8, 7, shade); // snout
      rect(g, 5, 8, 11, 12, body);
      vline(g, 4, 9, 11, shade); vline(g, 12, 9, 11, shade);
      vline(g, 6, 13, 14, shade); vline(g, 10, 13, 14, shade);
      break;
    }
    case "wisp": {
      disc(g, 8, 7, 3, body);
      ring(g, 8, 7, 4, shade);
      set(g, 8, 7, "#ffffff"); // bright core
      set(g, 8, 12, body); set(g, 7, 13, shade); set(g, 9, 11, body); set(g, 6, 11, shade); set(g, 11, 9, body); // sparks
      break;
    }
    case "knight": {
      rect(g, 6, 3, 10, 7, body); // helmet
      hline(g, 6, 10, 5, eye); // visor glow
      set(g, 8, 2, "#ef4444"); // plume
      rect(g, 5, 8, 10, 13, body); // armour
      vline(g, 12, 3, 9, BONE); set(g, 12, 10, shade); hline(g, 11, 13, 10, shade); // sword
      vline(g, 6, 14, 15, shade); vline(g, 9, 14, 15, shade);
      break;
    }
    case "robed": {
      disc(g, 8, 5, 3, body); // hood
      const face = opt === "skull" ? "#e5e7eb" : shade;
      set(g, 8, 5, face);
      set(g, 7, 6, eye); set(g, 9, 6, eye); // eyes in hood
      if (opt === "skull") { set(g, 8, 7, "#9ca3af"); }
      for (let y = 8; y <= 14; y++) hline(g, 8 - (y - 7), 8 + (y - 7), y, body); // robe
      vline(g, 13, 3, 14, "#a16207"); // staff
      const orb = opt === "void" ? "#000000" : eye;
      disc(g, 13, 3, 1, orb);
      if (opt === "void") ring(g, 13, 3, 1, "#a855f7");
      break;
    }
    case "tentacle": {
      disc(g, 8, 6, 4, body); // mantle
      eyes(g, 6, 10, 6, eye);
      for (const x of [4, 6, 8, 10, 12]) { vline(g, x, 10, 13, body); set(g, x, 14, shade); } // tentacles
      set(g, 3, 13, shade); set(g, 13, 13, shade);
      break;
    }
    case "dragon": {
      disc(g, 6, 10, 3, body); // body
      set(g, 8, 8, body); set(g, 9, 7, body); set(g, 10, 6, body); // neck
      disc(g, 12, 5, 2, body); set(g, 14, 5, shade); // head + snout
      set(g, 11, 5, eye);
      set(g, 4, 6, shade); set(g, 3, 5, shade); set(g, 5, 7, shade); set(g, 2, 6, shade); // wing
      set(g, 3, 12, body); set(g, 2, 13, shade); // tail
      set(g, 5, 13, shade); set(g, 8, 13, shade); // legs
      if (opt === "multi") { set(g, 9, 9, body); set(g, 10, 9, body); disc(g, 11, 9, 1, body); set(g, 12, 9, eye); } // 2nd head
      break;
    }
    case "bird": {
      disc(g, 8, 7, 2, body);
      set(g, 8, 4, body); set(g, 8, 3, shade); // crest
      set(g, 9, 5, "#1f2937"); set(g, 10, 6, "#fbbf24"); // eye + beak
      set(g, 6, 7, body); set(g, 5, 6, body); set(g, 4, 5, shade); // left wing
      set(g, 10, 7, body); set(g, 11, 6, body); set(g, 12, 5, shade); // right wing
      set(g, 7, 10, body); set(g, 9, 10, body); set(g, 8, 11, shade); set(g, 8, 12, body); // tail
      break;
    }
    case "angel": {
      ring(g, 8, 2, 1, "#fbbf24"); // halo
      disc(g, 8, 5, 2, body);
      set(g, 7, 5, shade); set(g, 9, 5, shade);
      rect(g, 7, 7, 9, 12, body); // robe
      set(g, 5, 7, BONE); set(g, 4, 7, BONE); set(g, 4, 8, BONE); set(g, 3, 8, BONE); // wings
      set(g, 11, 7, BONE); set(g, 12, 7, BONE); set(g, 12, 8, BONE); set(g, 13, 8, BONE);
      break;
    }
    case "beast": {
      rect(g, 4, 8, 11, 11, body);
      ring(g, 11, 7, 2, shade); disc(g, 11, 7, 1, body); // maned head right
      set(g, 12, 7, eye);
      set(g, 3, 8, body); set(g, 2, 7, shade); // tail tuft
      vline(g, 5, 12, 14, shade); vline(g, 10, 12, 14, shade);
      if (opt === "multi") { disc(g, 5, 6, 1, body); set(g, 5, 6, eye); } // extra head
      break;
    }
  }
}

/** 機神デウス＝エクス＝マキナ: a flashy dice × machine-god boss sprite. */
function drawDeus(g: Grid): void {
  const gold = "#fbbf24";
  const goldL = "#fde68a";
  const black = "#1c1917";
  const cyan = "#22d3ee";
  const red = "#f87171";
  // radiant gear ring + teeth
  ring(g, 8, 8, 7, gold);
  for (const [x, y] of [[8, 0], [8, 15], [0, 8], [15, 8], [2, 2], [13, 2], [2, 13], [13, 13], [5, 0], [11, 0]] as const) set(g, x, y, gold);
  // dark machine core
  disc(g, 8, 8, 6, black);
  ring(g, 8, 8, 6, goldL);
  // central golden die (face "5") — the dice god's core
  rect(g, 5, 5, 11, 11, gold);
  rect(g, 6, 6, 10, 10, black);
  for (const [x, y] of [[7, 7], [9, 7], [7, 9], [9, 9]] as const) set(g, x, y, goldL); // 4 corner pips
  set(g, 8, 8, red); // burning central pip (eye)
  // cyan energy accents at the cardinal points
  set(g, 8, 3, cyan); set(g, 3, 8, cyan); set(g, 13, 8, cyan); set(g, 8, 13, cyan);
  // glowing top "crown" horns of gold
  set(g, 4, 1, goldL); set(g, 12, 1, goldL);
}

function buildEnemyGrid(spec: EnemyIconSpec): Grid {
  const g = blank();
  if (spec.templateId === "deus") {
    drawDeus(g);
    return g;
  }
  const art = ENEMY_ART[spec.templateId] ?? { kind: "beast", pal: "furGray" };
  drawCreature(g, art.kind, CP[art.pal], art.opt);
  // Bosses wear a small golden crown.
  if (spec.isBoss || art.opt === "crown") {
    const gold = "#fbbf24";
    set(g, 5, 1, gold); set(g, 8, 0, gold); set(g, 11, 1, gold);
    hline(g, 5, 11, 2, gold);
  }
  // ★ aura: a sparse glow ring for modified enemies.
  if (spec.modTier > 0) {
    const glow = spec.modTier >= 3 ? "#f59e0b" : spec.modTier === 2 ? "#a855f7" : "#38bdf8";
    for (const [x, y] of [[1, 4], [14, 4], [2, 12], [13, 12], [8, 1]] as const) set(g, x, y, glow);
  }
  return g;
}

/** Render an enemy/boss icon to a cached base64 data URL. */
export function getEnemyIconDataUrl(spec: EnemyIconSpec): string {
  const key = ["enemy", spec.templateId, spec.isBoss ? "b" : "", spec.bossRank ?? 0, spec.modTier, spec.seed].join("|");
  return renderToCache(key, () => buildEnemyGrid(spec));
}
