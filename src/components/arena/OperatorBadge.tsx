import type { OperatorDef } from "@/types/arena";

/**
 * プレーヤーキャラ（オペレーター）の常時表示バッジ。「この人が使役している」と
 * 一目で分かるよう、固有パレットの円形アバター＋称号で示す。ドット絵差分が
 * 用意できるまでは絵文字アバターで代用。
 */
export default function OperatorBadge({
  operator,
  size = 40,
  showPassive = false,
}: {
  operator: OperatorDef;
  size?: number;
  showPassive?: boolean;
}) {
  const [dark, mid, light] = operator.palette;
  return (
    <div className="flex items-center gap-2">
      <div
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 30% 25%, ${light} 0%, ${mid} 45%, ${dark} 100%)`,
          borderColor: light,
          imageRendering: "pixelated",
        }}
        className="flex items-center justify-center rounded-full border-2 shadow-md"
        aria-label={operator.name}
      >
        <span style={{ fontSize: size * 0.5 }} className="leading-none">
          {operator.emoji}
        </span>
      </div>
      <div className="leading-tight">
        <div className="text-[11px] font-bold text-gray-100">
          {operator.name}
          <span className="ml-1 text-[9px] font-normal text-gray-400">{operator.title}</span>
        </div>
        {showPassive && (
          <div className="text-[9px] text-amber-300">
            ◆ {operator.passiveName}：{operator.passiveDesc}
          </div>
        )}
      </div>
    </div>
  );
}
