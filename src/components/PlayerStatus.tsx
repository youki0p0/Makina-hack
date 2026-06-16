"use client";

import { getClass } from "@/data/classes";
import PixelGlyph from "@/components/PixelGlyph";
import { fmt } from "@/lib/ui";
import { classGlyphKind, consumableGlyphKind } from "@/lib/uiGlyphs";
import { getTitle } from "@/data/titles";
import { useDamageFx } from "@/hooks/useDamageFx";
import { useGameStore } from "@/store/gameStore";

const BUFF_LABEL: Record<string, string> = {
  attack: "攻",
  defense: "防",
  reroll: "振直",
  luck: "幸運",
};

export default function PlayerStatus() {
  const player = useGameStore((s) => s.player);
  const stats = useGameStore((s) => s.stats());
  const buffs = useGameStore((s) => s.activeBuffs);

  const hpPct = Math.max(0, Math.round((player.hp / stats.maxHp) * 100));
  const classId = useGameStore((s) => s.classId);
  const cls = getClass(classId);
  const streak = useGameStore((s) => s.winStreak);
  const title = getTitle(useGameStore((s) => s.titleId));
  const playerStatuses = useGameStore((s) => s.playerStatuses);
  const playerStunTurns = useGameStore((s) => s.playerStunTurns);
  const poison = playerStatuses.reduce((sum, s) => sum + s.damagePerTurn, 0);
  const { floaters } = useDamageFx(player.hp, "player", "hurt");

  return (
    <div className="relative rounded-xl border border-white/10 bg-black/30 p-3">
      {floaters.map((f) => (
        <span key={f.id} className={`dmg-float text-xl ${f.cls}`}>
          {f.text}
        </span>
      ))}
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold">
          {title.id && <span className="text-amber-300">《{title.name}》</span>}{" "}
          <PixelGlyph kind={classGlyphKind(classId)} size={14} /> {cls.name} Lv{player.level}
        </span>
        <span className="flex items-center gap-2">
          {streak >= 2 && (
            <span className="flex items-center text-orange-300"><PixelGlyph kind="fire" size={13} />{streak}</span>
          )}
          <span className="flex items-center gap-0.5 text-amber-300"><PixelGlyph kind="gold" size={13} /> {fmt(player.gold)}</span>
        </span>
      </div>

      <div className="mt-2">
        <div className="flex justify-between text-xs text-gray-300">
          <span>HP</span>
          <span>
            {fmt(Math.max(0, player.hp))} / {fmt(stats.maxHp)}
          </span>
        </div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      <div className="mt-2 flex justify-between text-xs text-gray-300">
        <span className="flex items-center gap-0.5"><PixelGlyph kind="attack" size={13} /> 攻 {fmt(stats.attack)}</span>
        <span className="flex items-center gap-0.5"><PixelGlyph kind="defense" size={13} /> 防 {fmt(stats.defense)}</span>
        <span className="flex items-center gap-0.5"><PixelGlyph kind="dice" size={13} /> 振直 {stats.rerolls}</span>
      </div>

      <div className="mt-1">
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>EXP</span>
          <span>
            {player.exp} / {player.expToNext}
          </span>
        </div>
        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-sky-400 transition-all"
            style={{ width: `${Math.min(100, Math.round((player.exp / player.expToNext) * 100))}%` }}
          />
        </div>
      </div>

      {buffs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          {buffs.map((b, i) => (
            <span
              key={`${b.kind}-${i}`}
              className="flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300"
            >
              <PixelGlyph kind={consumableGlyphKind(b.kind)} size={12} /> {BUFF_LABEL[b.kind]}
              {b.kind === "luck" ? `≥${b.value}` : `+${b.value}`} ({b.battlesLeft}戦)
            </span>
          ))}
        </div>
      )}

      {(poison > 0 || playerStunTurns > 0) && (
        <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
          {poison > 0 && (
            <span className="rounded-full bg-lime-600/25 px-2 py-0.5 font-bold text-lime-300">
              ☠️ 毒 {poison}/T
            </span>
          )}
          {playerStunTurns > 0 && (
            <span className="rounded-full bg-yellow-500/25 px-2 py-0.5 font-bold text-yellow-300">
              ⚡ スタン (リロール不可)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
