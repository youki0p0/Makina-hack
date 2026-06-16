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
  randomCasinoPrize,
  spinSlots,
  type BjOutcome,
  type SlotResult,
} from "@/lib/casino";
import { estimateTier } from "@/data/items";
import { EQUIP_SLOTS } from "@/lib/battle";
import { fmt } from "@/lib/ui";
import { useGameStore, type FateResult } from "@/store/gameStore";

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

// ===== Slots =====

function Slots() {
  const gold = useGameStore((s) => s.player.gold);
  const settle = useGameStore((s) => s.casinoSettle);
  const [bet, setBet] = useState(10);
  const [result, setResult] = useState<SlotResult | null>(null);
  const [prizeName, setPrizeName] = useState<string | null>(null);

  const spin = () => {
    if (gold < bet) return;
    const r = spinSlots(bet);
    let prize = null;
    let name: string | null = null;
    if (r.prize) {
      prize = randomCasinoPrize();
      name = prize.name;
    }
    settle(r.payout - bet, prize);
    setResult(r);
    setPrizeName(name);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
        <div className="flex justify-center gap-3">
          {result ? (
            result.reels.map((r, i) => <Dice key={i} value={r} big />)
          ) : (
            <>
              <Dice value={1} big />
              <Dice value={1} big />
              <Dice value={1} big />
            </>
          )}
        </div>
        {result && (
          <div className="mt-2">
            <p
              className={`text-lg font-extrabold ${
                result.payout > 0 ? "text-emerald-300" : "text-gray-400"
              }`}
            >
              {result.label}
              {result.payout > 0 && ` +💰${result.payout}`}
            </p>
            {prizeName && (
              <p className="mt-1 text-sm font-bold text-amber-300">🎁 {prizeName} を獲得！</p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-[10px] text-gray-400">
        ⚅⚅⚅ ジャックポット(×20+景品) / ゾロ目 ×8 / ペア ×2
      </div>

      <BetSelector bet={bet} setBet={setBet} gold={gold} />
      <button
        onClick={spin}
        disabled={gold < bet}
        className="h-16 rounded-2xl bg-fuchsia-600 text-xl font-extrabold text-white shadow-lg active:scale-95 disabled:opacity-40"
      >
        🎲 スピン（💰{bet}）
      </button>
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
