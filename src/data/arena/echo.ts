import type { GameMode, MonsterBuild } from "@/types/arena";

/**
 * 残響戦（アリーナ版）。
 * - プレイヤーの「残響」＝直近に到達した編成のスナップショット（勝敗時に記録）。
 * - 「名のある残響」＝ゴースト編成（curated）。自分の残響 vs ゴーストの観戦デュエル。
 */

export interface EchoSnapshot {
  id: string;
  builds: MonsterBuild[];
  operatorId: string;
  blessings: string[];
  label: string; // 「ショート10勝の残響」等
  power: number; // 記録時の総合力★（任意・表示用）
  ts: number; // 記録時刻（新しい順表示用）
}

export interface EchoGhost {
  id: string;
  name: string;
  flavor: string;
  tier: number; // 1(易)〜5(難)
  operatorId: string;
  field: import("@/types/arena").FieldId;
  blessings: string[];
  builds: MonsterBuild[];
}

const b = (monsterId: string, equipmentIds: string[], skillIds: string[]): MonsterBuild => ({
  monsterId,
  equipmentIds,
  skillIds,
});

/** 名のある残響（三すくみと難度を意識した5体）。 */
export const ECHO_GHOSTS: readonly EchoGhost[] = [
  {
    id: "verdant_echo",
    name: "翠緑の残響",
    flavor: "森に根を張り、毒と再生で相手を枯らした緑の使い手の記憶。",
    tier: 1,
    operatorId: "verdant",
    field: "forest",
    blessings: ["regen", "def"],
    builds: [
      b("moss_golem", ["iron_wall", "life_orb"], ["taunt_roar", "guard_stance"]),
      b("elder_treant", ["sacred_crown"], ["regen_wind", "healing_light"]),
      b("venom_toad", ["venom_fang"], ["venom_bite", "poison_mist"]),
    ],
  },
  {
    id: "crimson_echo",
    name: "紅蓮の残響",
    flavor: "全てを焼き払う速攻で名を馳せた赤の猛者の残り火。",
    tier: 2,
    operatorId: "pyroseer",
    field: "volcano",
    blessings: ["atk", "ember"],
    builds: [
      b("ember_imp", ["berserk_axe", "blaze_ring"], ["flame_slash", "heavy_blow"]),
      b("magma_beast", ["steel_sword"], ["area_blast", "meteor"]),
      b("blade_dancer", ["crit_scope"], ["pinpoint", "follow_up"]),
    ],
  },
  {
    id: "azure_echo",
    name: "蒼天の残響",
    flavor: "誰よりも速く、誰よりも巡る。青の術理を極めた者の残響。",
    tier: 3,
    operatorId: "conductor",
    field: "thunder",
    blessings: ["spd", "cdr"],
    builds: [
      b("storm_hawk", ["combo_gauntlet", "swift_boots"], ["chain_thunder", "follow_up"]),
      b("tide_mage", ["haste_charm"], ["haste_order", "dark_bolt"]),
      b("frost_sprite", ["mirror_shield"], ["ice_lance", "barrier_song"]),
    ],
  },
  {
    id: "prism_echo",
    name: "三彩の残響",
    flavor: "緑・青・赤の役割を完璧に束ねた、調和の指揮者の記憶。",
    tier: 4,
    operatorId: "calibrator",
    field: "ruins",
    blessings: ["hp", "atk", "def"],
    builds: [
      b("moss_golem", ["iron_wall", "thorn_mail"], ["taunt_roar", "guard_stance"]),
      b("tide_mage", ["sacred_crown"], ["healing_light", "haste_order"]),
      b("scorch_drake", ["berserk_axe", "crit_scope"], ["flame_slash", "heavy_blow", "meteor"]),
    ],
  },
  {
    id: "machina_echo",
    name: "機神の残響",
    flavor: "ダイスの深淵に最も近づいた者。全てを兼ね備えた最強の残響。",
    tier: 5,
    operatorId: "warden",
    field: "sanctuary",
    blessings: ["hp", "def", "atk", "ember", "phoenix"],
    builds: [
      b("bramble_beast", ["iron_wall", "life_orb", "thorn_mail"], ["taunt_roar", "guard_stance"]),
      b("elder_treant", ["sacred_crown", "guard_charm"], ["healing_light", "regen_wind", "barrier_song"]),
      b("magma_beast", ["berserk_axe", "blaze_ring", "crit_scope"], ["meteor", "heavy_blow", "area_blast"]),
    ],
  },
];

/**
 * 👑 レジェンド残響。
 * 終盤ラン相当の「フルビルド」20体＋実オンライン残響を全フィールド×総当りで
 * 対戦させたトーナメントの優勝者（勝率97.6%・★318）。装備と祝福を限界まで
 * 積み上げた不滅の三重壁が、不死鳥・再生・反射・毒で相手を枯らし尽くす。
 * オンラインの実プレイヤー残響にも打ち勝つ、真の頂点。tier 6 として特別表示。
 */
export const LEGEND_ECHO: EchoGhost = {
  id: "legend_echo",
  name: "👑 レジェンド残響",
  flavor: "全構築の頂点。積み上げた不滅の三重壁が、不死鳥と再生と反射で全てを呑み込む。オンラインの猛者すら退けた優勝者の記憶。",
  tier: 6,
  operatorId: "warden",
  field: "ruins",
  blessings: ["phoenix", "def", "regen", "hp", "shield", "phoenix", "def", "regen", "hp", "heal", "shield", "def", "hp", "regen"],
  builds: [
    b(
      "moss_golem",
      ["iron_wall", "mirror_shield", "thorn_mail", "life_orb", "sacred_crown", "guard_charm", "phoenix_feather", "iron_wall", "mirror_shield", "thorn_mail", "life_orb", "sacred_crown", "guard_charm", "phoenix_feather", "iron_wall", "mirror_shield"],
      ["taunt_roar", "guard_stance", "barrier_song", "healing_light", "regen_wind", "mirror_barrier", "taunt_roar", "guard_stance", "barrier_song"],
    ),
    b(
      "bramble_beast",
      ["venom_fang", "thorn_mail", "life_orb", "sacred_crown", "guard_charm", "iron_wall", "mirror_shield", "thorn_mail", "life_orb", "sacred_crown", "guard_charm", "phoenix_feather", "venom_fang", "thorn_mail"],
      ["poison_mist", "bleed_strike", "venom_bite", "healing_light", "regen_wind", "taunt_roar", "guard_stance", "barrier_song", "healing_light", "regen_wind"],
    ),
    b(
      "elder_treant",
      ["iron_wall", "mirror_shield", "thorn_mail", "life_orb", "sacred_crown", "guard_charm", "phoenix_feather", "iron_wall", "mirror_shield", "thorn_mail", "life_orb", "sacred_crown", "guard_charm"],
      ["taunt_roar", "guard_stance", "barrier_song", "healing_light", "regen_wind", "mirror_barrier", "taunt_roar", "guard_stance", "barrier_song"],
    ),
  ],
};

export function getGhost(id: string): EchoGhost | undefined {
  return [...ECHO_GHOSTS, LEGEND_ECHO].find((g) => g.id === id);
}

// ---- プレイヤーの残響ギャラリー（localStorage・複数保存） ----
const GALLERY_KEY = "arena-echo-gallery-v1";
const LEGACY_SELF_KEY = "arena-echo-self-v1";
const CLEAR_KEY = "arena-echo-clears-v1";
const MAX_GALLERY = 6;

export function loadEchoGallery(): EchoSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GALLERY_KEY);
    if (raw) return JSON.parse(raw) as EchoSnapshot[];
    // 旧・単体キーからの移行
    const legacy = window.localStorage.getItem(LEGACY_SELF_KEY);
    if (legacy) {
      const s = JSON.parse(legacy) as Partial<EchoSnapshot>;
      const migrated: EchoSnapshot = {
        id: "legacy",
        builds: s.builds ?? [],
        operatorId: s.operatorId ?? "calibrator",
        blessings: s.blessings ?? [],
        label: s.label ?? "過去の残響",
        power: s.power ?? 0,
        ts: 0,
      };
      return migrated.builds.length ? [migrated] : [];
    }
    return [];
  } catch {
    return [];
  }
}

/** 新しい残響をギャラリー先頭に追加（上限 MAX_GALLERY、古いものを破棄）。 */
export function addEchoToGallery(snap: Omit<EchoSnapshot, "id" | "ts">): EchoSnapshot[] {
  if (typeof window === "undefined") return [];
  const list = loadEchoGallery();
  const entry: EchoSnapshot = {
    ...snap,
    id: `e${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    ts: Date.now(),
  };
  const next = [entry, ...list].slice(0, MAX_GALLERY);
  try {
    window.localStorage.setItem(GALLERY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function deleteEcho(id: string): EchoSnapshot[] {
  const next = loadEchoGallery().filter((e) => e.id !== id);
  try {
    window.localStorage.setItem(GALLERY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function loadEchoClears(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLEAR_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** ゴースト撃破を記録し、全クリアID配列を返す。 */
export function recordEchoClear(ghostId: string): string[] {
  const cur = loadEchoClears();
  if (cur.includes(ghostId)) return cur;
  const next = [...cur, ghostId];
  try {
    window.localStorage.setItem(CLEAR_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function labelForRun(mode: GameMode, wins: number): string {
  return `${mode === "short" ? "ショート" : "ロング"} ${wins}勝の残響`;
}
