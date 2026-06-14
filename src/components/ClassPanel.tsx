"use client";

import { CLASSES } from "@/data/classes";
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

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-gray-300">転職</h2>
      {!canChange && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-200">
          転職できるのは「3階ごと」だけ。次の転職可能階まで進もう。
        </p>
      )}

      <div className="space-y-2">
        {CLASSES.map((c) => {
          const current = c.id === classId;
          return (
            <div
              key={c.id}
              className={`rounded-xl border p-2 ${
                current ? "border-emerald-500/60 bg-emerald-500/10" : "border-white/10 bg-black/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold">
                  {c.icon} {c.name}
                  {current && <span className="ml-2 text-[10px] text-emerald-300">現在</span>}
                </p>
                <button
                  onClick={() => changeClass(c.id)}
                  disabled={current || !canChange}
                  className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white active:scale-95 disabled:opacity-40"
                >
                  {current ? "選択中" : "転職"}
                </button>
              </div>
              <p className="mt-0.5 text-[10px] text-gray-400">{c.description}</p>
              <p className="mt-1 text-[10px] text-sky-300">{statSummary(c.statMods)}</p>
              {c.diceModifiers.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[10px] text-amber-200">
                  {c.diceModifiers.map((m, i) => (
                    <li key={i}>✦ {m.description}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
