"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DAIPAN_LIMIT, casinoEvent } from "@/lib/casino";
import { slotSfx } from "@/lib/audio";
import EventBadge from "@/components/EventBadge";
import { fmt } from "@/lib/ui";
import Blackjack from "@/components/casino/Blackjack";
import CoinShop from "@/components/casino/CoinShop";
import Slots from "@/components/casino/Slots";
import KingChallenge from "@/components/casino/KingChallenge";
import { useGameStore } from "@/store/gameStore";


export default function CasinoPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const gold = useGameStore((s) => s.player.gold);
  const banUntil = useGameStore((s) => s.casinoBan);
  const bossKills = useGameStore((s) => s.progress.bossKills);
  const atGames = useGameStore((s) => s.atGames);
  const daiPan = useGameStore((s) => s.daiPan);
  const [tab, setTab] = useState<"slots" | "bj" | "shop" | "king">("slots");
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

  // イベントデー判定(ローカルの日)。ヘッダーのお祭り表示・各ゲームのEVENTバッジに使う。
  const event = casinoEvent();

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
        <h1 className="flex items-center justify-center gap-1 font-bold text-fuchsia-200">
          カジノ
          {event.active && <EventBadge />}
        </h1>
        {event.active ? (
          <p className="text-[11px] font-bold text-amber-300">🎉 {event.label}・激アツ設定デー！</p>
        ) : (
          <p className="text-[10px] text-gray-400">カジノコインで遊ぶ。ダイスラッシュで一攫千金。</p>
        )}
      </div>

      <Link
        href="/casino/pachinko"
        className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-cyan-600/80 font-bold active:scale-95"
      >
        🎲 甘ダイスへ
        {event.pachinko && <EventBadge />}
      </Link>

      <div className="grid grid-cols-2 gap-2">
        {([
          ["slots", "🎲 スロット"],
          ["bj", "🃏 BJ"],
          ["shop", "🪙 交換所"],
          ["king", "👑 カジノ王"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex h-10 items-center justify-center gap-1 rounded-xl text-[11px] font-bold active:scale-95 ${
              tab === k ? "bg-fuchsia-600 text-white" : "bg-white/10 text-gray-300"
            }`}
          >
            {label}
            {k === "slots" && event.slot && <EventBadge />}
          </button>
        ))}
      </div>

      {tab === "slots" ? (
        <Slots onPan={onPan} />
      ) : tab === "bj" ? (
        <Blackjack />
      ) : tab === "king" ? (
        <KingChallenge />
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
