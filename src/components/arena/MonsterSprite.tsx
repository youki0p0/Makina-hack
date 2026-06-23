"use client";

import { useState } from "react";
import type { MonsterDef } from "@/types/arena";

/**
 * モンスターの戦闘用ドット絵。専用スプライト（/arena/monsters/<id>.png）を
 * 色パレットの枠に表示。読み込み失敗時は絵文字にフォールバックする。
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
  const [err, setErr] = useState(false);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(150deg, ${mid} 0%, ${dark} 100%)`,
        borderColor: light,
        boxShadow: dimmed ? "none" : `0 0 0 2px ${dark}, 0 2px 6px rgba(0,0,0,.4)`,
        opacity: dimmed ? 0.4 : 1,
        filter: dimmed ? "grayscale(0.7)" : "none",
      }}
      className="relative flex items-center justify-center overflow-hidden rounded-md border-2"
      aria-label={monster.name}
    >
      {!err ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/arena/monsters/${monster.id}.png`}
          alt={monster.name}
          onError={() => setErr(true)}
          style={{ imageRendering: "pixelated", width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <span style={{ fontSize: size * 0.5 }} className="leading-none drop-shadow">
          {monster.emoji}
        </span>
      )}
    </div>
  );
}
