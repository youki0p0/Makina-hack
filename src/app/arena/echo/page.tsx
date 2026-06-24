"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  deleteEcho,
  ECHO_GHOSTS,
  LEGEND_ECHO,
  loadEchoClears,
  loadEchoGallery,
  recordEchoClear,
} from "@/data/arena/echo";
import type { EchoGhost, EchoSnapshot } from "@/data/arena/echo";
import { getField } from "@/data/arena/fields";
import { getMonster } from "@/data/arena/monsters";
import { getOperator } from "@/data/arena/operators";
import { rollField } from "@/lib/arena/gameState";
import { simulateEcho } from "@/lib/arena/battle";
import { allyTeamPower } from "@/lib/arena/power";
import {
  fetchLeaderboard,
  fetchOpponents,
  loadLocalStreak,
  loadPlayerName,
  onlineEnabled,
  publishEcho,
  reportResult,
  savePlayerName,
  updateLocalStreak,
  type LeaderboardEntry,
  type OnlineEcho,
} from "@/lib/arena/echoOnline";
import { sfx } from "@/lib/audio/sfx";
import type { BattleResult, FieldId } from "@/types/arena";
import BattleView from "@/components/arena/BattleView";
import MonsterSprite from "@/components/arena/MonsterSprite";
import OperatorBadge from "@/components/arena/OperatorBadge";

interface Foe {
  name: string;
  operatorId: string;
  builds: EchoSnapshot["builds"];
  blessings: string[];
  field: FieldId;
  ghostId?: string; // curated のみ
  online?: boolean; // オンライン対戦相手（ランキングに記録）
}

export default function ArenaEchoPage() {
  const [gallery, setGallery] = useState<EchoSnapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [clears, setClears] = useState<string[]>([]);
  const [battle, setBattle] = useState<{ foe: Foe; result: BattleResult } | null>(null);
  const [done, setDone] = useState<{ name: string; win: boolean } | null>(null);

  // オンライン
  const online = onlineEnabled();
  const [name, setName] = useState("");
  const [opponents, setOpponents] = useState<OnlineEcho[]>([]);
  const [netMsg, setNetMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const g = loadEchoGallery();
    setGallery(g);
    setActiveId(g[0]?.id ?? null);
    setClears(loadEchoClears());
    setName(loadPlayerName());
    setStreak(loadLocalStreak());
    if (onlineEnabled()) fetchLeaderboard(20).then(setLeaders);
  }, []);

  const active = useMemo(
    () => gallery.find((e) => e.id === activeId) ?? gallery[0] ?? null,
    [gallery, activeId],
  );

  const fight = (foe: Foe) => {
    if (!active) return;
    const result = simulateEcho(
      active.builds,
      active.operatorId,
      active.blessings,
      foe.builds,
      foe.operatorId,
      foe.blessings,
      foe.field,
    );
    sfx("select");
    setDone(null);
    setBattle({ foe, result });
  };

  const onFinished = () => {
    if (!battle) return;
    const win = battle.result.win;
    if (win && battle.foe.ghostId) setClears(recordEchoClear(battle.foe.ghostId));
    // オンライン対戦のみ勝敗ランキングに記録
    if (battle.foe.online) {
      setStreak(updateLocalStreak(win));
      reportResult(name || "Guest", win).then(() => fetchLeaderboard(20).then(setLeaders));
    }
    setDone({ name: battle.foe.name, win });
    setBattle(null);
  };

  const refreshOpponents = async () => {
    if (!online) return;
    setLoading(true);
    setNetMsg("");
    const list = await fetchOpponents(20);
    setOpponents(list);
    setNetMsg(list.length === 0 ? "対戦相手が見つかりません（まだ少ないかも）" : "");
    setLoading(false);
  };

  const publish = async () => {
    if (!online || !active) return;
    setLoading(true);
    savePlayerName(name);
    const ok = await publishEcho({
      playerName: name || "Guest",
      operatorId: active.operatorId,
      builds: active.builds,
      blessings: active.blessings,
      power: active.power,
    });
    setNetMsg(ok ? "✅ あなたの残響を公開しました！" : "⚠️ 公開に失敗（時間をおいて再試行）");
    setLoading(false);
  };

  if (battle) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-3">
        <div className="text-center text-xs font-bold text-fuchsia-300">
          👻 残響戦：{battle.foe.name}
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
        <Link href="/arena" className="text-[10px] text-gray-500 underline">
          ← アリーナへ戻る
        </Link>
      </header>

      {/* 残響ギャラリー（複数保存・対戦に使う1体を選ぶ） */}
      <section className="rounded-2xl border border-fuchsia-500/30 bg-white/[0.03] p-3">
        <div className="mb-1 text-[11px] font-bold text-fuchsia-200">
          残響ギャラリー（{gallery.length}/6）
        </div>
        {gallery.length === 0 ? (
          <p className="text-[11px] text-gray-400">
            まだ記録がありません。通常モードを1回プレイすると、その編成が残響として保存されます。
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-[9px] text-gray-500">タップで対戦に使う残響を選択</p>
            {gallery.map((e) => (
              <GalleryRow
                key={e.id}
                snap={e}
                active={active?.id === e.id}
                onSelect={() => setActiveId(e.id)}
                onDelete={() => {
                  const next = deleteEcho(e.id);
                  setGallery(next);
                  if (activeId === e.id) setActiveId(next[0]?.id ?? null);
                }}
              />
            ))}
          </div>
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
            {done.win ? `${done.name} に勝利！` : `${done.name} に敗北…`}
          </div>
        </div>
      )}

      {/* 名のある残響（curated） */}
      <section className="space-y-2">
        <div className="text-[11px] font-bold text-gray-300">
          名のある残響（{clears.length}/{ECHO_GHOSTS.length + 1} 撃破）
        </div>
        {ECHO_GHOSTS.map((g) => (
          <GhostCard
            key={g.id}
            ghost={g}
            cleared={clears.includes(g.id)}
            canFight={!!active}
            onFight={() =>
              fight({
                name: g.name,
                operatorId: g.operatorId,
                builds: g.builds,
                blessings: g.blessings,
                field: g.field,
                ghostId: g.id,
              })
            }
          />
        ))}
        {/* 👑 レジェンド残響：トーナメント優勝者（特別表示） */}
        <LegendCard
          ghost={LEGEND_ECHO}
          cleared={clears.includes(LEGEND_ECHO.id)}
          canFight={!!active}
          onFight={() =>
            fight({
              name: LEGEND_ECHO.name,
              operatorId: LEGEND_ECHO.operatorId,
              builds: LEGEND_ECHO.builds,
              blessings: LEGEND_ECHO.blessings,
              field: LEGEND_ECHO.field,
              ghostId: LEGEND_ECHO.id,
            })
          }
        />
      </section>

      {/* オンライン対戦 */}
      <section className="space-y-2 rounded-2xl border border-sky-500/30 bg-sky-500/[0.05] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-sky-200">🌐 オンライン対戦</span>
          <span className="text-[9px] text-sky-400/70">{online ? "● ONLINE" : "○ 未設定"}</span>
        </div>
        {!online ? (
          <p className="text-[10px] text-gray-400">
            オンライン対戦はこの環境では未設定です（サーバー接続情報が無い）。設定済みの本番では、
            あなたの残響を公開し、他プレイヤーの残響と対戦できます。
          </p>
        ) : !active ? (
          <p className="text-[10px] text-gray-400">先に残響を1つ記録してください。</p>
        ) : (
          <>
            <div className="flex gap-1.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="プレイヤー名"
                maxLength={16}
                className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[12px] text-gray-100"
              />
              <button
                onClick={publish}
                disabled={loading}
                className="rounded-lg bg-sky-600/80 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-40 active:scale-95"
              >
                残響を公開
              </button>
            </div>
            <button
              onClick={refreshOpponents}
              disabled={loading}
              className="w-full rounded-lg bg-white/10 py-1.5 text-[11px] font-bold text-gray-200 disabled:opacity-40 active:scale-95"
            >
              {loading ? "…通信中" : "🔄 対戦相手を探す"}
            </button>
            {netMsg && <p className="text-center text-[10px] text-sky-200">{netMsg}</p>}
            <div className="text-center text-[11px] font-bold text-amber-200">
              🔥 現在 {streak} 連勝中
            </div>
            {opponents.map((o) => (
              <OpponentRow
                key={o.id}
                opp={o}
                canFight={!!active}
                onFight={() =>
                  fight({
                    name: o.playerName,
                    operatorId: o.operatorId,
                    builds: o.builds,
                    blessings: o.blessings,
                    field: rollField(),
                    online: true,
                  })
                }
              />
            ))}
          </>
        )}
      </section>

      {/* オンライン勝敗ランキング */}
      {online && leaders.length > 0 && (
        <section className="space-y-1 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
          <div className="text-[11px] font-bold text-amber-200">🏅 オンラインランキング（最高連勝順）</div>
          {leaders.map((e, i) => {
            const total = e.wins + e.losses;
            const rate = total > 0 ? Math.round((e.wins / total) * 100) : 0;
            const me = name && e.playerName === name;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] ${
                  me ? "bg-amber-500/20" : "bg-black/20"
                }`}
              >
                <span className="w-5 shrink-0 text-center font-black text-amber-300">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold text-gray-100">
                  {e.playerName}
                  {me && <span className="ml-1 text-[8px] text-amber-300">YOU</span>}
                </span>
                <span className="shrink-0 text-amber-200">🔥{e.bestStreak}</span>
                <span className="shrink-0 text-gray-300">
                  {e.wins}勝{e.losses}敗・{rate}%
                </span>
              </div>
            );
          })}
        </section>
      )}

      <p className="pb-4 text-center text-[10px] text-gray-600">
        残響戦は記録の再現バトル。通常モードの成績には影響しません（オンライン対戦のみ勝敗を記録）。
      </p>
    </main>
  );
}

function TeamRow({ builds }: { builds: EchoSnapshot["builds"] }) {
  return (
    <div className="flex">
      {builds.map((b, i) => {
        const m = getMonster(b.monsterId);
        return m ? (
          <div key={i} className={i > 0 ? "-ml-2" : ""}>
            <MonsterSprite monster={m} size={32} />
          </div>
        ) : null;
      })}
    </div>
  );
}

function GalleryRow({
  snap,
  active,
  onSelect,
  onDelete,
}: {
  snap: EchoSnapshot;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const op = getOperator(snap.operatorId);
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border p-2 ${
        active ? "border-fuchsia-400 bg-fuchsia-500/15" : "border-white/10 bg-black/20"
      }`}
    >
      <button onClick={onSelect} className="flex flex-1 items-center gap-2 text-left active:scale-[0.98]">
        {active && <span className="text-fuchsia-300">◆</span>}
        <TeamRow builds={snap.builds} />
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold">{snap.label}</div>
          <div className="text-[9px] text-gray-400">
            {op.emoji}{op.name}・★{snap.power}
          </div>
        </div>
      </button>
      <button
        onClick={onDelete}
        className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-[10px] text-gray-400 active:scale-95"
        aria-label="削除"
      >
        🗑
      </button>
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
      <TeamRow builds={ghost.builds} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[12px] font-bold">
          {cleared && <span className="text-emerald-400">✔</span>}
          {ghost.name}
          <span className="text-[9px] text-amber-300">{"★".repeat(ghost.tier)}</span>
        </div>
        <div className="truncate text-[9px] text-gray-400">
          {f.emoji}{f.name}・★{power}
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

function LegendCard({
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
  const power = useMemo(
    () => allyTeamPower(ghost.builds, ghost.field, ghost.operatorId, ghost.blessings),
    [ghost],
  );
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-500/15 via-yellow-500/5 to-transparent p-2 shadow-[0_0_18px_rgba(251,191,36,0.25)]">
      <div className="pointer-events-none absolute -right-6 -top-6 text-6xl opacity-10">👑</div>
      <div className="mb-1 flex items-center gap-1 text-[9px] font-black tracking-widest text-amber-300">
        ✦ 20人の総当りを制した優勝者の残響 ✦
      </div>
      <div className="flex items-center gap-2">
        <TeamRow builds={ghost.builds} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[12px] font-black text-amber-100">
            {cleared && <span className="text-emerald-400">✔</span>}
            {ghost.name}
            <span className="text-[9px] text-amber-300">LEGEND</span>
          </div>
          <div className="truncate text-[9px] text-amber-200/70">⚱️遺跡・★{power}</div>
          <div className="text-[9px] leading-tight text-gray-400">{ghost.flavor}</div>
        </div>
        <button
          onClick={onFight}
          disabled={!canFight}
          className="shrink-0 rounded-xl bg-amber-500/90 px-3 py-2 text-[11px] font-black text-black disabled:opacity-40 active:scale-95"
        >
          挑む
        </button>
      </div>
    </div>
  );
}

function OpponentRow({
  opp,
  canFight,
  onFight,
}: {
  opp: OnlineEcho;
  canFight: boolean;
  onFight: () => void;
}) {
  const op = getOperator(opp.operatorId);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-sky-400/20 bg-black/20 p-2">
      <TeamRow builds={opp.builds} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-bold">{opp.playerName}</div>
        <div className="text-[9px] text-gray-400">
          {op.emoji}{op.name}・★{opp.power}
        </div>
      </div>
      <button
        onClick={onFight}
        disabled={!canFight}
        className="shrink-0 rounded-xl bg-sky-600/80 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40 active:scale-95"
      >
        対戦
      </button>
    </div>
  );
}
