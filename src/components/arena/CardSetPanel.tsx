import { computeSynergies } from "@/lib/arena/synergy";
import type { MonsterBuild } from "@/types/arena";

/** 発動中シナジーの一覧。編成の手応えを可視化する。 */
export default function CardSetPanel({
  builds,
  operatorId,
}: {
  builds: MonsterBuild[];
  operatorId: string;
}) {
  const { views } = computeSynergies(builds, operatorId);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
      <div className="mb-1 text-[11px] font-bold text-gray-300">✦ 発動中シナジー</div>
      {views.length === 0 ? (
        <p className="text-[10px] text-gray-500">
          まだ無し。色を揃える / タグを重ねる / 集中・分散でシナジーが点く。
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {views.map((v) => (
            <div key={v.id} className="flex items-start gap-1 text-[10px]">
              <span>{v.emoji}</span>
              <span className="font-bold text-amber-200">{v.name}</span>
              <span className="text-gray-300">{v.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
