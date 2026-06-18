"use client";

import { CLASSES, isClassUnlocked } from "@/data/classes";
import PixelGlyph from "@/components/PixelGlyph";
import { classGlyphKind } from "@/lib/uiGlyphs";
import { useGameStore } from "@/store/gameStore";
import type { StatBonus } from "@/types/game";

function statSummary(mods: StatBonus): string {
  const parts: string[] = [];
  if (mods.attack) parts.push(`攻${mods.attack > 0 ? "+" : ""}${mods.attack}`);
  if (mods.defense) parts.push(`防${mods.defense > 0 ? "+" : ""}${mods.defense}`);
  if (mods.maxHp) parts.push(`HP${mods.maxHp > 0 ? "+" : ""}${mods.maxHp}`);
  if (mods.reroll) parts.push(`振直${mods.reroll > 0 ? "+" : ""}${mods.reroll}`);
  return parts.length ? parts.join(" / ") : "ステ変化なし";
}

export default function ClassPanel() {
  const classId = useGameStore((s) => s.classId);
  const canChange = useGameStore((s) => s.canChangeClass());
  const changeClass = useGameStore((s) => s.changeClass);
  const progress = useGameStore((s) => s.progress);

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-gray-300">転職</h2>
      {!canChange && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-200">
          転職できるのは「倒れた後」かセーブポイント階（1・51・101…）だけ。力尽きるかセーブポイントで職業を選び直そう。
        </p>
      )}

      <div className="space-y-2">
        {CLASSES.map((c) => {
          const current = c.id === classId;
          const unlocked = isClassUnlocked(c.id, progress);
          return (
            <div
              key={c.id}
              className={`rounded-xl border p-2 ${
                current
                  ? "border-emerald-500/60 bg-emerald-500/10"
                  : unlocked
                    ? "border-white/10 bg-black/20"
                    : "border-white/10 bg-black/20 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1 font-bold">
                  <PixelGlyph kind={unlocked ? classGlyphKind(c.id) : "lock"} size={16} /> {c.name}
                  {current && <span className="ml-2 text-[10px] text-emerald-300">現在</span>}
                </p>
                <button
                  onClick={() => changeClass(c.id)}
                  disabled={current || !canChange || !unlocked}
                  className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white active:scale-95 disabled:opacity-40"
                >
                  {current ? "選択中" : unlocked ? "転職" : "未解放"}
                </button>
              </div>
              {unlocked ? (
                <>
                  <p className="mt-0.5 text-[10px] text-gray-400">{c.description}</p>
                  <p className="mt-1 text-[10px] text-sky-300">{statSummary(c.statMods)}</p>
                  {c.diceModifiers.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-[10px] text-amber-200">
                      {c.diceModifiers.map((m, i) => (
                        <li key={i}>✦ {m.description}</li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="mt-0.5 text-[10px] text-amber-300">🔒 {c.unlockHint}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
