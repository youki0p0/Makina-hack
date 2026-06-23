"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MONSTERS, getMonster, COLOR_DOT } from "@/data/arena/monsters";
import { OPERATORS } from "@/data/arena/operators";
import { getOperator } from "@/data/arena/operators";
import { MODE_CONFIG } from "@/lib/arena/gameState";
import { rankTitle } from "@/lib/arena/rank";
import { useArenaStore } from "@/store/arenaStore";
import type { GameMode } from "@/types/arena";
import BattleView from "@/components/arena/BattleView";
import CardDraft from "@/components/arena/CardDraft";
import CardSetPanel from "@/components/arena/CardSetPanel";
import CharacterStatusPanel from "@/components/arena/CharacterStatusPanel";
import FieldBanner from "@/components/arena/FieldBanner";
import MonsterSprite from "@/components/arena/MonsterSprite";
import OperatorBadge from "@/components/arena/OperatorBadge";
import ResultView from "@/components/arena/ResultView";

export default function ArenaPage() {
  const hydrate = useArenaStore((s) => s.hydrate);
  const hydrated = useArenaStore((s) => s.hydrated);
  const run = useArenaStore((s) => s.run);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-gray-500">読み込み中…</main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-3">
      {!run ? <SetupScreen /> : <GameScreen />}
    </main>
  );
}

// ===== セットアップ画面 =====
function SetupScreen() {
  const startRun = useArenaStore((s) => s.startRun);
  const ranks = useArenaStore((s) => s.ranks);
  const [mode, setMode] = useState<GameMode>("short");
  const [operatorId, setOperatorId] = useState(OPERATORS[0].id);
  const [team, setTeam] = useState<string[]>([]);

  const op = getOperator(operatorId);

  const toggleMonster = (id: string) => {
    setTeam((t) => {
      if (t.includes(id)) return t.filter((x) => x !== id);
      if (t.length >= 3) return t;
      return [...t, id];
    });
  };

  const canStart = team.length === 3;

  return (
    <>
      <header className="text-center">
        <h1 className="text-2xl font-black tracking-tight">
          🜨 アリーナ・オブ・ダイス
        </h1>
        <p className="text-[11px] text-gray-400">
          カードセット構築型 3v3 オートバトラー
        </p>
        <Link href="/" className="text-[10px] text-gray-500 underline">
          ← Dice Ex Machina メニューへ
        </Link>
      </header>

      {/* モード選択 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-2 text-xs font-bold text-gray-300">① モードを選ぶ</div>
        <div className="flex gap-2">
          {(["short", "long"] as GameMode[]).map((m) => {
            const cfg = MODE_CONFIG[m];
            const rk = ranks[m];
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-xl border p-2 text-left ${
                  mode === m ? "border-emerald-400 bg-emerald-500/15" : "border-white/10 bg-black/20"
                } active:scale-95`}
              >
                <div className="text-sm font-bold">{cfg.label}</div>
                <div className="text-[10px] text-gray-400">
                  {cfg.targetWins}勝で優勝 / ライフ{cfg.lives}
                </div>
                <div className="mt-1 text-[10px] text-amber-300">
                  {rankTitle(rk.bestWins)}（最高{rk.bestWins}勝）
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* オペレーター選択 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-2 text-xs font-bold text-gray-300">② オペレーター（あなたの分身）</div>
        <div className="flex flex-col gap-1.5">
          {OPERATORS.map((o) => (
            <button
              key={o.id}
              onClick={() => setOperatorId(o.id)}
              className={`rounded-xl border p-2 text-left ${
                operatorId === o.id ? "border-amber-400 bg-amber-500/10" : "border-white/10 bg-black/20"
              } active:scale-[0.98]`}
            >
              <OperatorBadge operator={o} size={34} showPassive />
            </button>
          ))}
        </div>
        <p className="mt-1 text-[9px] leading-snug text-gray-500">{op.concept}</p>
      </section>

      {/* モンスター選択 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-2 text-xs font-bold text-gray-300">
          ③ 使役モンスターを3体選ぶ（{team.length}/3）
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONSTERS.map((m) => {
            const picked = team.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggleMonster(m.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 ${
                  picked ? "border-emerald-400 bg-emerald-500/15" : "border-white/10 bg-black/20"
                } active:scale-95`}
              >
                <MonsterSprite monster={m} size={38} dimmed={!picked && team.length >= 3} />
                <div className="text-[9px] font-bold leading-tight">
                  {COLOR_DOT[m.color]} {m.name}
                </div>
                <div className="text-[8px] text-gray-400">{m.role}</div>
              </button>
            );
          })}
        </div>
        {team.length > 0 && (
          <div className="mt-2 text-[10px] text-gray-400">
            選択中：{team.map((id) => getMonster(id)?.name).join(" / ")}
          </div>
        )}
      </section>

      <button
        disabled={!canStart}
        onClick={() => startRun(mode, operatorId, team)}
        className="rounded-2xl bg-emerald-600 py-4 text-lg font-extrabold text-white shadow-lg disabled:opacity-40 active:scale-95"
      >
        {canStart ? "▶ バトル開始！" : "モンスターを3体選んでね"}
      </button>

      <p className="pb-4 text-center text-[10px] text-gray-600">
        毎ラウンド：フィールドが技を書き換える → カードを選んで3体に割り当て → 準備完了で自動戦闘
      </p>
    </>
  );
}

// ===== ゲーム画面 =====
function GameScreen() {
  const run = useArenaStore((s) => s.run)!;
  const assignCard = useArenaStore((s) => s.assignCard);
  const discardCard = useArenaStore((s) => s.discardCard);
  const rerollDraft = useArenaStore((s) => s.rerollDraft);
  const confirmPrep = useArenaStore((s) => s.confirmPrep);
  const finishBattle = useArenaStore((s) => s.finishBattle);
  const nextRound = useArenaStore((s) => s.nextRound);
  const quitToMenu = useArenaStore((s) => s.quitToMenu);

  const [selected, setSelected] = useState<string | null>(null);
  const op = getOperator(run.operatorId);
  const cfg = MODE_CONFIG[run.mode];

  if (run.phase === "battle" && run.lastResult) {
    return <BattleView result={run.lastResult} onFinished={finishBattle} />;
  }

  if (run.phase === "result" || run.phase === "victory" || run.phase === "gameover") {
    return <ResultView run={run} onNext={nextRound} onQuit={quitToMenu} />;
  }

  // draft フェーズ
  const onAssign = (slot: number) => {
    if (!selected) return;
    assignCard(selected, slot);
    setSelected(null);
  };

  return (
    <>
      {/* ヘッダー：成績 + オペレーター */}
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-2">
        <OperatorBadge operator={op} size={32} />
        <div className="flex gap-1.5 text-[10px] font-bold">
          <span className="rounded bg-emerald-500/20 px-2 py-1">🏅{run.wins}/{cfg.targetWins}</span>
          <span className="rounded bg-white/10 px-2 py-1">❤️{run.life}</span>
        </div>
      </div>

      <FieldBanner field={run.field} round={run.round} />

      <CardDraft
        draft={run.draft}
        rerolls={run.rerolls}
        selectedCardId={selected}
        onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
        onDiscard={(id) => {
          discardCard(id);
          if (selected === id) setSelected(null);
        }}
        onReroll={rerollDraft}
      />

      <div>
        <div className="mb-1 text-[11px] font-bold text-gray-300">
          🐲 味方3体{selected ? "（割り当て先を選ぶ）" : ""}
        </div>
        <CharacterStatusPanel
          builds={run.builds}
          field={run.field}
          operatorId={run.operatorId}
          assigning={selected !== null}
          onAssign={onAssign}
        />
      </div>

      <CardSetPanel builds={run.builds} operatorId={run.operatorId} />

      <button
        onClick={confirmPrep}
        className="sticky bottom-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-4 text-lg font-extrabold text-white shadow-xl active:scale-95"
      >
        ⚔️ 準備完了！！
      </button>

      <button
        onClick={quitToMenu}
        className="pb-3 text-center text-[10px] text-gray-500 underline"
      >
        ✖ ゲームをやめてメニューへ
      </button>
    </>
  );
}
