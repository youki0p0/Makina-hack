"use client";

import { useEffect, useState } from "react";
import { getEnemyIconDataUrl, hashSeed } from "@/lib/itemIcon";

/** Minimal shape an enemy/template needs for an icon. */
interface EnemyLike {
  templateId: string;
  isBoss: boolean;
  modTier?: number;
}

/**
 * Procedurally-rendered pixel-art icon for an enemy/boss (no image assets).
 * Deterministic from the template id; bosses get a crown, ★ enemies an aura.
 */
export default function EnemyIcon({
  enemy,
  size = 64,
  className = "",
}: {
  enemy: EnemyLike;
  size?: number;
  className?: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(
      getEnemyIconDataUrl({
        templateId: enemy.templateId,
        isBoss: enemy.isBoss,
        modTier: enemy.modTier ?? 0,
        seed: hashSeed(enemy.templateId),
      }),
    );
  }, [enemy.templateId, enemy.isBoss, enemy.modTier]);

  return (
    <span
      className={`inline-block shrink-0 ${className}`}
      style={{ width: size, height: size, lineHeight: 0 }}
      aria-hidden
    >
      {url ? (
        <img
          src={url}
          width={size}
          height={size}
          alt=""
          draggable={false}
          style={{ width: size, height: size, imageRendering: "pixelated" }}
        />
      ) : (
        <span style={{ display: "block", width: size, height: size }} />
      )}
    </span>
  );
}
