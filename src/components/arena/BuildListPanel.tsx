import { getCard } from "@/data/arena/cards";
import { COLOR_DOT, getMonster } from "@/data/arena/monsters";
import { computeSynergies } from "@/lib/arena/synergy";
import { slotPreview } from "@/lib/arena/preview";
import type { FieldId, MonsterBuild } from "@/types/arena";

/**
 * 左カラム「カードセット」。モックアップ準拠で、モンスターと、その子として装備/技を
 * インターリーブ表示する。発動中シナジーも末尾にまとめる。
 */
export default function BuildListPanel({
  builds,
  field,
  operatorId,
}: {
  builds: MonsterBuild[];
  field: FieldId;
  operatorId: string;
}) {
  const { views } = computeSynergies(builds, operatorId);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/15 bg-white/[0.03] p-2">
      <div className="mb-1 text-center text-[12px] font-black text-gray-200">カードセット</div>
      <div className="flex flex-1 flex-col gap-1">
        {builds.map((b, slot) => {
          const m = getMonster(b.monsterId);
          if (!m) return null;
          const p = slotPreview(b, field, operatorId);
          return (
            <div key={slot} className="space-y-0.5">
              <div className="rounded-lg border border-white/10 bg-black/20 px-1.5 py-1 text-[10px] font-bold">
                {COLOR_DOT[m.color]} {m.name}{" "}
                <span className="font-normal text-gray-400">
                  H{p.hp}/攻{p.attack}/防{p.defense}
                </span>
              </div>
              {b.equipmentIds.map((id, i) => {
                const c = getCard(id);
                if (!c) return null;
                return (
                  <div
                    key={`e${i}`}
                    className="ml-2 rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/10 px-1.5 py-0.5 text-[9px] text-fuchsia-100"
                  >
                    {c.emoji} {c.name} <span className="text-fuchsia-200/70">{c.desc}</span>
                  </div>
                );
              })}
              {p.skills.map((s, i) => (
                <div
                  key={`s${i}`}
                  className="ml-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-100"
                >
                  {s.emoji} {s.name}
                  {s.fieldNote && <span className="ml-0.5 text-amber-300">{s.fieldNote}</span>}
                </div>
              ))}
              {b.equipmentIds.length === 0 && p.skills.length === 0 && (
                <div className="ml-2 text-[9px] text-gray-600">（カード未割り当て）</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-1 border-t border-white/10 pt-1">
        <div className="mb-0.5 text-[10px] font-bold text-gray-300">✦ 発動中シナジー</div>
        {views.length === 0 ? (
          <div className="text-[9px] text-gray-600">まだ無し</div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {views.map((v) => (
              <div key={v.id} className="text-[9px]">
                <span>{v.emoji}</span>{" "}
                <span className="font-bold text-amber-200">{v.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
