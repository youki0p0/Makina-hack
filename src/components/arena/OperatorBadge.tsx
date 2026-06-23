"use client";

import { useState } from "react";
import type { OperatorDef } from "@/types/arena";

/**
 * プレーヤーキャラ（オペレーター）の常時表示バッジ。専用ドット絵スプライト
 * （/arena/operators/<id>.png）を円形アバターに表示。読み込み失敗時は絵文字に
 * フォールバックする。
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
  const [err, setErr] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 30% 25%, ${light} 0%, ${mid} 45%, ${dark} 100%)`,
          borderColor: light,
        }}
        className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 shadow-md"
        aria-label={operator.name}
      >
        {!err ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/arena/operators/${operator.id}.png`}
            alt={operator.name}
            onError={() => setErr(true)}
            style={{ imageRendering: "pixelated", width: "128%", height: "128%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: size * 0.5 }} className="leading-none">
            {operator.emoji}
          </span>
        )}
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
