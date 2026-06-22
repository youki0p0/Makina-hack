"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  DAILY_QUESTS,
  LOGIN_CALENDAR,
  questCounters,
  questDone,
  questProgress,
  rewardText,
  WEEKLY_QUESTS,
  type QuestDef,
} from "@/data/quests";
import { todayKey } from "@/lib/maintenance";
import { useGameStore } from "@/store/gameStore";
import type { QuestSnapshot } from "@/types/game";

function QuestRow({
  q,
  scope,
  cur,
  base,
  claimed,
  onClaim,
}: {
  q: QuestDef;
  scope: "daily" | "weekly";
  cur: QuestSnapshot;
  base: QuestSnapshot;
  claimed: boolean;
  onClaim: (scope: "daily" | "weekly", id: string) => void;
}) {
  const prog = Math.min(q.target, questProgress(cur, base, q.metric));
  const done = questDone(cur, base, q);
  const pct = Math.round((prog / q.target) * 100);
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-2">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-bold text-gray-100">{q.label}</span>
        <span className="text-[10px] text-gray-400">{prog}/{q.target}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/50">
        <div className={`h-full rounded-full ${done ? "bg-emerald-400" : "bg-sky-400"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-amber-200">{rewardText(q.reward)}</span>
        <button
          onClick={() => onClaim(scope, q.id)}
          disabled={!done || claimed}
          className={`rounded-lg px-3 py-1 text-xs font-bold active:scale-95 disabled:opacity-40 ${
            claimed ? "bg-white/10 text-gray-400" : "bg-emerald-600 text-white"
          }`}
        >
          {claimed ? "受取済" : "受け取る"}
        </button>
      </div>
    </div>
  );
}

export default function MissionsPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const progress = useGameStore((s) => s.progress);
  const loginDay = useGameStore((s) => s.loginDay);
  const loginClaimKey = useGameStore((s) => s.loginClaimKey);
  const claimLogin = useGameStore((s) => s.claimLogin);
  const dailyBase = useGameStore((s) => s.dailyQuestBase);
  const dailyClaimed = useGameStore((s) => s.dailyClaimed);
  const weeklyBase = useGameStore((s) => s.weeklyQuestBase);
  const weeklyClaimed = useGameStore((s) => s.weeklyClaimed);
  const claimQuest = useGameStore((s) => s.claimQuest);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <main className="flex min-h-dvh items-center justify-center text-gray-500">読み込み中…</main>;
  }

  const cur = questCounters(progress);
  const canClaimLogin = loginClaimKey !== todayKey();

  return (
    <main className="flex min-h-dvh flex-col gap-4 p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">← タイトル</Link>
        <span className="text-xs text-gray-400">🎁 デイリー / ウィークリー</span>
      </div>

      {/* ログインボーナスカレンダー */}
      <section className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
        <h2 className="text-sm font-extrabold text-amber-200">🎁 ログインボーナス</h2>
        <div className="grid grid-cols-7 gap-1">
          {LOGIN_CALENDAR.map((r, i) => {
            const isToday = i === loginDay;
            const claimedSlot = i < loginDay; // この周回で受領済み
            return (
              <div
                key={i}
                className={`flex flex-col items-center justify-center rounded-lg border py-1 text-center ${
                  isToday
                    ? "border-amber-300 bg-amber-400/25"
                    : claimedSlot
                      ? "border-emerald-500/40 bg-emerald-600/15"
                      : "border-white/10 bg-black/30"
                }`}
              >
                <span className="text-[8px] text-gray-400">Day{i + 1}</span>
                <span className="text-base leading-none">{claimedSlot ? "✅" : rewardEmoji(r.kind)}</span>
                <span className="text-[8px] text-gray-300">{r.amount}</span>
              </div>
            );
          })}
        </div>
        <button
          onClick={claimLogin}
          disabled={!canClaimLogin}
          className="h-12 w-full rounded-2xl bg-amber-600 font-extrabold text-white active:scale-95 disabled:opacity-40"
        >
          {canClaimLogin ? `Day${loginDay + 1} を受け取る（${rewardText(LOGIN_CALENDAR[loginDay])}）` : "本日受取済み（また明日！）"}
        </button>
      </section>

      {/* デイリークエスト */}
      <section className="space-y-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3">
        <h2 className="text-sm font-extrabold text-sky-200">📅 デイリークエスト <span className="text-[10px] font-normal text-gray-400">毎日0時リセット</span></h2>
        {DAILY_QUESTS.map((q) => (
          <QuestRow key={q.id} q={q} scope="daily" cur={cur} base={dailyBase} claimed={dailyClaimed.includes(q.id)} onClaim={claimQuest} />
        ))}
      </section>

      {/* ウィークリークエスト */}
      <section className="space-y-2 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3">
        <h2 className="text-sm font-extrabold text-fuchsia-200">🗓️ ウィークリークエスト <span className="text-[10px] font-normal text-gray-400">月曜0時リセット</span></h2>
        {WEEKLY_QUESTS.map((q) => (
          <QuestRow key={q.id} q={q} scope="weekly" cur={cur} base={weeklyBase} claimed={weeklyClaimed.includes(q.id)} onClaim={claimQuest} />
        ))}
      </section>
    </main>
  );
}

function rewardEmoji(kind: string): string {
  return (
    { gold: "🪙", gacha: "🔮", coins: "🎰", souls: "🪽", shard: "🔹", core: "🔶", sigil: "💠" } as Record<string, string>
  )[kind] ?? "🎁";
}
