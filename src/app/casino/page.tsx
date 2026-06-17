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
  DAIPAN_LIMIT,
  MACHINE_COUNT,
  SET_WEAPON_COIN,
  SOULS_COIN,
  HIT_WINDOW_MS,
  type BjOutcome,
} from "@/lib/casino";
import { estimateTier } from "@/data/items";
import { availableSetKeys, getSetDef } from "@/data/sets";
import { EQUIP_SLOTS } from "@/lib/battle";
import { ENEMY_TEMPLATES, BOSS_TEMPLATES } from "@/data/enemies";
import { getSlotIconDataUrl } from "@/lib/itemIcon";
import { slotSfx, setBgmTheme } from "@/lib/audio";
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
  const banUntil = useGameStore((s) => s.casinoBan);
  const bossKills = useGameStore((s) => s.progress.bossKills);
  const atGames = useGameStore((s) => s.atGames);
  const daiPan = useGameStore((s) => s.daiPan);
  const [tab, setTab] = useState<"slots" | "bj" | "fate" | "shop">("slots");
  const [shaking, setShaking] = useState(false);
  const [panMsg, setPanMsg] = useState<string | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const banned = banUntil > 0 && bossKills < banUntil;
  if (banned) {
    return (
      <main className="animate-shake flex min-h-dvh flex-col items-center justify-center gap-6 bg-red-950/40 p-6 text-center">
        <h1 className="text-7xl font-black tracking-widest text-red-500 drop-shadow-[0_0_18px_rgba(239,68,68,0.7)]">
          出禁
        </h1>
        <p className="text-base font-bold leading-relaxed text-gray-100">
          お客様、スロット台が壊れます。
          <br />
          冒険に出て頭を冷やしてきてください。
        </p>
        <p className="text-xs text-gray-400">
          再入店にはボスを<b className="text-amber-300"> {banUntil - bossKills} </b>体倒すこと。
        </p>
        <Link
          href="/"
          className="rounded-xl bg-red-600 px-6 py-3 text-sm font-extrabold text-white active:scale-95"
        >
          冒険に戻る →
        </Link>
      </main>
    );
  }

  const onPan = () => {
    const r = daiPan();
    slotSfx("pan");
    setShaking(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShaking(false), 450);
    setPanMsg(r.banned ? "💢 出禁！" : `💢 台パン！(${r.count}/${DAIPAN_LIMIT}) ※${DAIPAN_LIMIT}回で出禁`);
    setTimeout(() => setPanMsg(null), 1500);
  };

  return (
    <main className={`relative flex min-h-dvh flex-col gap-3 p-3 ${shaking ? "animate-shake" : ""}`}>
      {/* ダイスラッシュ(AT)中は外枠を虹色に光らせる */}
      {atGames > 0 && <div className="at-frame pointer-events-none fixed inset-0 z-40" />}

      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
        <span className="text-xs text-amber-300">💰 {fmt(gold)}</span>
      </div>

      <div className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 p-3 text-center">
        <div className="text-3xl">🎰</div>
        <h1 className="font-bold text-fuchsia-200">カジノ</h1>
        <p className="text-[10px] text-gray-400">カジノコインで遊ぶ。ダイスラッシュで一攫千金。</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {([
          ["slots", "🎲 スロット"],
          ["bj", "🃏 BJ"],
          ["fate", "🔮 運命"],
          ["shop", "🪙 交換所"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`h-10 rounded-xl text-[11px] font-bold active:scale-95 ${
              tab === k ? "bg-fuchsia-600 text-white" : "bg-white/10 text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "slots" ? (
        <Slots onPan={onPan} />
      ) : tab === "bj" ? (
        <Blackjack />
      ) : tab === "fate" ? (
        <FatePanel />
      ) : (
        <CoinShop />
      )}

      {panMsg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-50 text-center">
          <span className="rounded-full bg-black/70 px-4 py-1 text-sm font-bold text-red-300">{panMsg}</span>
        </div>
      )}
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

// 絵柄(出目1–9)は専用ピクセルスプライト: 7=BIG / BAR=REG / リプレイ / ベル /
// スイカ / チェリー / それ以外はダイス数字(ハズレ目)。
function SlotSym({ value, size = 48 }: { value: number; size?: number }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(getSlotIconDataUrl(value));
  }, [value]);
  return url ? (
    <img
      src={url}
      width={size}
      height={size}
      alt=""
      draggable={false}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  ) : (
    <span style={{ display: "block", width: size, height: size }} />
  );
}

function SlotCell({ value, hot }: { value: number; hot?: boolean }) {
  return (
    <div
      className={`flex h-20 w-[4.5rem] items-center justify-center rounded-lg border-2 transition-colors ${
        hot ? "border-red-500 bg-red-500/15 animate-pulse" : "border-white/15 bg-black/50"
      }`}
    >
      <SlotSym value={value} size={48} />
    </div>
  );
}

function slotLabel(res: SlotSpinResult): { text: string; cls: string } {
  switch (res.outcome) {
    case "big":
      return { text: `🎲 ダイスラッシュ突入!! ${res.atRemaining}G`, cls: "text-red-400" };
    case "at":
      return res.atAdd > 0
        ? { text: `🔥 上乗せ +${res.atAdd}G！ (+${res.payout}枚)`, cls: "text-red-400" }
        : { text: `🎲 ダイスラッシュ +${res.payout}枚`, cls: "text-amber-200" };
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

function Slots({ onPan }: { onPan: () => void }) {
  const gold = useGameStore((s) => s.player.gold);
  const coins = useGameStore((s) => s.coins);
  const replay = useGameStore((s) => s.slotReplay);
  const atGames = useGameStore((s) => s.atGames);
  const machine = useGameStore((s) => s.slotMachine);
  const slotSpins = useGameStore((s) => s.slotSpins);
  const slotZone = useGameStore((s) => s.slotZone);
  const slotTotal = useGameStore((s) => s.slotTotal);
  const slotBig = useGameStore((s) => s.slotBig);
  const slotReg = useGameStore((s) => s.slotReg);
  const slotMaxHamari = useGameStore((s) => s.slotMaxHamari);
  const slotHits = useGameStore((s) => s.slotHits);
  const selectMachine = useGameStore((s) => s.selectMachine);
  const buyCoins = useGameStore((s) => s.buyCoins);
  const cashout = useGameStore((s) => s.cashoutCoins);
  const slotSpin = useGameStore((s) => s.slotSpin);

  const [reels, setReels] = useState<[number, number, number]>([7, 7, 7]);
  const [spinning, setSpinning] = useState(false);
  const [reachName, setReachName] = useState<string | null>(null);
  const [foe, setFoe] = useState<ReachFoe | null>(null);
  const [result, setResult] = useState<SlotSpinResult | null>(null);
  const [auto, setAuto] = useState(false);
  const [flash, setFlash] = useState(false); // 確定当たりリーチの虹色明滅

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cycle = useRef<ReturnType<typeof setInterval> | null>(null);
  const lock = useRef<[boolean, boolean, boolean]>([false, false, false]);
  const spinningRef = useRef(false);
  const autoRef = useRef(false);

  const cost = replay ? 0 : SLOT_BET;
  const atActive = atGames > 0;
  const canSpin = coins >= cost && !atActive;

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
    const isAt = res.outcome === "at"; // free auto game inside ダイスラッシュ
    spinningRef.current = true;
    if (!isAt) slotSfx("lever"); // レバーON (AT中は連打にならないよう省略)
    setSpinning(true);
    setResult(null);
    setReachName(null);
    setFoe(null);
    setFlash(false);
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
          slotSfx("stop"); // リール停止音
          setReels((r) => {
            const n = [...r] as [number, number, number];
            n[i] = S[i];
            return n;
          });
        }, when),
      );

    const reveal = (when: number) =>
      timers.current.push(
        setTimeout(() => {
          stopCycle();
          lock.current = [true, true, true];
          slotSfx("stop"); // 最終リール停止
          setReels(S);
          setResult(res);
          setReachName(null);
          setFoe(null);
          setFlash(false);
          spinningRef.current = false;
          setSpinning(false);

          const st = useGameStore.getState();
          // BGM: BIGでidolへ突入、AT終了でカジノ曲へ復帰。
          if (res.atStart) setBgmTheme("idol");
          const atOver = isAt && st.atGames === 0;
          if (atOver) setBgmTheme("casino");

          // 当たり/小役/上乗せ音。
          if (res.outcome === "big") slotSfx("bonusBig");
          else if (res.outcome === "reg") slotSfx("bonus");
          else if (res.outcome === "at") slotSfx(res.atAdd > 0 ? "bonusBig" : "small");
          else if (res.outcome !== "miss") slotSfx("small");

          // 次ゲーム: AT中は自動で回し続ける。通常はオート時のみ。
          const gap = res.outcome === "big" ? 1400 : isAt ? 280 : 650;
          timers.current.push(
            setTimeout(() => {
              const s2 = useGameStore.getState();
              if (s2.atGames > 0) {
                spin();
                return;
              }
              const c = s2.slotReplay ? 0 : SLOT_BET;
              if (autoRef.current && s2.coins >= c) spin();
            }, gap),
          );
        }, when),
      );

    if (isAt) {
      // AT中の無料ゲームはテンポよく(リーチ無し)。
      stop(0, 140);
      stop(1, 250);
      reveal(380);
    } else if (res.reach) {
      stop(0, 450);
      stop(1, 800);
      const enemy = reachFoe(res.reach.tier);
      timers.current.push(
        setTimeout(() => {
          setReachName(res.reach!.name);
          setFoe(enemy);
          if (res.reach!.guaranteed) setFlash(true); // 確定当たり → 虹色明滅
          slotSfx("reach"); // リーチ煽り
        }, 820),
      );
      reveal(820 + res.reach.ms);
    } else {
      stop(0, 450);
      stop(1, 800);
      reveal(1050);
    }
  };

  // Kick off the first auto spin when toggled on at rest.
  useEffect(() => {
    if (auto && !spinningRef.current) spin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  // Resume an in-progress ダイスラッシュ if we (re)mounted mid-AT.
  useEffect(() => {
    if (atGames > 0 && !spinningRef.current) spin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reaching = reachName !== null;

  return (
    <div className="flex flex-col gap-3">
      {/* 確定当たりリーチ: 全画面が虹色に明滅 */}
      {flash && <div className="rainbow-flash pointer-events-none fixed inset-0 z-50" />}

      {/* Coin bank + gold exchange */}
      <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-black/30 px-3 py-2 text-xs">
        <span className="flex items-center gap-1 font-bold text-amber-200">
          <PixelGlyph kind="casino" size={14} /> カジノコイン {fmt(coins)}
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

      {/* 台選択(設定は隠し・6時間ごとにシャッフル) + 天井/高確 */}
      <div className="flex gap-1">
        {Array.from({ length: MACHINE_COUNT }, (_, i) => (
          <button
            key={i}
            onClick={() => selectMachine(i)}
            disabled={spinning || atActive}
            className={`h-8 flex-1 rounded-lg text-[11px] font-bold active:scale-95 disabled:opacity-40 ${
              machine === i ? "bg-fuchsia-600 text-white" : "bg-white/10 text-gray-300"
            }`}
          >
            台{i + 1}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-1 text-[10px] text-gray-400">
        <span>
          ハマり <b className="text-gray-200">{slotSpins}</b>G（天井 540〜840G・設定で変動）
          <button onClick={onPan} className="ml-2 text-gray-600 active:text-red-400">
            台パン
          </button>
        </span>
        {slotZone > 0 && <span className="font-bold text-red-300">🔥 高確 残り{slotZone}G</span>}
      </div>

      {/* データカウンター(プルダウン) */}
      <details className="rounded-lg border border-white/10 bg-black/30 text-[11px]">
        <summary className="cursor-pointer select-none px-3 py-1.5 font-bold text-gray-300">
          📊 データカウンター
        </summary>
        {(() => {
          const bonus = slotBig + slotReg;
          const rate = bonus > 0 ? Math.round(slotTotal / bonus) : 0;
          const now = Date.now();
          const recent = slotHits.filter((t) => now - t <= HIT_WINDOW_MS).length;
          const Row = ({ k, v }: { k: string; v: string }) => (
            <div className="flex justify-between px-3 py-1">
              <span className="text-gray-400">{k}</span>
              <span className="font-bold text-gray-100">{v}</span>
            </div>
          );
          return (
            <div className="divide-y divide-white/5 border-t border-white/10 pb-1">
              <Row k="総回転数" v={`${fmt(slotTotal)} G`} />
              <Row k="BIG回数" v={`${slotBig}`} />
              <Row k="REG回数" v={`${slotReg}`} />
              <Row k="合算確率" v={bonus > 0 ? `1/${rate}` : "—"} />
              <Row k="現在ハマり" v={`${slotSpins} G`} />
              <Row k="最大ハマり" v={`${slotMaxHamari} G`} />
              <Row k="直近4hの当たり" v={`${recent} 回`} />
            </div>
          );
        })()}
      </details>

      {/* ダイスラッシュ(AT) counter */}
      {atActive && (
        <div className="flex items-center justify-between rounded-xl border-2 border-red-500/70 bg-gradient-to-r from-red-600/30 to-amber-500/20 px-3 py-2">
          <span className="text-sm font-black text-red-300 animate-pulse">🎲 ダイスラッシュ</span>
          <span className="text-sm font-extrabold text-amber-200">
            残り <span className="text-xl">{atGames}</span> G
          </span>
        </div>
      )}

      {/* Reels */}
      <div
        className={`rounded-2xl border-2 p-4 text-center ${
          atActive
            ? "border-red-500 bg-gradient-to-b from-red-500/15 to-amber-500/10"
            : result?.outcome === "big"
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
            {flash && (
              <p className="animate-pulse text-base font-black text-fuchsia-300">🌈 当たり確定！</p>
            )}
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
          {atActive
            ? "🎲 ダイスラッシュ中"
            : spinning
              ? "回転中…"
              : replay
                ? "🔁 無料スピン"
                : `🎰 スピン（${SLOT_BET}枚）`}
        </button>
        <button
          onClick={() => setAuto((a) => !a)}
          disabled={atActive}
          className={`h-16 flex-1 rounded-2xl text-sm font-bold active:scale-95 disabled:opacity-40 ${
            auto ? "bg-amber-500 text-black" : "bg-white/10 text-gray-300"
          }`}
        >
          {auto ? "⏹ オート停止" : "⏩ オート"}
        </button>
      </div>

      {!canSpin && coins < cost && (
        <p className="text-center text-[10px] text-red-300">カジノコインが足りません。上で購入してください。</p>
      )}

      <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-[10px] leading-relaxed text-gray-400">
        3枚掛け。<b className="text-red-300">7・7・7</b>で<b className="text-red-300">ダイスラッシュ</b>(AT)突入＝
        継続抽選で出玉が上乗せ（まれに大量出玉）。<b className="text-amber-300">BAR=REG</b> /
        <b className="text-cyan-300"> RP=リプレイ</b>（次回無料）/ ベル・スイカ・🍒で小役。
        2つ揃うと<b className="text-red-300">リーチ</b>（演出が激アツなほど信頼度UP）。1カジノコイン=💰{COIN_VALUE}。
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

// ===== カジノコイン交換所 =====

function CoinShop() {
  const coins = useGameStore((s) => s.coins);
  const souls = useGameStore((s) => s.souls);
  const highest = useGameStore((s) => s.progress.highestFloorReached);
  const buyWeapon = useGameStore((s) => s.coinBuySetWeapon);
  const buySouls = useGameStore((s) => s.coinBuySouls);

  const keys = useMemo(
    () => availableSetKeys(highest).filter((k) => !getSetDef(k)?.procedural),
    [highest],
  );
  const [sel, setSel] = useState(keys[0] ?? "gambler");
  const [msg, setMsg] = useState<string | null>(null);

  const canWeapon = coins >= SET_WEAPON_COIN;
  const canSoul = coins >= SOULS_COIN;

  const doWeapon = () => {
    const w = buyWeapon(sel);
    if (w) {
      setMsg(`⚔️ ${w.name} を交換！`);
      setTimeout(() => setMsg(null), 2500);
    }
  };
  const doSouls = (n: number) => {
    if (coins < SOULS_COIN * n) return;
    buySouls(n);
    setMsg(`🔮 転生ポイント +${n}！`);
    setTimeout(() => setMsg(null), 2500);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-black/30 px-3 py-2 text-xs">
        <span className="flex items-center gap-1 font-bold text-amber-200">
          <PixelGlyph kind="casino" size={14} /> カジノコイン {fmt(coins)}
        </span>
        <span className="flex items-center gap-1 text-fuchsia-200">
          <PixelGlyph kind="soul" size={14} /> {fmt(souls)}
        </span>
      </div>

      {msg && (
        <div className="rounded-lg bg-emerald-500/15 px-3 py-2 text-center text-sm font-bold text-emerald-200">
          {msg}
        </div>
      )}

      {/* Set weapon exchange */}
      <div className="rounded-2xl border border-fuchsia-500/40 bg-fuchsia-500/5 p-3">
        <p className="flex items-center gap-1 text-sm font-bold text-fuchsia-200">
          <PixelGlyph kind="drop" size={14} /> セット武器と交換
        </p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          所持装備に見合うティアのセット武器（ビルドの軸）を入手。
        </p>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          className="mt-2 h-9 w-full rounded-lg bg-black/40 px-2 text-xs text-gray-100"
        >
          {keys.map((k) => (
            <option key={k} value={k}>
              {getSetDef(k)?.name ?? k} セット
            </option>
          ))}
        </select>
        <button
          onClick={doWeapon}
          disabled={!canWeapon}
          className="mt-2 h-12 w-full rounded-xl bg-fuchsia-600 text-sm font-extrabold text-white active:scale-95 disabled:opacity-40"
        >
          交換（🪙{fmt(SET_WEAPON_COIN)}）
        </button>
      </div>

      {/* Souls exchange (pricier) */}
      <div className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-3">
        <p className="flex items-center gap-1 text-sm font-bold text-violet-200">
          <PixelGlyph kind="soul" size={14} /> 転生ポイントと交換
        </p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          1ポイント = 🪙{fmt(SOULS_COIN)}（割高だが超貴重な転生通貨）。
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => doSouls(1)}
            disabled={!canSoul}
            className="h-12 flex-1 rounded-xl bg-violet-600 text-sm font-extrabold text-white active:scale-95 disabled:opacity-40"
          >
            +1（🪙{fmt(SOULS_COIN)}）
          </button>
          <button
            onClick={() => doSouls(5)}
            disabled={coins < SOULS_COIN * 5}
            className="h-12 flex-1 rounded-xl bg-violet-600 text-sm font-extrabold text-white active:scale-95 disabled:opacity-40"
          >
            +5（🪙{fmt(SOULS_COIN * 5)}）
          </button>
        </div>
      </div>

      <p className="text-center text-[10px] text-gray-500">
        カジノコインはスロットで稼ぐ。超高額なので一攫千金（ダイスラッシュ）が近道。
      </p>
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
