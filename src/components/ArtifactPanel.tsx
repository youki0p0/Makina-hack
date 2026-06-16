"use client";

import { ARTIFACTS, artifactUpgradeCost } from "@/data/artifacts";
import PixelGlyph from "@/components/PixelGlyph";
import GlyphText from "@/components/GlyphText";
import { useGameStore } from "@/store/gameStore";

export default function ArtifactPanel() {
  const souls = useGameStore((s) => s.souls);
  const artifacts = useGameStore((s) => s.artifacts);
  const upgrade = useGameStore((s) => s.upgradeArtifact);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-300">アーティファクト</h2>
        <span className="flex items-center gap-1 text-xs text-indigo-300"><PixelGlyph kind="soul" size={14} /> 魂 {souls}</span>
      </div>
      <p className="text-[10px] text-gray-500">
        永久強化。装備枠を使わず、転生しても引き継がれる。
      </p>

      <div className="space-y-2">
        {ARTIFACTS.map((a) => {
          const level = artifacts[a.id] ?? 0;
          const maxed = level >= a.maxLevel;
          const cost = artifactUpgradeCost(a.id, level);
          const canBuy = !maxed && souls >= cost;
          return (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-2"
            >
              <div className="min-w-0">
                <p className="font-bold text-indigo-200">
                  <GlyphText text={a.icon} size={14} /> {a.name}{" "}
                  <span className="text-xs text-gray-400">Lv{level}/{a.maxLevel}</span>
                </p>
                <p className="text-[10px] text-gray-400">{a.description}</p>
              </div>
              <button
                onClick={() => upgrade(a.id)}
                disabled={!canBuy}
                className="ml-2 flex shrink-0 items-center gap-0.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white active:scale-95 disabled:opacity-40"
              >
                {maxed ? "MAX" : <>強化 <PixelGlyph kind="soul" size={12} />{cost}</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
