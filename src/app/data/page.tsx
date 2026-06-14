"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";

export default function DataPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const exportSaveData = useGameStore((s) => s.exportSaveData);
  const importSaveData = useGameStore((s) => s.importSaveData);

  const [code, setCode] = useState("");
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-gray-500">読み込み中…</main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
        <h1 className="font-bold">💾 データ引き継ぎ</h1>
        <p className="mt-1 text-[10px] text-gray-400">
          コードを書き出して別端末に貼り付け。インポートは現在のデータを上書きします。
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-300">エクスポート</h2>
        <button
          onClick={() => setCode(exportSaveData())}
          className="h-11 w-full rounded-xl bg-sky-600 font-bold text-white active:scale-95"
        >
          コードを書き出す
        </button>
        {code && (
          <>
            <textarea
              readOnly
              value={code}
              onFocus={(e) => e.currentTarget.select()}
              className="h-24 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-[10px] text-gray-200"
            />
            <button
              onClick={() => {
                navigator.clipboard?.writeText(code);
                setMsg("コードをコピーしました");
              }}
              className="h-10 w-full rounded-xl bg-white/10 font-bold active:scale-95"
            >
              コピー
            </button>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-300">インポート</h2>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="コードを貼り付け"
          className="h-24 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-[10px] text-gray-200"
        />
        <button
          onClick={() => {
            if (!importText.trim()) return;
            if (!confirm("現在のデータを上書きします。よろしいですか？")) return;
            const ok = importSaveData(importText);
            setMsg(ok ? "インポートに成功しました" : "コードが正しくありません");
            if (ok) setImportText("");
          }}
          className="h-11 w-full rounded-xl bg-emerald-600 font-bold text-white active:scale-95"
        >
          インポート（上書き）
        </button>
      </section>

      {msg && <p className="text-center text-xs text-amber-300">{msg}</p>}
    </main>
  );
}
