"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  bjResolve,
  bjTotal,
  dealerPlay,
  doubleUp,
  drawDie,
  fateCost,
  COIN_VALUE,
  SLOT_BET,
  type BjOutcome,
} from "@/lib/casino";
import { estimateTier } from "@/data/items";
import { EQUIP_SLOTS } from "@/lib/battle";
import { ENEMY_TEMPLATES, BOSS_TEMPLATES } from "@/data/enemies";
import EnemyIcon from "@/components/EnemyIcon";
import PixelGlyph from "@/components/PixelGlyph";
import { fmt } from "@/lib/ui";
import { useGameStore, type FateResult, type SlotSpinResult } from "@/store/gameStore";

const PIPS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const BETS = [10, 50, 100];

export default function CasinoPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const gold = useGameStore((s) => s.player.gold);
  const [tab, setTab] = useState<"slots" | "bj" | "fate">("slots");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-gray-500">
        読み込み中…
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
        <span className="text-xs text-amber-300">💰 {gold}</span>
      </div>

      <div className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 p-3 text-center">
        <div className="text-3xl">🎰</div>
        <h1 className="font-bold text-fuchsia-200">カジノ</h1>
        <p className="text-[10px] text-gray-400">ゴールドを賭けて遊ぶ。ジャックポットで特別景品。</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setTab("slots")}
          className={`h-10 rounded-xl text-xs font-bold active:scale-95 ${
            tab === "slots" ? "bg-fuchsia-600 text-white" : "bg-white/10 text-gray-300"
          }`}
        >
          🎲 スロット
        </button>
        <button
          onClick={() => setTab("bj")}
          className={`h-10 rounded-xl text-xs font-bold active:scale-95 ${
            tab === "bj" ? "bg-fuchsia-600 text-white" : "bg-white/10 text-gray-300"
          }`}
        >
          🃏 BJ
        </button>
        <button
          onClick={() => setTab("fate")}
          className={`h-10 rounded-xl text-xs font-bold active:scale-95 ${
            tab === "fate"
              ? "bg-gradient-to-r from-amber-500 to-rose-600 text-white"
              : "bg-white/10 text-gray-300"
          }`}
        >
          🔮 運命
        </button>
      </div>

      {tab === "slots" ? <Slots /> : tab === "bj" ? <Blackjack /> : <FatePanel />}
    </main>
  );
}

function BetSelector({
  bet,
  setBet,
  gold,
}: {
  bet: number;
  setBet: (n: number) => void;
  gold: number;
}) {
  return (
    <div className="flex gap-2">
      {BETS.map((b) => (
        <button
          key={b}
          onClick={() => setBet(b)}
          disabled={b > gold}
          className={`h-9 flex-1 rounded-lg text-xs font-bold active:scale-95 disabled:opacity-30 ${
            bet === b ? "bg-amber-600 text-white" : "bg-white/10 text-gray-300"
          }`}
        >
          💰{b}
        </button>
      ))}
    </div>
  );
}

function Dice({ value, big }: { value: number; big?: boolean }) {
  return <span className={big ? "text-5xl" : "text-3xl"}>{PIPS[value]}</span>;
}

// ===== Slot (パチスロ4号機フレーバー) =====

// Die face (1–9) → 絵柄. 7=BIG(→ダイスラッシュ) / BAR=REG / RP=リプレイ / 小役.
const SLOT_ROLE: Record<number, { label: string; cls: string }> = {
  7: { label: "7", cls: "text-red-400" }, // BIG → ダイスラッシュ(AT)
  4: { label: "BAR", cls: "text-amber-300" }, // REG
  1: { label: "RP", cls: "text-cyan-300" }, // replay
  2: { label: "ベル", cls: "text-yellow-300" }, // bell
  5: { label: "スイカ", cls: "text-green-400" }, // watermelon
  9: { label: "🍒", cls: "text-pink-400" }, // cherry
  3: { label: "3", cls: "text-gray-500" },
  6: { label: "6", cls: "text-gray-500" },
  8: { label: "8", cls: "text-gray-500" },
};

function SlotCell({ value, hot }: { value: number; hot?: boolean }) {
  const r = SLOT_ROLE[value] ?? { label: String(value), cls: "text-gray-300" };
  return (
    <div
      className={`flex h-20 w-[4.5rem] items-center justify-center rounded-lg border-2 transition-colors ${
        hot ? "border-red-500 bg-red-500/15 animate-pulse" : "border-white/15 bg-black/50"
      }`}
    >
      <span className={`text-2xl font-black ${r.cls}`}>{r.label}</span>
    </div>
  );
}

function slotLabel(res: SlotSpinResult): { text: string; cls: string } {
  switch (res.outcome) {
    case "big":
      return {
        text: `🎲 ダイスラッシュ!! ×${res.rush?.sets ?? 1}セット +🪙${res.payout}`,
        cls: "text-red-400",
      };
    case "reg":
      return { text: `✨ REGULAR BONUS +${res.payout}`, cls: "text-amber-300" };
    case "replay":
      return { text: "🔁 リプレイ（次回無料）", cls: "text-cyan-300" };
    case "bell":
      return { text: `🔔 ベル +${res.payout}`, cls: "text-yellow-300" };
    case "watermelon":
      return { text: `🍉 スイカ +${res.payout}`, cls: "text-green-300" };
    case "cherry":
      return { text: `🍒 チェリー +${res.payout}`, cls: "text-pink-300" };
    default:
      return { text: "ハズレ", cls: "text-gray-500" };
  }
}

const rndSym = () => 1 + Math.floor(Math.random() * 9);

interface ReachFoe {
  templateId: string;
  isBoss: boolean;
  modTier: number;
  label: string;
}

// Reach productions feature an actual game enemy (existing pixel art). Hotter
// reaches summon stronger foes — a weak reach shows a weak enemy, a 激アツ reach
// a ★-aura boss. Enemy templates are ordered weak→strong, so slice by tier.
function pickEnemyTemplate(loFrac: number, hiFrac: number) {
  const n = ENEMY_TEMPLATES.length;
  const lo = Math.floor(n * loFrac);
  const hi = Math.max(lo + 1, Math.floor(n * hiFrac));
  return ENEMY_TEMPLATES[Math.min(n - 1, lo + Math.floor(Math.random() * (hi - lo)))];
}
function reachFoe(tier: number): ReachFoe {
  if (tier >= 5) {
    const b = BOSS_TEMPLATES[Math.floor(Math.random() * BOSS_TEMPLATES.length)];
    return { templateId: b.id, isBoss: true, modTier: 2, label: "⚠️ ボス出現！" };
  }
  if (tier === 4) {
    const b = BOSS_TEMPLATES[Math.floor(Math.random() * BOSS_TEMPLATES.length)];
    return { templateId: b.id, isBoss: true, modTier: 0, label: "ボスの気配…！" };
  }
  if (tier === 3) return { templateId: pickEnemyTemplate(0.6, 1).id, isBoss: false, modTier: 1, label: "強敵が現れた！" };
  if (tier === 2) return { templateId: pickEnemyTemplate(0.3, 0.6).id, isBoss: false, modTier: 0, label: "敵が現れた" };
  return { templateId: pickEnemyTemplate(0, 0.3).id, isBoss: false, modTier: 0, label: "雑魚が現れた…" };
}

function Slots() {
  const gold = useGameStore((s) => s.player.gold);
  const coins = useGameStore((s) => s.coins);
  const replay = useGameStore((s) => s.slotReplay);
  const buyCoins = useGameStore((s) => s.buyCoins);
  const cashout = useGameStore((s) => s.cashoutCoins);
  const slotSpin = useGameStore((s) => s.slotSpin);

  const [reels, setReels] = useState<[number, number, number]>([7, 7, 7]);
  const [spinning, setSpinning] = useState(false);
  const [reachName, setReachName] = useState<string | null>(null);
  const [foe, setFoe] = useState<ReachFoe | null>(null);
  const [result, setResult] = useState<SlotSpinResult | null>(null);
  const [auto, setAuto] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cycle = useRef<ReturnType<typeof setInterval> | null>(null);
  const lock = useRef<[boolean, boolean, boolean]>([false, false, false]);
  const spinningRef = useRef(false);
  const autoRef = useRef(false);

  const cost = replay ? 0 : SLOT_BET;
  const canSpin = coins >= cost;

  const stopCycle = () => {
    if (cycle.current) {
      clearInterval(cycle.current);
      cycle.current = null;
    }
  };
  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    stopCycle();
  };
  useEffect(() => () => clearAll(), []);
  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  const spin = () => {
    if (spinningRef.current) return;
    const res = slotSpin();
    if (!res) {
      setAuto(false);
      return;
    }
    spinningRef.current = true;
    setSpinning(true);
    setResult(null);
    setReachName(null);
    setFoe(null);
    lock.current = [false, false, false];

    cycle.current = setInterval(() => {
      setReels((r) => [
        lock.current[0] ? r[0] : rndSym(),
        lock.current[1] ? r[1] : rndSym(),
        lock.current[2] ? r[2] : rndSym(),
      ]);
    }, 70);

    const S = res.reels;
    const stop = (i: number, when: number) =>
      timers.current.push(
        setTimeout(() => {
          lock.current[i] = true;
          setReels((r) => {
            const n = [...r] as [number, number, number];
            n[i] = S[i];
            return n;
          });
        }, when),
      );

    stop(0, 450);
    stop(1, 800);

    const reveal = (when: number) =>
      timers.current.push(
        setTimeout(() => {
          stopCycle();
          lock.current = [true, true, true];
          setReels(S);
          setResult(res);
          setReachName(null);
          setFoe(null);
          spinningRef.current = false;
          setSpinning(false);
          const gap = res.outcome === "big" || res.outcome === "reg" ? 1500 : 650;
          timers.current.push(
            setTimeout(() => {
              const st = useGameStore.getState();
              const c = st.slotReplay ? 0 : SLOT_BET;
              if (autoRef.current && st.coins >= c) spin();
            }, gap),
          );
        }, when),
      );

    if (res.reach) {
      const enemy = reachFoe(res.reach.tier);
      timers.current.push(
        setTimeout(() => {
          setReachName(res.reach!.name);
          setFoe(enemy);
        }, 820),
      );
      reveal(820 + res.reach.ms);
    } else {
      reveal(1050);
    }
  };

  // Kick off the first auto spin when toggled on at rest.
  useEffect(() => {
    if (auto && !spinningRef.current) spin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const reaching = reachName !== null;

  return (
    <div className="flex flex-col gap-3">
      {/* Coin bank + gold exchange */}
      <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-black/30 px-3 py-2 text-xs">
        <span className="flex items-center gap-1 font-bold text-amber-200">
          <PixelGlyph kind="casino" size={14} /> コイン {fmt(coins)}
        </span>
        <span className="flex items-center gap-1 text-gray-400">
          <PixelGlyph kind="gold" size={14} /> {fmt(gold)}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => buyCoins(50)}
          disabled={spinning || gold < 50 * COIN_VALUE}
          className="h-9 flex-1 rounded-lg bg-amber-600/80 text-xs font-bold text-white active:scale-95 disabled:opacity-30"
        >
          +50枚（💰{fmt(50 * COIN_VALUE)}）
        </button>
        <button
          onClick={() => buyCoins(200)}
          disabled={spinning || gold < 200 * COIN_VALUE}
          className="h-9 flex-1 rounded-lg bg-amber-600/80 text-xs font-bold text-white active:scale-95 disabled:opacity-30"
        >
          +200枚（💰{fmt(200 * COIN_VALUE)}）
        </button>
        <button
          onClick={cashout}
          disabled={spinning || coins <= 0}
          className="h-9 flex-1 rounded-lg bg-white/10 text-xs font-bold text-gray-200 active:scale-95 disabled:opacity-30"
        >
          換金
        </button>
      </div>

      {/* Reels */}
      <div
        className={`rounded-2xl border-2 p-4 text-center ${
          result?.outcome === "big"
            ? "border-red-500 bg-red-500/10"
            : result?.outcome === "reg"
              ? "border-amber-400 bg-amber-400/10"
              : "border-white/10 bg-black/30"
        }`}
      >
        <div className="flex justify-center gap-2">
          <SlotCell value={reels[0]} hot={reaching} />
          <SlotCell value={reels[1]} hot={reaching} />
          <SlotCell value={reels[2]} hot={reaching && !lock.current[2]} />
        </div>

        {reaching && (
          <div className="mt-3 flex flex-col items-center gap-1">
            {foe && (
              <div className={`fate-pop ${foe.isBoss ? "animate-pulse" : ""}`}>
                <EnemyIcon enemy={foe} size={foe.isBoss ? 72 : 56} />
              </div>
            )}
            <p
              className={`animate-pulse text-lg font-extrabold ${
                foe?.isBoss ? "text-red-400" : "text-amber-300"
              }`}
            >
              🔥 {reachName}
            </p>
            {foe && <p className="text-xs font-bold text-gray-200">{foe.label}</p>}
          </div>
        )}

        {result && !spinning && !reaching && (
          <div className="mt-3">
            <p className={`text-lg font-extrabold ${slotLabel(result).cls}`}>{slotLabel(result).text}</p>
            {result.prize && (
              <p className="mt-1 text-sm font-bold text-amber-300">🎁 {result.prize.name} を獲得！</p>
            )}
          </div>
        )}
      </div>

      {replay && !spinning && (
        <div className="rounded-lg bg-cyan-500/15 px-3 py-1 text-center text-xs font-bold text-cyan-200">
          🔁 リプレイ：次のスピンは無料
        </div>
      )}

      {/* Spin + auto */}
      <div className="flex gap-2">
        <button
          onClick={spin}
          disabled={spinning || !canSpin}
          className="h-16 flex-[1.6] rounded-2xl bg-fuchsia-600 text-xl font-extrabold text-white shadow-lg active:scale-95 disabled:opacity-40"
        >
          {spinning ? "回転中…" : replay ? "🔁 無料スピン" : `🎰 スピン（🪙${SLOT_BET}）`}
        </button>
        <button
          onClick={() => setAuto((a) => !a)}
          className={`h-16 flex-1 rounded-2xl text-sm font-bold active:scale-95 ${
            auto ? "bg-amber-500 text-black" : "bg-white/10 text-gray-300"
          }`}
        >
          {auto ? "⏹ オート停止" : "⏩ オート"}
        </button>
      </div>

      {!canSpin && coins < cost && (
        <p className="text-center text-[10px] text-red-300">コインが足りません。上で購入してください。</p>
      )}

      <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-[10px] leading-relaxed text-gray-400">
        3枚掛け。<b className="text-red-300">7・7・7</b>で<b className="text-red-300">ダイスラッシュ</b>(AT)突入＝
        継続抽選で出玉が上乗せ（まれに大量出玉）。<b className="text-amber-300">BAR=REG</b> /
        <b className="text-cyan-300"> RP=リプレイ</b>（次回無料）/ ベル・スイカ・🍒で小役。
        2つ揃うと<b className="text-red-300">リーチ</b>（演出が激アツなほど信頼度UP）。1コイン=💰{COIN_VALUE}。
      </div>
    </div>
  );
}

// ===== Blackjack =====

type BjPhase = "bet" | "player" | "result";

function Blackjack() {
  const gold = useGameStore((s) => s.player.gold);
  const settle = useGameStore((s) => s.casinoSettle);
  const [bet, setBet] = useState(10);
  const [phase, setPhase] = useState<BjPhase>("bet");
  const [player, setPlayer] = useState<number[]>([]);
  const [dealer, setDealer] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<BjOutcome | null>(null);
  const [pot, setPot] = useState(0);
  const [msg, setMsg] = useState("");

  const deal = () => {
    if (gold < bet) return;
    settle(-bet);
    setPlayer([drawDie(), drawDie()]);
    setDealer([]);
    setOutcome(null);
    setPot(0);
    setMsg("");
    setPhase("player");
  };

  const hit = () => {
    const next = [...player, drawDie()];
    setPlayer(next);
    if (bjTotal(next) > 21) {
      setOutcome("lose");
      setPot(0);
      setMsg("バースト！");
      setPhase("result");
    }
  };

  const stand = () => {
    const d = dealerPlay([drawDie(), drawDie()]);
    setDealer(d);
    const res = bjResolve(player, d);
    setOutcome(res);
    if (res === "win") {
      setPot(bet * 2);
      setMsg("勝ち！ ダブルアップ or 受け取る");
    } else if (res === "push") {
      setPot(bet);
      setMsg("引き分け（賭け金を返却）");
    } else {
      setPot(0);
      setMsg("負け…");
    }
    setPhase("result");
  };

  const guess = (high: boolean) => {
    const r = doubleUp(high);
    if (r.won) {
      const np = pot * 2;
      setPot(np);
      setMsg(`${PIPS[r.die]} 当たり！ ポット 💰${np}`);
    } else {
      setPot(0);
      setOutcome("lose");
      setMsg(`${PIPS[r.die]} 外れ… ポット消失`);
    }
  };

  const cashOut = () => {
    if (pot > 0) settle(pot);
    setPhase("bet");
    setMsg("");
    setOutcome(null);
    setPlayer([]);
    setDealer([]);
    setPot(0);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="text-xs text-gray-400">ディーラー {dealer.length ? `(${bjTotal(dealer)})` : ""}</div>
        <div className="flex min-h-[2.5rem] flex-wrap gap-1">
          {dealer.length ? dealer.map((d, i) => <Dice key={i} value={d} />) : <span className="text-gray-600">—</span>}
        </div>
        <div className="mt-2 text-xs text-gray-400">あなた {player.length ? `(${bjTotal(player)})` : ""}</div>
        <div className="flex min-h-[2.5rem] flex-wrap gap-1">
          {player.length ? player.map((d, i) => <Dice key={i} value={d} />) : <span className="text-gray-600">—</span>}
        </div>
        {msg && (
          <p
            className={`mt-2 text-center font-bold ${
              outcome === "win" ? "text-emerald-300" : outcome === "lose" ? "text-red-300" : "text-gray-200"
            }`}
          >
            {msg}
          </p>
        )}
        {phase === "result" && pot > 0 && (
          <p className="mt-1 text-center text-sm text-amber-300">ポット: 💰{pot}</p>
        )}
      </div>

      {phase === "bet" && (
        <>
          <BetSelector bet={bet} setBet={setBet} gold={gold} />
          <button
            onClick={deal}
            disabled={gold < bet}
            className="h-16 rounded-2xl bg-fuchsia-600 text-xl font-extrabold text-white active:scale-95 disabled:opacity-40"
          >
            🃏 配る（💰{bet}）
          </button>
          <p className="text-center text-[10px] text-gray-500">21に近づけて勝負。勝てばダブルアップに挑戦。</p>
        </>
      )}

      {phase === "player" && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={hit} className="h-16 rounded-2xl bg-sky-600 text-lg font-bold text-white active:scale-95">
            もう一枚
          </button>
          <button onClick={stand} className="h-16 rounded-2xl bg-emerald-600 text-lg font-bold text-white active:scale-95">
            勝負
          </button>
        </div>
      )}

      {phase === "result" && (
        <div className="flex flex-col gap-3">
          {outcome === "win" && pot > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => guess(true)} className="h-14 rounded-2xl bg-rose-600 font-bold text-white active:scale-95">
                ダブルアップ Hi(4-6)
              </button>
              <button onClick={() => guess(false)} className="h-14 rounded-2xl bg-indigo-600 font-bold text-white active:scale-95">
                ダブルアップ Lo(1-3)
              </button>
            </div>
          )}
          <button onClick={cashOut} className="h-16 rounded-2xl bg-amber-600 text-xl font-extrabold text-white active:scale-95">
            {pot > 0 ? `受け取る（💰${pot}）` : "終了"}
          </button>
        </div>
      )}
    </div>
  );
}

// ===== 運命の大博打 (Fate gamble) =====

const FATE_GLYPHS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅", "💀", "🔮", "✦", "🌈", "💎", "👑"];

function FatePanel() {
  const gold = useGameStore((s) => s.player.gold);
  const equipped = useGameStore((s) => s.equipped);
  const inventory = useGameStore((s) => s.inventory);
  const gamble = useGameStore((s) => s.fateGamble);

  const [spinning, setSpinning] = useState(false);
  const [glyphs, setGlyphs] = useState<string[]>(["🔮", "🔮", "🔮"]);
  const [result, setResult] = useState<FateResult | null>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  // Reference power = the player's current best owned gear → drives the price.
  const refTier = useMemo(() => {
    let t = 0;
    for (const slot of EQUIP_SLOTS) {
      const it = equipped[slot];
      if (it) t = Math.max(t, estimateTier(it));
    }
    for (const it of inventory) t = Math.max(t, estimateTier(it));
    return t;
  }, [equipped, inventory]);

  const cost = fateCost(refTier);
  const canAfford = gold >= cost && !spinning;

  useEffect(() => {
    return () => timers.current.forEach(clearInterval);
  }, []);

  const spin = () => {
    if (!canAfford) return;
    const r = gamble(); // RNG decided up-front; the animation is pure suspense.
    if (r.cost > gold) return;
    setResult(null);
    setSpinning(true);

    const cycle = setInterval(() => {
      setGlyphs([
        FATE_GLYPHS[Math.floor(Math.random() * FATE_GLYPHS.length)],
        FATE_GLYPHS[Math.floor(Math.random() * FATE_GLYPHS.length)],
        FATE_GLYPHS[Math.floor(Math.random() * FATE_GLYPHS.length)],
      ]);
    }, 80);
    timers.current.push(cycle);

    // Long, flashy reveal (~2.6s).
    const finish = setTimeout(() => {
      clearInterval(cycle);
      const face =
        r.kind === "item" ? "💎" : r.kind === "souls" ? "🌈" : "💀";
      setGlyphs([face, face, face]);
      setSpinning(false);
      setResult(r);
    }, 2600);
    timers.current.push(finish as unknown as ReturnType<typeof setInterval>);
  };

  const won = result && result.kind !== "lose";

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`relative overflow-hidden rounded-2xl border p-5 text-center transition-colors ${
          spinning
            ? "border-amber-400/60 bg-gradient-to-br from-amber-500/20 via-fuchsia-600/20 to-rose-600/20"
            : won
              ? "border-amber-300 bg-gradient-to-br from-amber-400/30 to-rose-500/30"
              : "border-white/10 bg-black/40"
        }`}
      >
        <div
          className={`flex justify-center gap-2 text-5xl ${
            spinning ? "animate-pulse" : won ? "fate-pop" : ""
          }`}
        >
          {glyphs.map((g, i) => (
            <span key={i}>{g}</span>
          ))}
        </div>

        {spinning && (
          <p className="mt-3 animate-pulse text-sm font-bold text-amber-200">
            運命を回しています…
          </p>
        )}

        {result && !spinning && (
          <div className="mt-3">
            {result.kind === "item" && (
              <>
                <p className="text-lg font-extrabold text-amber-300">🎉 大当たり！</p>
                <p className="mt-1 text-sm font-bold text-amber-200">
                  💎 {result.item.name} を獲得！
                </p>
              </>
            )}
            {result.kind === "souls" && (
              <>
                <p className="text-lg font-extrabold text-fuchsia-300">🎉 大当たり！</p>
                <p className="mt-1 text-sm font-bold text-fuchsia-200">
                  🌈 転生ポイント +{result.souls}！
                </p>
              </>
            )}
            {result.kind === "lose" && (
              <p className="text-lg font-extrabold text-gray-400">💀 ハズレ…</p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-[10px] leading-relaxed text-gray-400">
        🔮 <b className="text-amber-300">運命の大博打</b>：超低確率・特大報酬。
        当たれば<b className="text-amber-200">所持している★より2段階上の装備</b>、
        または<b className="text-fuchsia-200">転生ポイント</b>。ほとんどはハズレ。
      </div>

      <button
        onClick={spin}
        disabled={!canAfford}
        className="h-16 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 text-xl font-extrabold text-white shadow-lg active:scale-95 disabled:opacity-40"
      >
        🔮 運命を回す（💰{fmt(cost)}）
      </button>
      {gold < cost && (
        <p className="text-center text-[10px] text-red-300">ゴールドが足りません。</p>
      )}
    </div>
  );
}
