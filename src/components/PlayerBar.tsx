"use client";

import { getClass } from "@/data/classes";
import PixelGlyph from "@/components/PixelGlyph";
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

/** Compact player bar for the battle screen (HP/atk/def + vertical EXP gauge). */
export default function PlayerBar() {
  const player = useGameStore((s) => s.player);
  const stats = useGameStore((s) => s.stats());
  const buffs = useGameStore((s) => s.activeBuffs);
  const classId = useGameStore((s) => s.classId);
  const cls = getClass(classId);
  const title = getTitle(useGameStore((s) => s.titleId));
  const streak = useGameStore((s) => s.winStreak);
  const playerStatuses = useGameStore((s) => s.playerStatuses);
  const playerStunTurns = useGameStore((s) => s.playerStunTurns);
  const poison = playerStatuses.reduce((sum, s) => sum + s.damagePerTurn, 0);
  const { floaters } = useDamageFx(player.hp, "player", "hurt");

  const hpPct = Math.max(0, Math.round((player.hp / stats.maxHp) * 100));
  const expPct = Math.min(100, Math.round((player.exp / player.expToNext) * 100));

  return (
    <div className="relative flex gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
      {floaters.map((f) => (
        <span key={f.id} className={`dmg-float text-xl ${f.cls}`}>
          {f.text}
        </span>
      ))}

      {/* Vertical EXP gauge — fills from the bottom upward. */}
      <div className="relative w-2.5 shrink-0 self-stretch overflow-hidden rounded-full bg-gray-800">
        <div
          className="absolute bottom-0 left-0 w-full bg-sky-400 transition-all"
          style={{ height: `${expPct}%` }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-xs">
          <span className="truncate font-bold">
            {title.id && <span className="text-amber-300">《{title.name}》</span>} <PixelGlyph kind={classGlyphKind(classId)} size={13} /> {cls.name} Lv{player.level}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {streak >= 2 && (
              <span className="flex items-center text-orange-300">
                <PixelGlyph kind="fire" size={14} />
                {streak}
              </span>
            )}
            <span className="flex items-center text-amber-300">
              <PixelGlyph kind="gold" size={14} />
              {player.gold}
            </span>
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] text-gray-300">
            {Math.max(0, player.hp)}/{stats.maxHp}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-300">
          <span className="flex items-center gap-0.5"><PixelGlyph kind="attack" size={14} />{stats.attack}</span>
          <span className="flex items-center gap-0.5"><PixelGlyph kind="defense" size={14} />{stats.defense}</span>
          <span className="flex items-center gap-0.5"><PixelGlyph kind="dice" size={14} />{stats.rerolls}</span>
          {buffs.map((b, i) => (
            <span key={`${b.kind}-${i}`} className="flex items-center text-emerald-300">
              <PixelGlyph kind={consumableGlyphKind(b.kind)} size={12} />{BUFF_LABEL[b.kind]}
              {b.kind === "luck" ? `≥${b.value}` : `+${b.value}`}
            </span>
          ))}
          {poison > 0 && (
            <span className="flex items-center text-lime-300"><PixelGlyph kind="poison" size={14} />{poison}/T</span>
          )}
          {playerStunTurns > 0 && (
            <span className="flex items-center text-yellow-300"><PixelGlyph kind="stun" size={14} />スタン</span>
          )}
        </div>
      </div>
    </div>
  );
}
