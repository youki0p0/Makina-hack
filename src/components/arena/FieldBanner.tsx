import { getField } from "@/data/arena/fields";
import type { FieldId } from "@/types/arena";

/** 上部の大きなフィールド表示。技の変質を予感させる。 */
export default function FieldBanner({
  field,
  round,
  children,
}: {
  field: FieldId;
  round?: number;
  children?: React.ReactNode;
}) {
  const f = getField(field);
  return (
    <div
      style={{ background: f.background, borderColor: f.accent }}
      className="relative w-full overflow-hidden rounded-2xl border p-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{f.emoji}</span>
          <div className="leading-tight">
            <div className="text-sm font-black" style={{ color: f.accent }}>
              {f.name}
            </div>
            <div className="text-[10px] text-white/70">{f.theme}</div>
          </div>
        </div>
        {round != null && (
          <span className="rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-bold text-white">
            {round} 回戦
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-white/80">{f.desc}</p>
      {children}
    </div>
  );
}
