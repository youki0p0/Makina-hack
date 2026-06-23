"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getField } from "@/data/arena/fields";
import { sfx } from "@/lib/audio/sfx";
import type { BattleResult, StatusType, UnitSnapshot } from "@/types/arena";

const STATUS_EMOJI: Record<StatusType, string> = {
  burn: "🔥",
  poison: "☠️",
  regen: "🍃",
  blind: "🌑",
  haste: "⚡",
  defDown: "🔻",
  shield: "🛡️",
  taunt: "📣",
  curse: "💀",
  atkUp: "💢",
};

function UnitSprite({ uid, emoji }: { uid: string; emoji: string }) {
  const [err, setErr] = useState(false);
  const monsterId = uid.split("-")[2] ?? "";
  if (err || !monsterId) return <span>{emoji}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/arena/monsters/${monsterId}.png`}
      alt={emoji}
      onError={() => setErr(true)}
      style={{ imageRendering: "pixelated", width: 38, height: 38, objectFit: "contain" }}
    />
  );
}

function UnitCard({ u, delta, frameKey }: { u: UnitSnapshot; delta: number; frameKey: number }) {
  const ratio = u.maxHp > 0 ? Math.max(0, u.hp / u.maxHp) : 0;
  const barColor = u.side === "ally" ? "bg-emerald-500" : "bg-rose-500";
  const damaged = delta > 0;
  const healed = delta < 0;
  return (
    <div
      className={`relative flex w-[30%] flex-col items-center gap-0.5 rounded-lg p-1 ${
        u.alive ? "bg-black/30" : "bg-black/50 opacity-40"
      }`}
    >
      {delta !== 0 && u.alive && (
        <span
          key={frameKey}
          className="dmg-float text-[13px]"
          style={{ color: damaged ? "#fca5a5" : "#86efac", top: "10%" }}
        >
          {damaged ? `-${delta}` : `+${-delta}`}
        </span>
      )}
      <div
        key={`s${frameKey}`}
        className="flex h-10 items-center justify-center text-2xl leading-none"
        style={damaged ? { animation: "fxShake 0.3s" } : healed ? { animation: "fatePop 0.3s" } : undefined}
      >
        {u.alive ? <UnitSprite uid={u.uid} emoji={u.emoji} /> : <span>💀</span>}
      </div>
      <div className="w-full truncate text-center text-[8px] text-white/80">{u.name}</div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
        <div className={`h-full ${barColor}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="text-[7px] text-white/70">
        {u.hp}/{u.maxHp}
        {u.shield > 0 && <span className="text-sky-300"> +{u.shield}🛡️</span>}
      </div>
      <div className="flex flex-wrap justify-center gap-0.5 text-[8px]">
        {u.statuses.map((s) => (
          <span key={s}>{STATUS_EMOJI[s]}</span>
        ))}
      </div>
    </div>
  );
}

export default function BattleView({
  result,
  onFinished,
}: {
  result: BattleResult;
  onFinished: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const f = getField(result.field);

  const frame = result.frames[Math.min(idx, result.frames.length - 1)];
  const done = idx >= result.frames.length - 1;

  // 現フレームまでに起きたイベントを蓄積（直近を表示）
  const logLines = useMemo(() => {
    const lines: string[] = [];
    for (let i = 0; i <= idx && i < result.frames.length; i++) {
      for (const e of result.frames[i].events) lines.push(e);
    }
    return lines.slice(-7);
  }, [idx, result.frames]);

  useEffect(() => {
    if (done) return;
    timer.current = setTimeout(() => setIdx((v) => v + 1), 520 / speed);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [idx, done, speed]);

  // フレームのイベントに応じて効果音（mute は engine 側で尊重）。1フレーム1音に絞る。
  useEffect(() => {
    const evs = result.frames[idx]?.events ?? [];
    if (evs.length === 0) return;
    const text = evs.join(" ");
    if (text.includes("勝利")) sfx("win");
    else if (text.includes("敗北")) sfx("lose");
    else if (text.includes("クリティカル")) sfx("crit");
    else if (text.includes("回復") || text.includes("蘇")) sfx("heal");
    else if (text.includes("倒れた")) sfx("hurt");
    else if (/⚔️|🔥|💥|🎯|🪞|火傷|毒/.test(text)) sfx("hit");
  }, [idx, result.frames]);

  const enemies = frame.units.filter((u) => u.side === "enemy").sort((a, b) => a.slot - b.slot);
  const allies = frame.units.filter((u) => u.side === "ally").sort((a, b) => a.slot - b.slot);

  // 前フレームとのHP差分（ダメージ=正 / 回復=負）でフローティング数値を出す
  const prevHp = new Map<string, number>();
  const prev = result.frames[idx - 1];
  if (prev) for (const u of prev.units) prevHp.set(u.uid, u.hp);
  const deltaOf = (u: UnitSnapshot) => (prevHp.has(u.uid) ? (prevHp.get(u.uid) as number) - u.hp : 0);

  return (
    <div className="flex flex-col gap-2">
      <div
        style={{ background: f.background, borderColor: f.accent }}
        className="rounded-2xl border p-2"
      >
        <div className="mb-1 flex items-center justify-between text-[10px] text-white/80">
          <span>
            {f.emoji} {f.name}
          </span>
          <span className={result.boss ? "font-bold text-amber-300" : ""}>
            {result.boss ? "👑 ボス " : ""}
            {result.round} 回戦
          </span>
        </div>

        {/* 敵 3体 */}
        <div className="flex justify-between gap-1">
          {enemies.map((u) => (
            <UnitCard key={u.uid} u={u} delta={deltaOf(u)} frameKey={idx} />
          ))}
        </div>

        <div className="my-1 text-center text-[10px] font-black text-white/60">⚔️ VS ⚔️</div>

        {/* 味方 3体 */}
        <div className="flex justify-between gap-1">
          {allies.map((u) => (
            <UnitCard key={u.uid} u={u} delta={deltaOf(u)} frameKey={idx} />
          ))}
        </div>
      </div>

      {/* 戦闘ログ */}
      <div className="h-24 overflow-hidden rounded-xl border border-white/10 bg-black/40 p-2">
        <div className="flex flex-col gap-0.5 text-[10px] leading-tight text-gray-200">
          {logLines.map((l, i) => (
            <div key={i} className={i === logLines.length - 1 ? "text-white" : "text-gray-400"}>
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* 操作 */}
      <div className="flex gap-2">
        {!done ? (
          <>
            <button
              onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
              className="flex-1 rounded-xl bg-white/10 py-2 text-sm font-bold active:scale-95"
            >
              ⏩ 速度 x{speed}
            </button>
            <button
              onClick={() => setIdx(result.frames.length - 1)}
              className="flex-1 rounded-xl bg-white/10 py-2 text-sm font-bold active:scale-95"
            >
              ⏭ スキップ
            </button>
          </>
        ) : (
          <button
            onClick={onFinished}
            className={`flex-1 rounded-2xl py-3 text-base font-extrabold text-white active:scale-95 ${
              result.win ? "bg-emerald-600" : "bg-rose-700"
            }`}
          >
            {result.win ? "🏆 勝利！ 結果へ" : "❌ 敗北… 結果へ"}
          </button>
        )}
      </div>
    </div>
  );
}
