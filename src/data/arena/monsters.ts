import type { MonsterColor, MonsterDef } from "@/types/arena";

/**
 * 3v3 で実際に戦うユニット。Dice Ex Machina の世界観（出目・装備・ダンジョン）を
 * ベースにした使役モンスター。色は役割の大分類：
 *   green = 耐久/再生/毒/防御, blue = 速度/支援/制御/CT短縮, red = 火力/炎上/クリ/追撃
 */
export const MONSTERS: readonly MonsterDef[] = [
  // ---- Green ----
  {
    id: "moss_golem",
    name: "苔むす石巨人",
    emoji: "🪨",
    color: "green",
    role: "壁役 / 耐久",
    hp: 160,
    attack: 13,
    defense: 11,
    speed: 7,
    palette: ["#14532d", "#4ade80", "#bbf7d0"],
    desc: "ダンジョンの瓦礫が苔をまとい動き出した守り手。打たれ強い。",
  },
  {
    id: "venom_toad",
    name: "毒沼の大蟇",
    emoji: "🐸",
    color: "green",
    role: "毒 / 継続",
    hp: 115,
    attack: 16,
    defense: 6,
    speed: 10,
    palette: ["#166534", "#65a30d", "#d9f99d"],
    desc: "舌の一打に猛毒を乗せる。長期戦でじわじわ削る。",
  },
  {
    id: "elder_treant",
    name: "古樹の番人",
    emoji: "🌳",
    color: "green",
    role: "再生 / 支援",
    hp: 135,
    attack: 12,
    defense: 8,
    speed: 8,
    palette: ["#3f6212", "#84cc16", "#ecfccb"],
    desc: "根を張り味方を癒やす。倒れにくく、戦線を支える。",
  },
  // ---- Blue ----
  {
    id: "frost_sprite",
    name: "氷晶の精",
    emoji: "❄️",
    color: "blue",
    role: "支援 / 制御",
    hp: 115,
    attack: 13,
    defense: 8,
    speed: 13,
    palette: ["#1e3a8a", "#38bdf8", "#e0f2fe"],
    desc: "冷気で敵を鈍らせ、味方の術式を加速する小さな精霊。",
  },
  {
    id: "storm_hawk",
    name: "雷羽の隼",
    emoji: "🦅",
    color: "blue",
    role: "速度 / 連撃",
    hp: 108,
    attack: 17,
    defense: 7,
    speed: 17,
    palette: ["#1e40af", "#60a5fa", "#dbeafe"],
    desc: "最速の手数で先手を取る。雷雲では追撃が止まらない。",
  },
  {
    id: "tide_mage",
    name: "潮詠みの術士",
    emoji: "🌀",
    color: "blue",
    role: "制御 / CT短縮",
    hp: 122,
    attack: 14,
    defense: 8,
    speed: 12,
    palette: ["#155e75", "#22d3ee", "#cffafe"],
    desc: "潮の流れを読み、味方の技の巡りを早める。",
  },
  // ---- Red ----
  {
    id: "ember_imp",
    name: "焔の小鬼",
    emoji: "🔥",
    color: "red",
    role: "火力 / 炎上",
    hp: 90,
    attack: 22,
    defense: 4,
    speed: 12,
    palette: ["#7f1d1d", "#f97316", "#fed7aa"],
    desc: "触れるものを焼く悪戯者。火傷の継続火力が持ち味。",
  },
  {
    id: "magma_beast",
    name: "熔岩の獣",
    emoji: "🌋",
    color: "red",
    role: "爆発 / 範囲",
    hp: 120,
    attack: 20,
    defense: 6,
    speed: 9,
    palette: ["#7c2d12", "#ea580c", "#fdba74"],
    desc: "全身の熔岩を爆ぜさせて複数の敵を巻き込む。",
  },
  {
    id: "blade_dancer",
    name: "紅刃の舞手",
    emoji: "🗡️",
    color: "red",
    role: "クリ / 追撃",
    hp: 95,
    attack: 19,
    defense: 5,
    speed: 14,
    palette: ["#881337", "#fb7185", "#fecdd3"],
    desc: "急所を突く一閃の達人。クリティカルで一気に崩す。",
  },
  // ---- 追加モンスター（#182） ----
  {
    id: "bramble_beast",
    name: "茨の獣",
    emoji: "🦔",
    color: "green",
    role: "毒 / 防御",
    hp: 145,
    attack: 15,
    defense: 9,
    speed: 8,
    palette: ["#14532d", "#16a34a", "#bbf7d0"],
    desc: "毒棘をまとう巨躯。前線で殴り合いながら毒を撒く。",
  },
  {
    id: "mist_oracle",
    name: "霧の巫女",
    emoji: "🌫️",
    color: "blue",
    role: "支援 / 制御",
    hp: 118,
    attack: 12,
    defense: 8,
    speed: 13,
    palette: ["#0c4a6e", "#0ea5e9", "#bae6fd"],
    desc: "霧をまとう精霊。敵を惑わせ味方を支える。",
  },
  {
    id: "scorch_drake",
    name: "灼炎竜",
    emoji: "🐉",
    color: "red",
    role: "火力 / 炎上",
    hp: 110,
    attack: 21,
    defense: 6,
    speed: 11,
    palette: ["#7c2d12", "#f97316", "#fed7aa"],
    desc: "焔をまとう若竜。広範囲を焼き尽くす火力の塊。",
  },
];

export const MONSTER_MAP: Record<string, MonsterDef> = Object.fromEntries(
  MONSTERS.map((m) => [m.id, m]),
);

export function getMonster(id: string): MonsterDef {
  return MONSTER_MAP[id];
}

export const COLOR_LABEL: Record<MonsterColor, string> = {
  green: "緑",
  blue: "青",
  red: "赤",
};

export const COLOR_DOT: Record<MonsterColor, string> = {
  green: "🟢",
  blue: "🔵",
  red: "🔴",
};
