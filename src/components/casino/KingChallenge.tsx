"use client";

import { useEffect, useRef, useState } from "react";
import {
  KING_BET,
  KING_JACKPOT,
  LEGEND_PIECE_HI,
  KING_SMALL_CEILING,
  KING_SMALL_PAY,
  type KingResult,
} from "@/lib/casinoKing";
import { EQUIP_SLOTS } from "@/lib/battle";
import { slotSfx } from "@/lib/audio";
import PachinkoBattle, { type BattlePhase } from "@/components/casino/PachinkoBattle";
import { fmt, slotLabel as equipSlotLabel } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";
import type { EquipmentSlot } from "@/types/game";

const KING_BOSS = { id: "casino_king", name: "カジノ王", emoji: "👑" } as const;
const KING_REEL_POOL = ["7️⃣", "👑", "💎", "🔔", "🍒", "⭐", "🅱️"];
const kingRnd = () => KING_REEL_POOL[Math.floor(Math.random() * KING_REEL_POOL.length)];
/** 出目を結果に合わせて確定（一撃=👑揃い / 小当たり=👑👑〇 / ハズレ=非揃い）。 */
function kingReelsFor(outcome: KingResult["outcome"]): string[] {
  if (outcome === "jackpot") return ["👑", "👑", "👑"];
  if (outcome === "smallLose") return ["👑", "👑", "💎"];
  return ["🍒", "🔔", "⭐"];
}

export default function KingChallenge() {
  const coins = useGameStore((s) => s.coins);
  const hiCoins = useGameStore((s) => s.hiCoins);
  const kingPlay = useGameStore((s) => s.kingPlay);
  const kingBuyLegend = useGameStore((s) => s.kingBuyLegend);
  const kingPity = useGameStore((s) => s.kingPity);
  const [reels, setReels] = useState<string[]>(["👑", "💎", "🍒"]);
  const [spinning, setSpinning] = useState(false);
  const [last, setLast] = useState<KingResult | null>(null);
  const [title, setTitle] = useState(false);
  const [battle, setBattle] = useState<BattlePhase>({ kind: "off" });
  const [jpFlash, setJpFlash] = useState(false);
  const [slot, setSlot] = useState<EquipmentSlot>("weapon");
  const [msg, setMsg] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const addT = (id: number) => timers.current.push(id);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const finish = (r: KingResult) => {
    setLast(r);
    busy.current = false;
    if (r.outcome === "jackpot") {
      slotSfx("bonusBig");
      setJpFlash(true);
      addT(window.setTimeout(() => setJpFlash(false), 4500));
    } else if (r.outcome === "smallLose") {
      slotSfx("small");
    }
  };

  const play = () => {
    if (busy.current) return;
    const r = kingPlay();
    if (!r) return;
    busy.current = true;
    setLast(null);
    setSpinning(true);
    slotSfx("lever");
    // リール回転（演出）→ 結果の出目で停止。
    const spin = window.setInterval(() => setReels([kingRnd(), kingRnd(), kingRnd()]), 70);
    addT(
      window.setTimeout(() => {
        window.clearInterval(spin);
        setSpinning(false);
        setReels(kingReelsFor(r.outcome));
        if (r.challenge) {
          // 小当たり → 「カジノ王への挑戦」カットイン（ド派手文字→スローモーション攻撃→決着）。
          setTitle(true);
          addT(
            window.setTimeout(() => {
              setTitle(false);
              setBattle({ kind: "decide", boss: KING_BOSS, ren: 1, win: r.outcome === "jackpot" });
              addT(
                window.setTimeout(() => {
                  setBattle({ kind: "off" });
                  finish(r);
                }, 2000),
              );
            }, 1000),
          );
        } else {
          finish(r);
        }
      }, 700),
    );
  };

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (useGameStore.getState().coins < KING_BET) {
        setAuto(false);
        return;
      }
      if (!busy.current) play();
    }, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const buy = () => {
    const w = kingBuyLegend(slot);
    if (w) {
      setMsg(`👑 ${w.name} を交換！`);
      window.setTimeout(() => setMsg(null), 2600);
    }
  };

  const canPlay = coins >= KING_BET && !busy.current;
  const canBuy = hiCoins >= LEGEND_PIECE_HI;
  const challenging = title || battle.kind !== "off";
  const ceilLeft = Math.max(0, KING_SMALL_CEILING - kingPity);

  return (
    <div className="relative flex flex-col gap-3">
      {jpFlash && <div className="rainbow-flash pointer-events-none fixed inset-0 z-40" />}

      {/* 「カジノ王への挑戦」カットイン（全画面）。ド派手文字→勇者がスローモーションで斬撃→決着。 */}
      {challenging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4">
          {title && (
            <div className="fate-pop text-center">
              <div className="bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 bg-clip-text text-3xl font-black tracking-wider text-transparent drop-shadow-[0_0_14px_rgba(251,191,36,0.8)]">
                ⚔️ カジノ王への挑戦！
              </div>
              <div className="mt-1 text-xs font-bold text-amber-200/80">勝てば…一撃。</div>
            </div>
          )}
          {battle.kind !== "off" && (
            <div className="relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-xl border border-amber-400/40">
              <PachinkoBattle phase={battle} />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-black/30 px-3 py-2 text-xs">
        <span className="font-bold text-amber-200">🪙 コイン {fmt(coins)}</span>
        <span className="font-bold text-cyan-200">💎 ハイコイン {fmt(hiCoins)}</span>
      </div>

      {/* 天井: 小当たりなしの回転数。KING_SMALL_CEILINGで小当たり確定。 */}
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 px-3 py-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-rose-200">🔥 小当たり天井まで</span>
          <span className="text-rose-100">残り {fmt(ceilLeft)} 回転</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full bg-rose-500 transition-all"
            style={{ width: `${Math.min(100, (kingPity / KING_SMALL_CEILING) * 100)}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-black/30 p-3 text-center">
        <p className="text-sm font-black text-amber-200">👑 カジノ王への挑戦</p>
        <p className="text-[10px] text-gray-400">〜そして伝説へ〜　100コインBETのスロット</p>

        {/* リール */}
        <div className="my-2 grid grid-cols-3 gap-2">
          {reels.map((s, i) => (
            <div
              key={i}
              className={`flex h-16 items-center justify-center rounded-lg border-2 text-4xl transition-colors ${
                spinning
                  ? "border-amber-400/40 bg-black/40 blur-[1px]"
                  : last?.outcome === "jackpot"
                    ? "animate-pulse border-amber-300 bg-amber-400/20"
                    : "border-white/10 bg-black/40"
              }`}
            >
              {s}
            </div>
          ))}
        </div>

        <div className="mb-2 min-h-[1.25rem]">
          {last && !challenging ? (
            last.outcome === "jackpot" ? (
              <p className="text-base font-black text-amber-200">💥 一撃！ +{fmt(last.coins)} ＆ 💎+{fmt(last.hi)}</p>
            ) : last.outcome === "smallLose" ? (
              <p className="text-sm font-bold text-emerald-200">小当たり +{fmt(last.coins)}（挑戦は惜敗…）</p>
            ) : (
              <p className="text-sm text-gray-500">…ハズレ</p>
            )
          ) : (
            <p className="text-[11px] text-gray-500">小当たり→〈カジノ王への挑戦〉で一撃を狙え！</p>
          )}
        </div>

        <button
          onClick={play}
          disabled={!canPlay || auto}
          className="h-14 w-full rounded-2xl bg-amber-500 text-lg font-extrabold text-black active:scale-95 disabled:opacity-40"
        >
          ● レバーON（-{KING_BET}）
        </button>
        <button
          onClick={() => setAuto((v) => !v)}
          disabled={coins < KING_BET && !auto}
          className={`mt-2 h-9 w-full rounded-xl text-xs font-bold active:scale-95 disabled:opacity-40 ${
            auto ? "bg-rose-600 text-white" : "bg-white/10 text-gray-300"
          }`}
        >
          オート: {auto ? "ON（停止）" : "OFF"}
        </button>
        {coins < KING_BET && <p className="mt-1 text-[11px] text-rose-300">コインが足りません（スロット/甘ダイスで稼いでね）。</p>}
        <p className="mt-1 text-[10px] text-gray-500">
          RTP≈0.7。小当たり(1/200・天井{KING_SMALL_CEILING})＝+{fmt(KING_SMALL_PAY)}＋挑戦(勝率1/10)。勝てば一撃 +{fmt(KING_JACKPOT)}＆💎ハイコイン！
        </p>
        <p className="text-[10px] text-gray-600">※設定・イベントデーの対象外（常に固定オッズ）。</p>
      </div>

      <div className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-3">
        <p className="text-sm font-bold text-violet-200">👑 伝説賭博セット（部位指定で交換）</p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          出目6確定＋会心の2倍／回避45%／ドロップ率2倍&レア比率増の“伝説級”装備。ハイコインでのみ交換。
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {EQUIP_SLOTS.map((sl) => (
            <button
              key={sl}
              onClick={() => setSlot(sl as EquipmentSlot)}
              className={`h-9 rounded-lg text-[11px] font-bold active:scale-95 ${
                slot === sl ? "bg-violet-600 text-white" : "bg-white/10 text-gray-300"
              }`}
            >
              {equipSlotLabel[sl as EquipmentSlot]}
            </button>
          ))}
        </div>
        <button
          onClick={buy}
          disabled={!canBuy}
          className="mt-2 h-12 w-full rounded-xl bg-violet-600 text-sm font-extrabold text-white active:scale-95 disabled:opacity-40"
        >
          {equipSlotLabel[slot]}を交換（💎{fmt(LEGEND_PIECE_HI)}）
        </button>
        {msg && <p className="mt-1 text-center text-sm font-bold text-emerald-200">{msg}</p>}
        <p className="mt-1 text-[10px] text-gray-500">
          6部位そろえると全効果が発動（各部位💎{fmt(LEGEND_PIECE_HI)}＝一撃 約4発ぶん）。
        </p>
      </div>
    </div>
  );
}
