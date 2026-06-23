import { getOperator } from "@/data/arena/operators";
import { getMonster } from "@/data/arena/monsters";
import { slotPreview } from "@/lib/arena/preview";
import type { FieldId, MonsterBuild } from "@/types/arena";

/**
 * 右カラム。モックアップ準拠で 3体を大きな丸＋HP/攻/防 で並べ、最下部に
 * オペレーター（プレーヤーキャラ）を「使役している」雰囲気で配置する。
 * ドラフトでカード選択中（assigning）は丸をタップして割り当てできる。
 */
export default function MonsterColumn({
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
  const op = getOperator(operatorId);
  return (
    <div className="relative flex h-full flex-col items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.03] p-2 pb-14">
      {builds.map((b, slot) => {
        const m = getMonster(b.monsterId);
        if (!m) return null;
        const p = slotPreview(b, field, operatorId);
        const [dark, mid, light] = m.palette;
        const Tag = assigning ? "button" : "div";
        const nCards = b.equipmentIds.length + p.skills.length;
        return (
          <Tag
            key={slot}
            onClick={assigning ? () => onAssign?.(slot) : undefined}
            className={`flex w-full flex-col items-center gap-0.5 rounded-xl py-1 ${
              assigning ? "active:scale-95 ring-1 ring-emerald-400/40" : ""
            } ${p.focused ? "bg-amber-500/10" : ""}`}
          >
            <div
              style={{
                background: `radial-gradient(circle at 35% 30%, ${light} 0%, ${mid} 45%, ${dark} 100%)`,
                borderColor: light,
              }}
              className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/arena/monsters/${m.id}.png`}
                alt={m.name}
                style={{ imageRendering: "pixelated", width: "112%", height: "112%", objectFit: "cover" }}
              />
              {nCards > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-black/70 px-1 text-[8px] font-bold text-white">
                  {nCards}
                </span>
              )}
              {p.focused && (
                <span className="absolute -bottom-1 rounded bg-amber-500 px-1 text-[7px] font-black text-black">
                  集中
                </span>
              )}
            </div>
            <div className="text-[10px] font-bold text-gray-200">
              <span className="text-rose-300">H{p.hp}</span>/
              <span className="text-amber-300">攻{p.attack}</span>/
              <span className="text-sky-300">防{p.defense}</span>
            </div>
          </Tag>
        );
      })}

      {assigning && (
        <div className="text-center text-[9px] text-emerald-300">タップで割り当て</div>
      )}

      {/* オペレーター（使役者）を右下隅に常時表示 */}
      <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 rounded-lg bg-black/30 px-1.5 py-1">
        <div
          style={{
            background: `radial-gradient(circle at 30% 25%, ${op.palette[2]} 0%, ${op.palette[1]} 45%, ${op.palette[0]} 100%)`,
            borderColor: op.palette[2],
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/arena/operators/${op.id}.png`}
            alt={op.name}
            style={{ imageRendering: "pixelated", width: "130%", height: "130%", objectFit: "cover" }}
          />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[9px] font-bold text-gray-100">{op.name}</div>
          <div className="truncate text-[7px] text-gray-400">{op.title}</div>
        </div>
      </div>
    </div>
  );
}
