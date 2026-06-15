"use client";

import { useEffect, useState } from "react";
import { getItemIconDataUrl, hashSeed, type IconSpec } from "@/lib/itemIcon";
import type { Equipment } from "@/types/game";

/** Build a deterministic icon spec from an equipment instance. */
export function iconSpecForItem(item: Equipment): IconSpec {
  return {
    slot: item.slot,
    rarity: item.rarity,
    modifierStars: item.modTier ?? 0,
    setId: item.setId,
    unique: item.unique,
    quality: item.quality,
    echo: item.echo,
    // Same item id ⇒ same icon; affix nudges variation slightly.
    seed: hashSeed(`${item.id}:${item.affixId ?? ""}`),
  };
}

/**
 * Procedurally-rendered pixel-art icon for an item (no image assets).
 * Generated on the client and cached; scaled with nearest-neighbor.
 */
export default function ItemIcon({
  item,
  size = 32,
  className = "",
}: {
  item: Equipment;
  size?: number;
  className?: string;
}) {
  const [url, setUrl] = useState("");
  const spec = iconSpecForItem(item);
  // Regenerate only when the visual-affecting fields change.
  useEffect(() => {
    setUrl(getItemIconDataUrl(spec));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.affixId, item.modTier, item.rarity, item.setId, item.unique, item.quality]);

  const glow = item.unique || item.rarity === "legendary" ? "legendary-glow" : "";

  return (
    <span
      className={`inline-block shrink-0 ${glow} ${className}`}
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
        <span
          style={{ display: "block", width: size, height: size }}
          className="rounded bg-white/5"
        />
      )}
    </span>
  );
}
