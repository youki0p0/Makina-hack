// イベントデー用の小さな赤×金バッジ。点滅させて“今だけ”感を出す。
// 純粋表示なので Server/Client どちらからでも使える。
export default function EventBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-pulse rounded-sm border border-amber-300 bg-red-600 px-1 text-[8px] font-black leading-tight tracking-wider text-amber-100 ${className}`}
    >
      EVENT
    </span>
  );
}
