"use client";

import { ENEMY_ABILITY_LABEL } from "@/data/enemies";
import EnemyIcon from "@/components/EnemyIcon";
import PixelGlyph from "@/components/PixelGlyph";
import { useDamageFx } from "@/hooks/useDamageFx";
import { fmt } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";
import type { ActiveStatus, StatusKind } from "@/types/game";

const STATUS_UI: Record<StatusKind, { icon: string; cls: string }> = {
  poison: { icon: "☠️", cls: "bg-lime-500/20 text-lime-300" },
  burn: { icon: "🔥", cls: "bg-orange-500/20 text-orange-300" },
};

/** Collapse stacked statuses into one badge per kind: total dmg/turn + max turns. */
function summarize(statuses: ActiveStatus[]): { kind: StatusKind; dps: number; turns: number }[] {
  const map = new Map<StatusKind, { kind: StatusKind; dps: number; turns: number }>();
  for (const s of statuses) {
    const cur = map.get(s.kind);
    if (cur) {
      cur.dps += s.damagePerTurn;
      cur.turns = Math.max(cur.turns, s.remainingTurns);
    } else {
      map.set(s.kind, { kind: s.kind, dps: s.damagePerTurn, turns: s.remainingTurns });
    }
  }
  return [...map.values()];
}

export default function EnemyCard() {
  const enemy = useGameStore((s) => s.currentEnemy);
  const floor = useGameStore((s) => s.currentFloor);
  const { floaters, shake } = useDamageFx(enemy?.hp ?? 0, enemy?.id ?? "", "hit");

  if (!enemy) return null;

  const hpPct = Math.max(0, Math.round((enemy.hp / enemy.maxHp) * 100));
  const statuses = summarize(enemy.statuses ?? []);

  const eatk = Math.max(0, enemy.attack - ((enemy.weakenTurns ?? 0) > 0 ? enemy.weakenAmount : 0));
  const edef = enemy.defense + (enemy.bonusDefense ?? 0);

  return (
    <div
      className={`relative flex gap-3 rounded-xl border p-3 ${
        enemy.isBoss ? "border-red-600/70 bg-red-950/30" : "border-white/10 bg-black/30"
      }`}
    >
      {floaters.map((f) => (
        <span key={f.id} className={`dmg-float text-2xl ${f.cls}`}>
          {f.text}
        </span>
      ))}

      {/* Vertical HP gauge — drains from the top downward. */}
      <div className="relative w-2.5 shrink-0 self-stretch overflow-hidden rounded-full bg-gray-800">
        <div
          className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-red-600 to-rose-400 transition-all"
          style={{ height: `${hpPct}%` }}
        />
      </div>

      {/* Procedurally-generated pixel-art portrait */}
      <div key={shake} className={`self-center ${shake ? "animate-shake" : ""}`}>
        <EnemyIcon enemy={enemy} size={56} />
      </div>

      {/* Name + HP/stats */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate font-bold">
            {enemy.isBoss && <span className="mr-1 text-red-400">BOSS</span>}
            {enemy.name}
          </p>
          <span className="shrink-0 text-[10px] text-gray-400">{floor}階</span>
        </div>
        <p className="text-xs text-gray-300">
          HP {fmt(Math.max(0, enemy.hp))}/{fmt(enemy.maxHp)}
        </p>
        <p className="flex items-center gap-x-2 text-[11px] text-gray-400">
          <span className="flex items-center gap-0.5"><PixelGlyph kind="attack" size={13} />{fmt(eatk)}</span>
          <span className="flex items-center gap-0.5"><PixelGlyph kind="defense" size={13} />{fmt(edef)}</span>
          {enemy.ability && (
            <span className="text-rose-300">{ENEMY_ABILITY_LABEL[enemy.ability]}</span>
          )}
        </p>

      {(statuses.length > 0 ||
        (enemy.stunTurns ?? 0) > 0 ||
        (enemy.bonusDefenseTurns ?? 0) > 0 ||
        (enemy.weakenTurns ?? 0) > 0 ||
        enemy.charging ||
        enemy.enraged) && (
        <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
          {enemy.charging && (
            <span className="rounded-full bg-red-600/30 px-2 py-0.5 font-bold text-red-300 animate-pulse">
              ⚠️ 大技チャージ中
            </span>
          )}
          {enemy.enraged && (
            <span className="rounded-full bg-rose-600/30 px-2 py-0.5 font-bold text-rose-300">
              😡 激昂
            </span>
          )}
          {(enemy.stunTurns ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-yellow-500/20 px-2 py-0.5 font-bold text-yellow-300">
              <PixelGlyph kind="stun" size={12} /> スタン ({enemy.stunTurns}T)
            </span>
          )}
          {(enemy.weakenTurns ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-violet-500/20 px-2 py-0.5 font-bold text-violet-300">
              <PixelGlyph kind="weaken" size={12} /> 攻-{enemy.weakenAmount} ({enemy.weakenTurns}T)
            </span>
          )}
          {(enemy.bonusDefenseTurns ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-blue-500/20 px-2 py-0.5 font-bold text-blue-300">
              <PixelGlyph kind="defense" size={12} /> 防御+{enemy.bonusDefense} ({enemy.bonusDefenseTurns}T)
            </span>
          )}
          {statuses.map((s) => (
            <span
              key={s.kind}
              className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 font-bold ${STATUS_UI[s.kind].cls}`}
            >
              <PixelGlyph kind={s.kind === "poison" ? "poison" : "fire"} size={12} /> {s.dps}/T ({s.turns}T)
            </span>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
