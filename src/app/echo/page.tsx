"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EchoBattleCard from "@/components/EchoBattleCard";
import EnemyIcon from "@/components/EnemyIcon";
import ItemIcon from "@/components/ItemIcon";
import { faceByValue } from "@/data/diceFaces";
import { resolveEnemyTurn, resolvePlayerAction } from "@/lib/battle";
import { rollDice } from "@/lib/dice";
import { echoRewards, generateEcho, rollEchoEquipment } from "@/lib/echoBattle";
import { loadRanking, rankingSource, type RankingEntry } from "@/lib/ranking";
import { rarityStyle } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";
import type { Enemy, Equipment } from "@/types/game";

export default function EchoPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [fighting, setFighting] = useState<RankingEntry | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);
  useEffect(() => {
    loadRanking({ kind: "total" }).then(setEntries);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col gap-3 bg-[#0a0510] p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
        <span className="font-mono text-[10px] text-fuchsia-400/60">
          {rankingSource() === "supabase" ? "● ONLINE" : "○ LOCAL"}
        </span>
      </div>

      <div className="rounded-xl border border-fuchsia-500/30 bg-black/50 p-3 text-center">
        <h1 className="font-mono text-sm font-bold tracking-widest text-fuchsia-200">残響戦</h1>
        <p className="font-mono text-[10px] text-fuchsia-400/60">ECHO BATTLE</p>
        <p className="mt-1 text-[10px] text-gray-400">
          かつて深層に到達した者の記録が、残響として再構成された存在と戦う。
        </p>
      </div>

      {fighting ? (
        <EchoFight entry={fighting} canPlay={hydrated} onExit={() => setFighting(null)} />
      ) : (
        <div className="space-y-2">
          {entries.length === 0 && (
            <p className="font-mono text-xs text-fuchsia-400/60">記録を読み込み中…</p>
          )}
          {entries.map((e, i) => (
            <EchoBattleCard key={`${e.playerName}-${i}`} entry={e} onChallenge={() => setFighting(e)} />
          ))}
        </div>
      )}
    </main>
  );
}

type Phase = "fight" | "won" | "lost";

function EchoFight({
  entry,
  canPlay,
  onExit,
}: {
  entry: RankingEntry;
  canPlay: boolean;
  onExit: () => void;
}) {
  // Snapshot the player's build once (no reactive loops during the skirmish).
  const { stats, faces } = useMemo(() => {
    const s = useGameStore.getState();
    return { stats: s.stats(), faces: s.diceFaces };
  }, []);
  const enemy0 = useMemo<Enemy>(() => generateEcho(entry), [entry]);

  const [enemyHp, setEnemyHp] = useState(enemy0.maxHp);
  const [playerHp, setPlayerHp] = useState(stats.maxHp);
  const [dice, setDice] = useState<number>(() => rollDice());
  const [rerolls, setRerolls] = useState(stats.rerolls);
  const [phase, setPhase] = useState<Phase>("fight");
  const [log, setLog] = useState<string[]>([`${entry.playerName}の残響が立ちはだかる！`]);
  const [reward, setReward] = useState<{ gold: number; gachaPoints: number; rankPoints: number; item: Equipment | null } | null>(null);

  const push = (lines: string[]) => setLog((l) => [...l, ...lines].slice(-8));

  if (!canPlay) {
    return <p className="font-mono text-xs text-fuchsia-400/60">読み込み中…</p>;
  }

  const enemy: Enemy = { ...enemy0, hp: enemyHp, defense: enemy0.defense };
  const face = faceByValue(faces, dice as never);

  const reroll = () => {
    if (phase !== "fight" || rerolls <= 0) return;
    setDice(rollDice());
    setRerolls((r) => r - 1);
  };

  const confirm = () => {
    if (phase !== "fight") return;
    const action = resolvePlayerAction(face, stats, enemy);
    let eHp = enemyHp - action.enemyDamage;
    let pHp = Math.min(stats.maxHp, playerHp - action.selfDamage + action.heal);
    const lines = [...action.logs];

    if (eHp <= 0) {
      push([...lines, `${entry.playerName}の残響を打ち破った！`]);
      setEnemyHp(0);
      win();
      return;
    }
    // Echo's turn (CPU).
    const turn = resolveEnemyTurn(enemy, stats, action.guard);
    pHp -= turn.playerDamage;
    lines.push(...turn.logs);
    if (pHp <= 0) {
      push([...lines, "残響に敗れた…"]);
      setPlayerHp(0);
      setPhase("lost");
      return;
    }
    setEnemyHp(eHp);
    setPlayerHp(pHp);
    setRerolls(stats.rerolls);
    setDice(rollDice());
    push(lines);
  };

  const win = () => {
    const r = echoRewards(entry);
    const item = rollEchoEquipment(entry);
    useGameStore.getState().grantEchoRewards(r, item);
    setReward({ ...r, item });
    setPhase("won");
  };

  const enemyPct = Math.max(0, Math.round((enemyHp / enemy0.maxHp) * 100));
  const playerPct = Math.max(0, Math.round((playerHp / stats.maxHp) * 100));

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Echo */}
      <div className="flex items-center gap-3 rounded-xl border border-fuchsia-600/50 bg-fuchsia-950/30 p-3">
        <EnemyIcon enemy={enemy0} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-fuchsia-100">{enemy0.name}</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-800">
            <div className="h-full bg-gradient-to-r from-fuchsia-600 to-rose-400" style={{ width: `${enemyPct}%` }} />
          </div>
          <p className="text-[10px] text-gray-300">HP {Math.max(0, enemyHp)}/{enemy0.maxHp} ・ ⚔️{enemy0.attack} 🛡️{enemy0.defense}</p>
        </div>
      </div>

      {/* Player HP */}
      <div className="rounded-xl border border-white/10 bg-black/30 p-2">
        <div className="h-2 overflow-hidden rounded-full bg-gray-800">
          <div className="h-full bg-gradient-to-r from-green-600 to-emerald-400" style={{ width: `${playerPct}%` }} />
        </div>
        <p className="mt-1 text-[10px] text-gray-300">あなた HP {Math.max(0, playerHp)}/{stats.maxHp} ・ ⚔️{stats.attack} 🛡️{stats.defense}</p>
      </div>

      {/* Dice */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
        <div className="text-4xl font-black">🎲 {dice}</div>
        <p className="mt-1 text-sm font-bold text-emerald-200">{face.name}</p>
        <p className="text-[11px] text-gray-400">{face.description}</p>
      </div>

      {/* Log */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[11px] text-gray-300">
        {log.map((l, i) => (
          <p key={i}>・{l}</p>
        ))}
      </div>

      {/* Actions */}
      {phase === "fight" ? (
        <div className="flex gap-2">
          <button
            onClick={reroll}
            disabled={rerolls <= 0}
            className="h-14 flex-1 rounded-2xl bg-white/10 text-lg font-bold active:scale-95 disabled:opacity-40"
          >
            🎲 リロール ({rerolls})
          </button>
          <button
            onClick={confirm}
            className="h-14 flex-1 rounded-2xl bg-emerald-600 text-lg font-bold text-white active:scale-95"
          >
            ⚔️ 決定
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/15 bg-[#15131f] p-4 text-center">
          <h2 className={`text-xl font-extrabold ${phase === "won" ? "text-emerald-400" : "text-red-400"}`}>
            {phase === "won" ? "残響を打ち破った！" : "敗北…"}
          </h2>
          {phase === "won" && reward && (
            <div className="mt-2 space-y-1 text-sm text-gray-200">
              <p>💰 +{reward.gold} ・ 素材 +{reward.gachaPoints}</p>
              <p className="text-fuchsia-300">ランキングポイント +{reward.rankPoints}</p>
              {reward.item && (
                <div className={`mt-2 flex items-center gap-2 rounded-lg border p-2 text-left ${rarityStyle[reward.item.rarity].border} ${rarityStyle[reward.item.rarity].bg}`}>
                  <ItemIcon item={reward.item} size={40} />
                  <p className={`text-sm font-bold ${rarityStyle[reward.item.rarity].text}`}>🎁 {reward.item.name}</p>
                </div>
              )}
            </div>
          )}
          <button
            onClick={onExit}
            className="mt-4 h-12 w-full rounded-xl bg-white/10 font-bold active:scale-95"
          >
            残響一覧へ戻る
          </button>
        </div>
      )}
    </div>
  );
}
