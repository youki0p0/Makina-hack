"use client";

import { Fragment } from "react";
import PixelGlyph from "@/components/PixelGlyph";
import { EMOJI_GLYPH } from "@/lib/uiGlyphs";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// Longest keys first so multi-codepoint emoji match before any subset.
const KEYS = Object.keys(EMOJI_GLYPH).sort((a, b) => b.length - a.length);
const RE = new RegExp(`(${KEYS.map(escapeRe).join("|")})`, "g");

/**
 * Render text with any known emoji swapped for inline pixel glyphs, so even
 * dynamic strings (battle log, help, flavor) avoid emoji.
 */
export default function GlyphText({
  text,
  size = 14,
  className = "",
}: {
  text: string;
  size?: number;
  className?: string;
}) {
  const parts = text.split(RE);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        EMOJI_GLYPH[p] ? (
          <PixelGlyph key={i} kind={EMOJI_GLYPH[p]} size={size} />
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </span>
  );
}
