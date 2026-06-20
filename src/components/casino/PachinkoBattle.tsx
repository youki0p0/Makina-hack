"use client";

import { useEffect, useState } from "react";
import EnemyIcon from "@/components/EnemyIcon";
import { fmt } from "@/lib/ui";
import type { BattleBoss } from "@/lib/pachinko/battle";
import { getHeroSpriteDataUrl } from "@/lib/pachinko/heroSprite";

/**
 * 中央モニターに重ねるバトル映像（演出専用・タイミングは親が setTimeout で駆動）。
 * - fight   : RUSH中。勇者がボスへ通常攻撃を繰り返す（idle ループ）。
 * - decide  : ラウンド終了の決着。win=ボス撃破（連チャン継続）/ lose=勇者敗北（終了）。
 * - summary : 終了画面。連チャン回数と通算払い出しを約2秒表示してから通常へ戻る。
 * CSS keyframes / transition のみ（GPU合成）。rAF/canvas は使わない（発熱対策）。
 */
export type BattlePhase =
  | { kind: "off" }
  | { kind: "fight"; boss: BattleBoss; ren: number }
  | { kind: "decide"; boss: BattleBoss; ren: number; win: boolean }
  | { kind: "summary"; ren: number; total: number };

const SEA_BG =
  "radial-gradient(120% 90% at 50% 0%, #0a2740 0%, #061a2e 55%, #04101c 100%)";

export default function PachinkoBattle({
  phase,
  reduced = false,
}: {
  phase: BattlePhase;
  reduced?: boolean;
}) {
  // phase が変わるたびにアニメ要素を再マウントして頭から再生させる（key 用 tick）。
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick((v) => (v + 1) & 0xffff);
  }, [phase.kind, phase.kind === "decide" ? phase.win : 0]);

  if (phase.kind === "off") return null;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden rounded-xl"
      style={{ background: SEA_BG }}
    >
      {phase.kind === "fight" && <Fight boss={phase.boss} reduced={reduced} />}
      {phase.kind === "decide" && (
        <Decide key={tick} boss={phase.boss} win={phase.win} reduced={reduced} />
      )}
      {phase.kind === "summary" && (
        <Summary key={tick} ren={phase.ren} total={phase.total} />
      )}
    </div>
  );
}

/** 勇者スプライト（手続き生成の16×16ドット絵。画像アセットは増やさない）。 */
function Hero({ className = "", size = 56 }: { className?: string; size?: number }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(getHeroSpriteDataUrl());
  }, []);
  return (
    <span
      className={`inline-block select-none ${className}`}
      style={{
        width: size,
        height: size,
        lineHeight: 0,
        filter: "drop-shadow(0 0 6px rgba(120,200,255,.55))",
      }}
      aria-hidden
    >
      {url && (
        <img
          src={url}
          width={size}
          height={size}
          alt=""
          draggable={false}
          style={{ width: size, height: size, imageRendering: "pixelated" }}
        />
      )}
    </span>
  );
}

/** RUSH中の戦闘ループ：勇者がボスへ軽い斬撃を繰り返す。 */
function Fight({ boss, reduced }: { boss: BattleBoss; reduced: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-between px-4">
      <p className="pointer-events-none absolute inset-x-0 top-1 text-center text-[9px] font-bold tracking-widest text-cyan-300/80">
        勇者 vs {boss.name}
      </p>
      {/* 勇者（左）：斬撃ループ。 */}
      <div className="relative flex flex-col items-center">
        <Hero className={reduced ? "" : "fx-hero-slash"} size={56} />
      </div>
      {/* 上昇スパーク（火花）はドット＝小さな四角ピクセルで表現。 */}
      {!reduced && (
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 3 }, (_, i) => (
            <span
              key={i}
              className="fx-rise absolute left-1/2 top-1/2 block"
              style={{
                marginLeft: (i - 1) * 22,
                width: 4,
                height: 4,
                background: "#fcd34d",
                boxShadow: "0 0 4px #fbbf24",
                animationDelay: `${i * 0.3}s`,
                animationIterationCount: "infinite",
              }}
            />
          ))}
        </div>
      )}
      {/* ボス（右）：手続き生成のドット絵アイコンで鼓動。 */}
      <div className="relative flex flex-col items-center">
        <span className={reduced ? "" : "fx-throb inline-block"}>
          <EnemyIcon enemy={{ templateId: boss.id, isBoss: true, modTier: 0 }} size={72} />
        </span>
      </div>
    </div>
  );
}

/** ラウンド決着：win=ボス撃破 / lose=勇者敗北。 */
function Decide({ boss, win, reduced }: { boss: BattleBoss; win: boolean; reduced: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-between overflow-hidden px-4">
      {/* 勇者（左）。win=突進斬り / lose=ノックバックして倒れる。 */}
      <div className="relative flex flex-col items-center">
        <Hero
          className={reduced ? "" : win ? "fx-hero-lunge" : "fx-hero-down"}
          size={56}
        />
      </div>

      {/* ボス（右）。win=撃破アニメ / lose=とどめの一撃でフラッシュ。 */}
      <div className="relative flex flex-col items-center">
        <span className={reduced ? "" : win ? "fx-boss-die inline-block" : "fx-throb inline-block"}>
          <EnemyIcon enemy={{ templateId: boss.id, isBoss: true, modTier: 0 }} size={72} />
        </span>
      </div>

      {/* 決着フラッシュ・リング。 */}
      {!reduced && win && (
        <>
          <div className="fx-flash pointer-events-none absolute inset-0 z-20 bg-white/60" />
          <div className="rainbow-flash pointer-events-none absolute inset-0 z-10 opacity-25" />
          <div className="fx-ring pointer-events-none absolute left-2/3 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-200" />
        </>
      )}
      {!reduced && !win && (
        <div className="fx-screen-dark fx-shake pointer-events-none absolute inset-0 z-20 bg-black/60" />
      )}
    </div>
  );
}

/** 終了画面：連チャン回数と通算払い出し出玉を表示（約2秒）。 */
function Summary({ ren, total }: { ren: number; total: number }) {
  return (
    <div className="fate-pop flex h-full w-full flex-col items-center justify-center gap-1 text-center">
      <span className="text-3xl font-black text-amber-300 drop-shadow">{ren}連</span>
      <span className="text-sm font-bold text-cyan-200">
        通算 <span className="text-amber-200">+{fmt(total)}玉</span>
      </span>
    </div>
  );
}
