"use client";

import { useEffect, useState } from "react";
import { getGlyphIconDataUrl, type GlyphKind } from "@/lib/itemIcon";

/**
 * A small procedurally-generated pixel-art glyph used in place of emoji, so the
 * whole UI shares the same icon language. Generated on the client and cached.
 */
export default function PixelGlyph({
  kind,
  size = 16,
  className = "",
}: {
  kind: GlyphKind;
  size?: number;
  className?: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(getGlyphIconDataUrl(kind));
  }, [kind]);

  return (
    <span
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
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
        <span style={{ display: "inline-block", width: size, height: size }} />
      )}
    </span>
  );
}
