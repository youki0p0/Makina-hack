import type { FieldDef, FieldId } from "@/types/arena";

/** 6種のフィールド。技の効果そのものを書き換える舞台。 */
export const FIELDS: readonly FieldDef[] = [
  {
    id: "forest",
    name: "森フィールド",
    emoji: "🌲",
    theme: "毒 / 再生 / 長期戦",
    background: "linear-gradient(165deg,#0b2e1a 0%,#14532d 60%,#04210f 100%)",
    accent: "#4ade80",
    desc: "毒が拡散しやすく、回復に再生が宿る。火炎技は延焼して毒を呼ぶ。",
  },
  {
    id: "volcano",
    name: "火山フィールド",
    emoji: "🌋",
    theme: "火傷 / 爆発 / 範囲",
    background: "linear-gradient(165deg,#2a0a06 0%,#7c2d12 55%,#180402 100%)",
    accent: "#fb7185",
    desc: "火炎技が範囲化し、爆発が強まる。斬撃は噴火となって周囲を焼く。",
  },
  {
    id: "rain",
    name: "雨フィールド",
    emoji: "🌧️",
    theme: "弱体 / 防御 / 妨害",
    background: "linear-gradient(165deg,#0a1626 0%,#1e3a5f 55%,#060d18 100%)",
    accent: "#60a5fa",
    desc: "火炎は蒸気と化し暗闇・鈍足を撒く。防御技と回復技が冴える。",
  },
  {
    id: "thunder",
    name: "雷雲フィールド",
    emoji: "⛈️",
    theme: "速度 / 連撃 / リスク",
    background: "linear-gradient(165deg,#1a1230 0%,#4338ca 55%,#0a0718 100%)",
    accent: "#a78bfa",
    desc: "加速が強化され追撃が走る。だが力には防御低下の代償が付く。",
  },
  {
    id: "ruins",
    name: "遺跡フィールド",
    emoji: "🏛️",
    theme: "防御 / 反射 / 貫通",
    background: "linear-gradient(165deg,#1c1a14 0%,#57534e 55%,#0a0907 100%)",
    accent: "#d6d3d1",
    desc: "防御に反射が宿り、重撃と貫通が防御を無視する。",
  },
  {
    id: "sanctuary",
    name: "霊場フィールド",
    emoji: "⛩️",
    theme: "回復 / 復活 / 呪い",
    background: "linear-gradient(165deg,#241026 0%,#831843 55%,#10040f 100%)",
    accent: "#f0abfc",
    desc: "回復が増幅され、倒れても一度だけ蘇る保険が宿る。呪いも濃くなる。",
  },
];

export const FIELD_MAP: Record<FieldId, FieldDef> = Object.fromEntries(
  FIELDS.map((f) => [f.id, f]),
) as Record<FieldId, FieldDef>;

export function getField(id: FieldId): FieldDef {
  return FIELD_MAP[id];
}
