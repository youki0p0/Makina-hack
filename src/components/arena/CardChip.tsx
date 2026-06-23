import { getCard, isSkill } from "@/data/arena/cards";

const RARITY_RING: Record<number, string> = {
  1: "border-white/15",
  2: "border-sky-400/50",
  3: "border-amber-400/70",
};

const RARITY_LABEL: Record<number, string> = { 1: "C", 2: "R", 3: "SR" };

/** ドラフト/編成で使うカードの小さな表示。技は緑寄り、装備は紫寄り。 */
export default function CardChip({
  cardId,
  onClick,
  selected = false,
  compact = false,
}: {
  cardId: string;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
}) {
  const card = getCard(cardId);
  if (!card) return null;
  const skill = isSkill(card);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-xl border ${
        RARITY_RING[card.rarity]
      } ${skill ? "bg-emerald-500/10" : "bg-fuchsia-500/10"} ${
        compact ? "p-1.5" : "p-2"
      } text-left ${onClick ? "active:scale-95" : ""} ${
        selected ? "ring-2 ring-amber-300" : ""
      }`}
    >
      <span className={compact ? "text-base" : "text-lg"}>{card.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className={`truncate font-bold ${compact ? "text-[11px]" : "text-xs"}`}>
            {card.name}
          </span>
          <span className="rounded bg-black/30 px-1 text-[8px] text-gray-300">
            {RARITY_LABEL[card.rarity]}
          </span>
        </span>
        {!compact && (
          <span className="block text-[10px] leading-snug text-gray-300">{card.desc}</span>
        )}
        <span className="mt-0.5 flex flex-wrap gap-0.5">
          {card.tags.slice(0, 4).map((t) => (
            <span key={t} className="rounded bg-white/10 px-1 text-[8px] text-gray-400">
              {t}
            </span>
          ))}
        </span>
      </span>
    </Tag>
  );
}
