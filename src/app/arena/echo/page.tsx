"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ECHO_GHOSTS, loadEchoClears, loadEchoSelf, recordEchoClear } from "@/data/arena/echo";
import type { EchoGhost, EchoSnapshot } from "@/data/arena/echo";
import { getField } from "@/data/arena/fields";
import { getMonster } from "@/data/arena/monsters";
import { getOperator } from "@/data/arena/operators";
import { simulateEcho } from "@/lib/arena/battle";
import { allyTeamPower } from "@/lib/arena/power";
import { sfx } from "@/lib/audio/sfx";
import type { BattleResult } from "@/types/arena";
import BattleView from "@/components/arena/BattleView";
import MonsterSprite from "@/components/arena/MonsterSprite";
import OperatorBadge from "@/components/arena/OperatorBadge";

export default function ArenaEchoPage() {
  const [self, setSelf] = useState<EchoSnapshot | null>(null);
  const [clears, setClears] = useState<string[]>([]);
  const [battle, setBattle] = useState<{ ghost: EchoGhost; result: BattleResult } | null>(null);
  const [done, setDone] = useState<{ ghost: EchoGhost; win: boolean } | null>(null);

  useEffect(() => {
    setSelf(loadEchoSelf());
    setClears(loadEchoClears());
  }, []);

  const startFight = (ghost: EchoGhost) => {
    if (!self) return;
    const result = simulateEcho(
      self.builds,
      self.operatorId,
      self.blessings,
      ghost.builds,
      ghost.operatorId,
      ghost.blessings,
      ghost.field,
    );
    sfx("select");
    setDone(null);
    setBattle({ ghost, result });
  };

  const onFinished = () => {
    if (!battle) return;
    const win = battle.result.win;
    if (win) setClears(recordEchoClear(battle.ghost.id));
    setDone({ ghost: battle.ghost, win });
    setBattle(null);
  };

  if (battle) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-3">
        <div className="text-center text-xs font-bold text-fuchsia-300">
          👻 残響戦：{battle.ghost.name}
        </div>
        <BattleView result={battle.result} onFinished={onFinished} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-3">
      <header className="text-center">
        <h1 className="text-xl font-black tracking-widest text-fuchsia-200">👻 残響戦</h1>
        <p className="text-[10px] text-fuchsia-400/70">ECHO BATTLE</p>
        <p className="mt-1 text-[10px] text-gray-400">
          かつてアリーナを駆けた編成の「残響」と、あなたの残響をぶつける観戦デュエル。
        </p>
        <Link href="/arena" className="text-[10px] text-gray-500 underline">
          ← アリーナへ戻る
        </Link>
      </header>

      {/* あなたの残響 */}
      <section className="rounded-2xl border border-fuchsia-500/30 bg-white/[0.03] p-3">
        <div className="mb-1 text-[11px] font-bold text-fuchsia-200">あなたの残響</div>
        {self ? (
          <SelfCard self={self} />
        ) : (
          <p className="text-[11px] text-gray-400">
            まだ記録がありません。通常モードを1回プレイ（優勝でも敗退でも）すると、その編成が
            「あなたの残響」として記録され、ここで戦えます。
          </p>
        )}
      </section>

      {/* 直近の結果 */}
      {done && (
        <div
          className={`rounded-2xl border p-3 text-center ${
            done.win ? "border-emerald-400/50 bg-emerald-500/10" : "border-rose-400/50 bg-rose-500/10"
          }`}
        >
          <div className="text-3xl">{done.win ? "🏆" : "💀"}</div>
          <div className="text-sm font-black">
            {done.win ? `${done.ghost.name} を撃破！` : `${done.ghost.name} に敗北…`}
          </div>
          <div className="text-[10px] text-gray-400">
            {done.win ? "残響を打ち破った証を刻んだ。" : "編成を鍛えて再挑戦しよう。"}
          </div>
        </div>
      )}

      {/* 名のある残響 */}
      <section className="space-y-2">
        <div className="text-[11px] font-bold text-gray-300">
          名のある残響（{clears.length}/{ECHO_GHOSTS.length} 撃破）
        </div>
        {ECHO_GHOSTS.map((g) => (
          <GhostCard
            key={g.id}
            ghost={g}
            cleared={clears.includes(g.id)}
            canFight={!!self}
            onFight={() => startFight(g)}
          />
        ))}
      </section>

      <p className="pb-4 text-center text-[10px] text-gray-600">
        残響戦は記録の再現バトル。勝っても負けても通常モードの成績には影響しません。
      </p>
    </main>
  );
}

function SelfCard({ self }: { self: EchoSnapshot }) {
  const op = getOperator(self.operatorId);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <OperatorBadge operator={op} size={28} />
        <span className="rounded bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-bold text-fuchsia-100">
          ★{self.power}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {self.builds.map((b, i) => {
          const m = getMonster(b.monsterId);
          return m ? <MonsterSprite key={i} monster={m} size={40} /> : null;
        })}
        <span className="text-[10px] text-gray-400">{self.label}</span>
      </div>
    </div>
  );
}

function GhostCard({
  ghost,
  cleared,
  canFight,
  onFight,
}: {
  ghost: EchoGhost;
  cleared: boolean;
  canFight: boolean;
  onFight: () => void;
}) {
  const f = getField(ghost.field);
  const power = useMemo(
    () => allyTeamPower(ghost.builds, ghost.field, ghost.operatorId, ghost.blessings),
    [ghost],
  );
  return (
    <div
      style={{ borderColor: f.accent }}
      className="flex items-center gap-2 rounded-2xl border bg-white/[0.03] p-2"
    >
      <div className="flex">
        {ghost.builds.map((b, i) => {
          const m = getMonster(b.monsterId);
          return m ? (
            <div key={i} className={i > 0 ? "-ml-2" : ""}>
              <MonsterSprite monster={m} size={34} />
            </div>
          ) : null;
        })}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[12px] font-bold">
          {cleared && <span className="text-emerald-400">✔</span>}
          {ghost.name}
          <span className="text-[9px] text-amber-300">{"★".repeat(ghost.tier)}</span>
        </div>
        <div className="truncate text-[9px] text-gray-400">
          {f.emoji}{f.name}・総合力 ★{power}
        </div>
        <div className="text-[9px] leading-tight text-gray-500">{ghost.flavor}</div>
      </div>
      <button
        onClick={onFight}
        disabled={!canFight}
        className="shrink-0 rounded-xl bg-fuchsia-600/80 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40 active:scale-95"
      >
        挑む
      </button>
    </div>
  );
}
