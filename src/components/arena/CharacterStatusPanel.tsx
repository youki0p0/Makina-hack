import { getCard } from "@/data/arena/cards";
import { getMonster, COLOR_DOT } from "@/data/arena/monsters";
import { slotPreview } from "@/lib/arena/preview";
import type { FieldId, MonsterBuild } from "@/types/arena";
import MonsterSprite from "./MonsterSprite";

/**
 * 味方3体の状態パネル。ドラフトでカードを選んでいる間は、行をタップして
 * そのモンスターにカードを割り当てられる（onAssign）。
 */
export default function CharacterStatusPanel({
  builds,
  field,
  operatorId,
  assigning = false,
  onAssign,
}: {
  builds: MonsterBuild[];
  field: FieldId;
  operatorId: string;
  assigning?: boolean;
  onAssign?: (slot: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {builds.map((b, slot) => {
        const m = getMonster(b.monsterId);
        if (!m) return null;
        const p = slotPreview(b, field, operatorId);
        const Row = assigning ? "button" : "div";
        return (
          <Row
            key={slot}
            onClick={assigning ? () => onAssign?.(slot) : undefined}
            className={`w-full rounded-2xl border p-2 text-left ${
              p.focused ? "border-amber-400/60 bg-amber-500/5" : "border-white/10 bg-white/[0.03]"
            } ${assigning ? "active:scale-[0.98] ring-1 ring-emerald-400/40" : ""}`}
          >
            <div className="flex items-center gap-2">
              <MonsterSprite monster={m} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[12px] font-bold">
                  {COLOR_DOT[m.color]} <span className="truncate">{m.name}</span>
                  {p.focused && (
                    <span className="rounded bg-amber-500/30 px-1 text-[8px] text-amber-200">
                      集中
                    </span>
                  )}
                </div>
                <div className="text-[9px] text-gray-400">{m.role}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-2 text-[10px] text-gray-200">
                <span>❤️{p.hp}</span>
                <span>⚔️{p.attack}</span>
                <span>🛡️{p.defense}</span>
                <span>💨{p.speed}</span>
              </div>
            </div>

            {(b.equipmentIds.length > 0 || p.skills.length > 0) && (
              <div className="mt-1.5 space-y-0.5">
                {b.equipmentIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {b.equipmentIds.map((id, i) => {
                      const c = getCard(id);
                      return (
                        <span
                          key={i}
                          className="rounded bg-fuchsia-500/15 px-1 text-[9px] text-fuchsia-100"
                        >
                          {c ? `${c.emoji}${c.name}` : id}
                        </span>
                      );
                    })}
                  </div>
                )}
                {p.skills.map((s, i) => (
                  <div key={i} className="text-[9px] leading-tight">
                    <span className="text-emerald-200">
                      {s.emoji} {s.name}
                    </span>
                    {s.fieldNote && <span className="ml-1 text-amber-300">{s.fieldNote}</span>}
                  </div>
                ))}
              </div>
            )}
            {assigning && (
              <div className="mt-1 text-center text-[9px] text-emerald-300">＋ ここに割り当て</div>
            )}
          </Row>
        );
      })}
    </div>
  );
}
