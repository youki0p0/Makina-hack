import type { MonsterDef } from "@/types/arena";

/**
 * モンスターの戦闘用「ドット絵風」チップ。本物のスプライトが用意できるまでは
 * 色パレット＋絵文字で、シルエットで見分けられる簡易表現にしている。
 */
export default function MonsterSprite({
  monster,
  size = 44,
  dimmed = false,
}: {
  monster: MonsterDef;
  size?: number;
  dimmed?: boolean;
}) {
  const [dark, mid, light] = monster.palette;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(150deg, ${mid} 0%, ${dark} 100%)`,
        borderColor: light,
        boxShadow: dimmed ? "none" : `0 0 0 2px ${dark}, 0 2px 6px rgba(0,0,0,.4)`,
        imageRendering: "pixelated",
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? "grayscale(0.8)" : "none",
      }}
      className="relative flex items-center justify-center rounded-md border-2"
      aria-label={monster.name}
    >
      <span style={{ fontSize: size * 0.5 }} className="leading-none drop-shadow">
        {monster.emoji}
      </span>
    </div>
  );
}
