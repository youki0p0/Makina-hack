import { isBossRound } from "@/lib/arena/battle";
import { ACHIEVEMENTS } from "@/lib/arena/achievements";
import { BLESSING_MAP } from "@/lib/arena/blessings";
import { getMonster } from "@/data/arena/monsters";
import { MODE_CONFIG } from "@/lib/arena/gameState";
import { rankTitle } from "@/lib/arena/rank";
import type { RunState } from "@/types/arena";
import MonsterSprite from "./MonsterSprite";

/** ラウンド結果 / 優勝 / 敗退の表示。 */
export default function ResultView({
  run,
  fresh = [],
  onNext,
  onQuit,
}: {
  run: RunState;
  fresh?: string[];
  onNext: () => void;
  onQuit: () => void;
}) {
  const freshDefs = ACHIEVEMENTS.filter((a) => fresh.includes(a.id));
  const cfg = MODE_CONFIG[run.mode];
  const r = run.lastResult;
  const terminal = run.phase === "victory" || run.phase === "gameover";

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      {run.phase === "victory" && (
        <>
          <div className="text-5xl">🏆</div>
          <h2 className="text-2xl font-black text-amber-300">優勝！</h2>
          <p className="text-sm text-gray-300">
            {cfg.label}を {run.wins} 勝で制覇！ ランク <b>{rankTitle(run.wins)}</b>
          </p>
        </>
      )}
      {run.phase === "gameover" && (
        <>
          <div className="text-5xl">🥀</div>
          <h2 className="text-2xl font-black text-rose-300">敗退…</h2>
          <p className="text-sm text-gray-300">
            {run.wins} 勝 / {run.round} 回戦で力尽きた。次はビルドを変えて挑もう。
          </p>
        </>
      )}
      {!terminal && r && (
        <>
          <div className="text-5xl">{r.win ? "✨" : "💢"}</div>
          <h2 className={`text-xl font-black ${r.win ? "text-emerald-300" : "text-rose-300"}`}>
            {r.win ? "このラウンド 勝利！" : "このラウンド 敗北…"}
          </h2>
          <p className="text-xs text-gray-400">
            {r.reason === "timeout" ? "時間切れ：残HP合計で判定" : "全滅で決着"}
            （味方残HP {r.allyHpLeft} / 敵残HP {r.enemyHpLeft}）
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-[11px]">
            {r.mvp && (
              <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-amber-200">
                🏅 MVP: {r.mvp.name}（{r.mvp.dealt}ダメージ）
              </span>
            )}
            {r.firstDown && (
              <span className="rounded-lg bg-white/10 px-2 py-1 text-gray-300">
                {r.firstDown.side === "ally" ? "💀 先に落ちた味方" : "🎯 最初に倒した敵"}: {r.firstDown.name}
              </span>
            )}
          </div>
        </>
      )}

      {terminal && (
        <div className="w-full max-w-xs space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] font-bold text-gray-300">このランの軌跡</div>
          <div className="flex justify-center gap-3">
            {run.builds.map((b, i) => {
              const m = getMonster(b.monsterId);
              return m ? <MonsterSprite key={i} monster={m} size={44} /> : null;
            })}
          </div>
          {run.blessings.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1">
              <span className="text-[10px] text-amber-300">✨</span>
              {run.blessings.map((id, i) => (
                <span key={i} className="text-[14px]" title={BLESSING_MAP[id]?.name}>
                  {BLESSING_MAP[id]?.emoji}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {freshDefs.length > 0 && (
        <div className="w-full max-w-xs space-y-1 rounded-xl border border-amber-400/50 bg-amber-500/10 p-2">
          <div className="text-[11px] font-bold text-amber-200">🏆 実績解除！</div>
          {freshDefs.map((a) => (
            <div key={a.id} className="text-[11px] text-amber-100">
              {a.emoji} {a.name} <span className="text-amber-200/70">— {a.desc}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 text-sm font-bold text-gray-200">
        <span className="rounded-lg bg-emerald-500/20 px-3 py-1">🏅 {run.wins} 勝</span>
        <span className="rounded-lg bg-white/10 px-3 py-1">❤️ ライフ {run.life}</span>
        <span className="rounded-lg bg-white/10 px-3 py-1">🎯 目標 {cfg.targetWins} 勝</span>
      </div>

      <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
        {!terminal && isBossRound(run.round + 1) && (
          <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 py-2 text-[12px] font-bold text-amber-200">
            👑 次は ボス戦！ 編成を整えよう
          </div>
        )}
        {!terminal ? (
          <button
            onClick={onNext}
            className="rounded-2xl bg-emerald-600 py-3 text-base font-extrabold text-white active:scale-95"
          >
            ▶ 次のラウンドへ
          </button>
        ) : (
          <button
            onClick={onQuit}
            className="rounded-2xl bg-emerald-600 py-3 text-base font-extrabold text-white active:scale-95"
          >
            🏠 メニューへ戻る
          </button>
        )}
        {!terminal && (
          <button
            onClick={onQuit}
            className="rounded-xl bg-white/10 py-2 text-xs font-bold text-gray-300 active:scale-95"
          >
            ✖ ゲームをやめてメニューへ
          </button>
        )}
      </div>
    </div>
  );
}
