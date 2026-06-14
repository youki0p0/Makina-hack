"use client";

import { useGameStore } from "@/store/gameStore";
import type { ActiveStatus, EnemyAbility, StatusKind } from "@/types/game";

const STATUS_UI: Record<StatusKind, { icon: string; cls: string }> = {
  poison: { icon: "☠️", cls: "bg-lime-500/20 text-lime-300" },
  burn: { icon: "🔥", cls: "bg-orange-500/20 text-orange-300" },
};

const ABILITY_LABEL: Record<EnemyAbility, string> = {
  multiAttack: "連撃持ち",
  heal: "回復持ち",
  defend: "防御持ち",
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

  if (!enemy) return null;

  const hpPct = Math.max(0, Math.round((enemy.hp / enemy.maxHp) * 100));
  const statuses = summarize(enemy.statuses ?? []);

  return (
    <div
      className={`rounded-xl border p-4 text-center ${
        enemy.isBoss ? "border-red-600/70 bg-red-950/30" : "border-white/10 bg-black/30"
      }`}
    >
      <div className="text-xs text-gray-400">{floor}階</div>
      <div className="my-1 text-5xl leading-none">{enemy.emoji}</div>
      <div className="font-bold">
        {enemy.isBoss && <span className="mr-1 text-red-400">BOSS</span>}
        {enemy.name}
      </div>

      <div className="mt-2">
        <div className="flex justify-between text-xs text-gray-300">
          <span>HP</span>
          <span>
            {Math.max(0, enemy.hp)} / {enemy.maxHp}
          </span>
        </div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-400 transition-all"
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400">
        ⚔️ {enemy.attack} ／ 🛡️ {enemy.defense + (enemy.bonusDefense ?? 0)}
        {enemy.ability && (
          <span className="ml-2 text-rose-300">{ABILITY_LABEL[enemy.ability]}</span>
        )}
      </div>

      {(statuses.length > 0 || (enemy.stunTurns ?? 0) > 0 || (enemy.bonusDefenseTurns ?? 0) > 0) && (
        <div className="mt-2 flex flex-wrap justify-center gap-1 text-[10px]">
          {(enemy.stunTurns ?? 0) > 0 && (
            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 font-bold text-yellow-300">
              ⚡ スタン ({enemy.stunTurns}T)
            </span>
          )}
          {(enemy.bonusDefenseTurns ?? 0) > 0 && (
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 font-bold text-blue-300">
              🛡️↑ 防御+{enemy.bonusDefense} ({enemy.bonusDefenseTurns}T)
            </span>
          )}
          {statuses.map((s) => (
            <span
              key={s.kind}
              className={`rounded-full px-2 py-0.5 font-bold ${STATUS_UI[s.kind].cls}`}
            >
              {STATUS_UI[s.kind].icon} {s.dps}/T ({s.turns}T)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
