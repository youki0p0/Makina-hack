import type { OperatorDef } from "@/types/arena";

/**
 * プレーヤーキャラ＝モンスターを使役するオペレーター（新規オリジナル）。
 * 戦闘には直接参加せず、編成・フィールド適性・技変質に影響を与える。
 * モチーフ：機械仕掛け・魔導・指揮・観測・契約。
 */
export const OPERATORS: readonly OperatorDef[] = [
  {
    id: "calibrator",
    name: "ヴェル",
    title: "歯車仕掛けの召喚士",
    emoji: "⚙️",
    palette: ["#1f2937", "#f59e0b", "#fde68a"],
    concept:
      "片腕が真鍮の義手の少女召喚士。背に小さな歯車の浮遊環を従え、契約符でモンスターを呼び出す。落ち着いた観測者気質。",
    passiveName: "精密契約",
    passiveDesc: "技を1体に集中させると、その威力がさらに+15%。",
    passive: { focusPowerBoost: 0.15 },
  },
  {
    id: "pyroseer",
    name: "イグナ",
    title: "火を読む巫術師",
    emoji: "🜂",
    palette: ["#3b0764", "#ef4444", "#fca5a5"],
    concept:
      "炎の紋様が刻まれた外套をまとう巫女。揺らめく炎を覗き込んで戦況を占う。火山の申し子。",
    passiveName: "灼熱の託宣",
    passiveDesc: "火山フィールドで火炎技の変質効果（火傷）が強化される。",
    passive: { favoredField: "volcano", fieldTransformBoost: 0.6 },
  },
  {
    id: "verdant",
    name: "ミルナ",
    title: "森と契る薬師",
    emoji: "🌿",
    palette: ["#14532d", "#22c55e", "#bbf7d0"],
    concept:
      "蔓と薬草を編んだローブの薬師。森のフィールドで真価を発揮し、毒と再生を操る。穏やかだが芯が強い。",
    passiveName: "森羅の恵み",
    passiveDesc: "森フィールドで毒・再生の効果が強化される。",
    passive: { favoredField: "forest", fieldTransformBoost: 0.6 },
  },
  {
    id: "conductor",
    name: "セルジュ",
    title: "魔導オペレーター",
    emoji: "📡",
    palette: ["#0c4a6e", "#38bdf8", "#bae6fd"],
    concept:
      "浮遊する観測端末を操る指揮官。青いバイザー越しに戦場を解析し、味方の術式巡りを最適化する。",
    passiveName: "術式同期",
    passiveDesc: "Blue 系モンスターの技クールダウンを15%短縮。",
    passive: { colorCdReduce: { color: "blue", pct: 0.15 } },
  },
  {
    id: "warden",
    name: "ガレオ",
    title: "戦場観測の守人",
    emoji: "🛡️",
    palette: ["#292524", "#a8a29e", "#e7e5e4"],
    concept:
      "古い遺跡守りの甲冑をまとう寡黙な観測者。陣を崩さぬ分散運用を得意とし、味方に守りを配る。",
    passiveName: "守勢展開",
    passiveDesc: "技を3体に分散させると、戦闘開始時に全員へシールド+30。",
    passive: { spreadShield: 30, equipDefenseBoost: 1 },
  },
];

export const OPERATOR_MAP: Record<string, OperatorDef> = Object.fromEntries(
  OPERATORS.map((o) => [o.id, o]),
);

export function getOperator(id: string): OperatorDef {
  return OPERATOR_MAP[id] ?? OPERATORS[0];
}
