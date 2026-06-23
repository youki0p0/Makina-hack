import CardChip from "./CardChip";

/** ドラフト：提示カードから選び、捨て、リロールする。割り当て先は親が制御。 */
export default function CardDraft({
  draft,
  rerolls,
  selectedCardId,
  onSelect,
  onDiscard,
  onReroll,
}: {
  draft: string[];
  rerolls: number;
  selectedCardId: string | null;
  onSelect: (id: string) => void;
  onDiscard: (id: string) => void;
  onReroll: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-300">🃏 ドラフト（選んで味方に割り当て）</span>
        <button
          onClick={onReroll}
          disabled={rerolls <= 0}
          className="rounded-lg bg-sky-700/70 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40 active:scale-95"
        >
          🔄 リロール（残{rerolls}）
        </button>
      </div>

      {draft.length === 0 ? (
        <p className="py-2 text-center text-[10px] text-gray-500">
          このターンのカードは配り終えた。準備完了でOK！
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {draft.map((id) => (
            <div key={id} className="flex items-stretch gap-1">
              <div className="flex-1">
                <CardChip
                  cardId={id}
                  selected={selectedCardId === id}
                  onClick={() => onSelect(id)}
                />
              </div>
              <button
                onClick={() => onDiscard(id)}
                className="rounded-xl bg-white/5 px-2 text-[10px] text-gray-400 active:scale-95"
                aria-label="捨てる"
              >
                捨
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedCardId && (
        <p className="mt-1.5 text-center text-[10px] text-emerald-300">
          ⬇ どの味方に持たせる？ 下の3体から選んでね
        </p>
      )}
    </div>
  );
}
