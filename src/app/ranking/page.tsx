"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RankingList from "@/components/RankingList";
import { CLASSES } from "@/data/classes";
import { DIFFICULTY_LIST } from "@/data/difficulty";
import {
  loadRanking,
  rankingSource,
  submitRanking,
  type RankingEntry,
  type RankingFilter,
} from "@/lib/ranking";
import { useGameStore } from "@/store/gameStore";

type Tab = "total" | "endless" | "makina" | "job" | "difficulty";

export default function RankingPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const currentRankingEntry = useGameStore((s) => s.currentRankingEntry);

  const [tab, setTab] = useState<Tab>("total");
  // 新(era2)/旧(era1)ランキングの切り替え。難易度刷新で旧記録はアーカイブとして閲覧のみ。
  const [era, setEra] = useState<"new" | "old">("new");
  const [job, setJob] = useState("mage");
  const [difficulty, setDifficulty] = useState("hell");
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const filter: RankingFilter =
    tab === "job"
      ? { kind: "job", job }
      : tab === "difficulty"
        ? { kind: "difficulty", difficulty }
        : { kind: tab };

  useEffect(() => {
    let live = true;
    setLoading(true);
    loadRanking(filter).then((rows) => {
      if (live) {
        setEntries(rows);
        setLoading(false);
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, job, difficulty]);

  const submit = async () => {
    const entry = currentRankingEntry(name);
    const res = await submitRanking(entry);
    if (res.source === "rejected") setStatus("記録を送信できません（数値が範囲外）");
    else if (res.source === "duplicate")
      setStatus("⚠️ この名前は既に使われています（重複しています）。別の名前にしてください");
    else setStatus(res.source === "supabase" ? "記録を送信しました（オンライン）" : "記録を保存しました（ローカル）");
    // On a duplicate the record wasn't saved, so the board is unchanged.
    if (res.source !== "duplicate") {
      const rows = await loadRanking(filter);
      setEntries(rows);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col gap-3 bg-[#04100a] p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
        <span className="font-mono text-[10px] text-emerald-500/60">
          {rankingSource() === "supabase" ? "● ONLINE" : "○ LOCAL"}
        </span>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-black/50 p-3 text-center">
        <h1 className="font-mono text-sm font-bold tracking-widest text-emerald-300">
          深層到達者ログ
        </h1>
        <p className="font-mono text-[10px] text-emerald-500/60">DEEP-DIVE RECORDS</p>
      </div>

      {/* Submit own record */}
      <div className="rounded-xl border border-emerald-500/20 bg-black/40 p-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="記録者名 (未入力=Guest)"
            maxLength={16}
            className="h-9 min-w-0 flex-1 rounded-lg border border-emerald-500/20 bg-black/50 px-2 font-mono text-sm text-emerald-100 placeholder:text-emerald-700"
          />
          <button
            onClick={submit}
            disabled={!hydrated}
            className="h-9 shrink-0 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white active:scale-95 disabled:opacity-40"
          >
            記録を残す
          </button>
        </div>
        {status && <p className="mt-1 font-mono text-[10px] text-emerald-400">{status}</p>}
        <p className="mt-1 font-mono text-[9px] text-emerald-600/70">
          ※ 個人情報は送信されません。名前は任意です。
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-5 gap-1">
        {([
          ["total", "総合"],
          ["job", "ジョブ"],
          ["difficulty", "難易度"],
          ["endless", "Endless"],
          ["makina", "神機"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-9 rounded-lg text-[11px] font-bold active:scale-95 ${
              tab === t ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "job" && (
        <select
          value={job}
          onChange={(e) => setJob(e.target.value)}
          className="h-9 rounded-lg border border-white/15 bg-black/40 px-2 text-sm font-bold text-gray-100"
        >
          {CLASSES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      )}
      {tab === "difficulty" && (
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="h-9 rounded-lg border border-white/15 bg-black/40 px-2 text-sm font-bold text-gray-100"
        >
          {DIFFICULTY_LIST.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      )}

      {/* 新/旧ランキング切替（難易度刷新で旧記録はアーカイブとして保全） */}
      <div className="mb-2 flex gap-1">
        {([
          ["new", "🆕 新ランキング"],
          ["old", "📜 旧ランキング"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setEra(k)}
            className={`h-8 flex-1 rounded-lg text-[11px] font-bold active:scale-95 ${
              era === k ? "bg-sky-600 text-white" : "bg-white/10 text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {era === "old" && (
        <p className="mb-1 text-[10px] text-amber-300/80">
          ※難易度刷新前の記録（閲覧のみ・更新されません）
        </p>
      )}

      {loading ? (
        <p className="font-mono text-xs text-emerald-500/60">読み込み中…</p>
      ) : (
        <RankingList
          entries={entries.filter((e) => (era === "old" ? e.era === 1 : e.era !== 1))}
          filter={filter}
        />
      )}

      <Link
        href="/echo"
        className="mt-auto h-12 rounded-2xl border border-fuchsia-500/40 bg-fuchsia-500/10 pt-3 text-center font-bold text-fuchsia-200 active:scale-95"
      >
        👤 残響戦へ (Echo Battle)
      </Link>
    </main>
  );
}
