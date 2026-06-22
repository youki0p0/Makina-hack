"use client";

import PixelGlyph from "@/components/PixelGlyph";
import { soulAltarCost, soulAltarMult } from "@/store/helpers";
import { useGameStore } from "@/store/gameStore";

/**
 * 魂の祭壇: アーティファクトを上げ切った後も転生ポイント(souls)を捧げ続けられる
 * 無限の使い道。捧げるほどゴールド/EXP取得が伸びる（戦闘力には影響しない経済強化）。
 */
export default function SoulAltarPanel() {
  const souls = useGameStore((s) => s.souls);
  const level = useGameStore((s) => s.soulAltar);
  const offer = useGameStore((s) => s.offerToAltar);

  const cost = soulAltarCost(level);
  const canBuy = souls >= cost;
  const bonus = Math.round((soulAltarMult(level) - 1) * 100);
  const nextBonus = Math.round((soulAltarMult(level + 1) - 1) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-300">魂の祭壇</h2>
        <span className="flex items-center gap-1 text-xs text-indigo-300">
          <PixelGlyph kind="soul" size={14} /> 魂 {souls}
        </span>
      </div>
      <p className="text-[10px] text-gray-500">
        魂を捧げてゴールド・EXP取得を永久に強化。上限なし（捧げるほどコスト増）。転生しても引き継がれる。
      </p>

      <div className="flex items-center justify-between rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-2">
        <div className="min-w-0">
          <p className="font-bold text-fuchsia-200">
            🔥 祭壇 <span className="text-xs text-gray-400">Lv{level}</span>
          </p>
          <p className="text-[10px] text-gray-400">
            ゴールド・EXP取得 +{bonus}%
            {" → "}
            <span className="text-fuchsia-300">+{nextBonus}%</span>
          </p>
        </div>
        <button
          onClick={offer}
          disabled={!canBuy}
          className="ml-2 flex shrink-0 items-center gap-0.5 rounded-lg bg-fuchsia-600 px-3 py-2 text-xs font-bold text-white active:scale-95 disabled:opacity-40"
        >
          捧げる <PixelGlyph kind="soul" size={12} />
          {cost}
        </button>
      </div>
    </div>
  );
}
