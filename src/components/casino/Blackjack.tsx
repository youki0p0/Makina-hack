"use client";

import { useState } from "react";
import { bjResolve, bjTotal, dealerPlay, doubleUp, drawDie, type BjOutcome } from "@/lib/casino";
import { fmt } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";

const PIPS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const BETS = [10, 50, 100];

function BetSelector({
  bet,
  setBet,
  coins,
}: {
  bet: number;
  setBet: (n: number) => void;
  coins: number;
}) {
  return (
    <div className="flex gap-2">
      {BETS.map((b) => (
        <button
          key={b}
          onClick={() => setBet(b)}
          disabled={b > coins}
          className={`h-9 flex-1 rounded-lg text-xs font-bold active:scale-95 disabled:opacity-30 ${
            bet === b ? "bg-amber-600 text-white" : "bg-white/10 text-gray-300"
          }`}
        >
          🎲{b}
        </button>
      ))}
    </div>
  );
}

function Dice({ value, big }: { value: number; big?: boolean }) {
  return <span className={big ? "text-5xl" : "text-3xl"}>{PIPS[value]}</span>;
}

type BjPhase = "bet" | "player" | "result";

export default function Blackjack() {
  const coins = useGameStore((s) => s.coins);
  const addCoins = useGameStore((s) => s.addCoins);
  const [bet, setBet] = useState(10);
  const [phase, setPhase] = useState<BjPhase>("bet");
  const [player, setPlayer] = useState<number[]>([]);
  const [dealer, setDealer] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<BjOutcome | null>(null);
  const [pot, setPot] = useState(0);
  const [msg, setMsg] = useState("");

  const deal = () => {
    if (coins < bet) return;
    addCoins(-bet);
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
      setMsg(`${PIPS[r.die]} 当たり！ ポット 🎲${np}`);
    } else {
      setPot(0);
      setOutcome("lose");
      setMsg(`${PIPS[r.die]} 外れ… ポット消失`);
    }
  };

  const cashOut = () => {
    if (pot > 0) addCoins(pot);
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
          <p className="mt-1 text-center text-sm text-amber-300">ポット: 🎲{pot}</p>
        )}
      </div>

      {phase === "bet" && (
        <>
          <div className="text-center text-xs text-amber-300">🎲 カジノコイン {fmt(coins)}</div>
          <BetSelector bet={bet} setBet={setBet} coins={coins} />
          <button
            onClick={deal}
            disabled={coins < bet}
            className="h-16 rounded-2xl bg-fuchsia-600 text-xl font-extrabold text-white active:scale-95 disabled:opacity-40"
          >
            🃏 配る（🎲{bet}）
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
            {pot > 0 ? `受け取る（🎲${pot}）` : "終了"}
          </button>
        </div>
      )}
    </div>
  );
}
