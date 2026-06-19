"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { getItemById } from "@/data/items";
import { getItemIconDataUrl } from "@/lib/itemIcon";
import { iconSpecForItem } from "@/components/ItemIcon";
import { getSymbol, GROUP_LABEL, SYMBOLS } from "@/lib/pachinko/symbols";
import type { ReelResult } from "@/lib/pachinko/reels";

export interface PachinkoReelsHandle {
  /** 図柄変動を開始。完了で onDone を呼ぶ。多重呼び出しは無視（busy）。 */
  spin: (result: ReelResult, onDone: () => void) => boolean;
  busy: () => boolean;
}

interface Tween {
  from: number;
  to: number;
  start: number;
  dur: number;
  final: boolean;
}

// ドラム位置(コマ単位) → 図柄 1..7（固定並び）。
const idAt = (off: number) => ((((Math.round(off) % 7) + 7) % 7) + 1) as number;
const CELL = 100 / 3; // 1コマ＝表示幅の1/3（横3コマ表示）

/**
 * 中央の巨大ドラム表示（海物語式・横ドラム）。
 * - 3リールを縦に3段（上/中/下）。各リールは図柄が左→右へ横スクロール。
 *   判定ラインは中央の縦列（各段の中央コマ）。
 * - 停止順は「上 → 下 → 中」。上下が揃うとテンパイ＝中リールだけ変則動作:
 *   ノーマル=±1コマからのコマ送り / 激アツ(神機マキナ群)=逆回転スロー。
 * - ハズレは中リールがトリガーの±1コマでズレて止まる。
 * effects=false / reduced では短縮。
 */
const PachinkoReels = forwardRef<
  PachinkoReelsHandle,
  { effects?: boolean; reduced?: boolean }
>(function PachinkoReels({ effects = true, reduced = false }, ref) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [, force] = useState(0); // スクロール再描画 tick
  const [moving, setMoving] = useState<boolean[]>([false, false, false]);
  const [reach, setReach] = useState(false);
  const [group, setGroup] = useState<ReelResult["group"]>(null);
  const [bonus, setBonus] = useState<string | null>(null);
  const [promo, setPromo] = useState<number[]>([]);

  // ドラム位置（ref で 60fps 駆動）。初期は中段に id 1,2,3。
  const offsets = useRef<number[]>([0, 1, 2]);
  const tweens = useRef<(Tween | null)[]>([null, null, null]);
  const stopped = useRef<boolean[]>([true, true, true]);
  const spinning = useRef(false);
  const raf = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    const out: Record<number, string> = {};
    for (const s of SYMBOLS) {
      const item = getItemById(s.itemId);
      if (item) out[s.id] = getItemIconDataUrl(iconSpecForItem(item));
    }
    setUrls(out);
  }, []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  };
  useEffect(() => () => clearTimers(), []);

  const FREE_SPEED = 0.34; // コマ/フレーム（上→下の高速回転）

  const animate = (now: number) => {
    for (let i = 0; i < 3; i++) {
      if (stopped.current[i]) continue;
      const tw = tweens.current[i];
      if (tw) {
        const t = Math.min(1, (now - tw.start) / tw.dur);
        const e = 1 - Math.pow(1 - t, 3); // easeOutCubic（減速）
        offsets.current[i] = tw.from + (tw.to - tw.from) * e;
        if (t >= 1) {
          offsets.current[i] = tw.to;
          tweens.current[i] = null;
          stopped.current[i] = true; // 中間停止も一旦保持（次の段で再始動）
        }
      } else {
        offsets.current[i] += FREE_SPEED;
      }
    }
    force((v) => (v + 1) & 0xffff);
    if (spinning.current) raf.current = requestAnimationFrame(animate);
    else raf.current = null;
  };

  const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const tweenTo = (i: number, to: number, dur: number, final: boolean) => {
    tweens.current[i] = { from: offsets.current[i], to, start: performance.now(), dur, final };
    stopped.current[i] = false;
  };
  // base 以降で図柄 id に止まる最小コマ位置。
  const nextK = (base: number, id: number) => {
    let k = Math.ceil(base);
    while (idAt(k) !== id) k++;
    return k;
  };

  useImperativeHandle(ref, () => ({
    busy: () => busy.current,
    spin(result, onDone) {
      if (busy.current) return false;
      busy.current = true;
      clearTimers();
      setBonus(null);
      setPromo([]);
      setReach(false);
      setGroup(result.group);
      setMoving([true, true, true]);

      const [topId, cId, botId] = result.symbols; // 中央列ライン [上, 中, 下]
      const isReach = topId === botId; // 横ドラム: 上下が揃えばテンパイ
      const hot = result.group === "makina"; // 激アツ→逆回転リーチ
      const fast = !effects || reduced;

      // フェーズ①加速: 3段同時にフリー回転開始。
      stopped.current = [false, false, false];
      tweens.current = [null, null, null];
      spinning.current = true;
      raf.current = requestAnimationFrame(animate);

      // フェーズ③順次減速: 上 → 下。
      const t0 = fast ? 90 : 380;
      const stepT = fast ? 80 : 320;
      const dur = fast ? 90 : 380;
      at(t0, () => tweenTo(0, nextK(offsets.current[0] + (fast ? 3 : 7), topId), dur, true));
      at(t0 + stepT, () => {
        tweenTo(2, nextK(offsets.current[2] + (fast ? 3 : 6), botId), dur, true);
        if (isReach) setReach(true);
      });

      // フェーズ④中リール: テンパイなら変則、非テンパイは普通に停止。
      const reachWait = fast ? 0 : hot ? 1500 : isReach ? 700 : 0;
      const centerAt = t0 + stepT * 2 + reachWait;
      let centerEnd = centerAt + dur;

      if (fast || !isReach) {
        at(centerAt, () => tweenTo(1, nextK(offsets.current[1] + (fast ? 3 : 6), cId), dur, true));
      } else if (hot) {
        // パターンB: 黒潮(逆回転)リーチ。行き過ぎて止まり、下→上へスロー逆回転で本停止。
        at(centerAt, () => {
          const kf = nextK(offsets.current[1] + 8, cId);
          tweenTo(1, kf + 1, 380, false); // 1コマ行き過ぎ
          at(380 + 320, () => tweenTo(1, kf, 760, true)); // 逆回転スロー
        });
        centerEnd = centerAt + 380 + 320 + 760;
      } else {
        // パターンA: ノーマル。±1コマ手前からカチ・カチとコマ送りして本停止。
        at(centerAt, () => {
          const kf = nextK(offsets.current[1] + 8, cId);
          tweenTo(1, kf - 2, 340, false);
          at(340 + 160, () => tweenTo(1, kf - 1, 200, false));
          at(340 + 160 + 200 + 160, () => tweenTo(1, kf, 220, true));
        });
        centerEnd = centerAt + 340 + 160 + 200 + 160 + 220;
      }

      // 確定（出目・onDone）。
      at(centerEnd + (fast ? 60 : 300), () => {
        spinning.current = false;
        setMoving([false, false, false]);
        if (result.win) {
          if (result.promotion.length > 1) setPromo(result.promotion);
          setBonus(getSymbol(result.symbolId ?? 1).bonus);
        }
        at(fast ? 60 : 380, () => {
          busy.current = false;
          onDone();
        });
      });
      return true;
    },
  }));

  // 1段を描画（中央コマ=判定ライン。左→右スクロールで横3コマ＋左右バッファ）。
  const renderReel = (i: number) => {
    const p = offsets.current[i];
    const k = Math.floor(p);
    const isMoving = moving[i];
    const midId = idAt(p);
    const s = getSymbol(midId);
    const tiles = [];
    for (let n = k - 2; n <= k + 2; n++) {
      // x_center%: 中央(50%) を基準に、p 増加で右へ流れる。
      const xc = 50 + (p - n) * CELL;
      tiles.push(
        <Tile key={n} id={idAt(n)} xc={xc} url={urls[idAt(n)]} blur={isMoving} />,
      );
    }
    return (
      <div
        key={i}
        className={`relative w-full flex-1 overflow-hidden rounded-lg border-2 ${
          reach && i === 1 && isMoving ? "animate-pulse" : ""
        }`}
        style={{ borderColor: s.color, background: `${s.color}1f` }}
      >
        {tiles}
        {/* 中央コマ（判定ライン）の目印（縦線）。 */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-amber-300/30" />
      </div>
    );
  };

  return (
    <div className="relative flex h-full w-full flex-col rounded-xl bg-[#04101c]/80 p-2">
      <p className="text-center text-[8px] tracking-widest text-cyan-400/70">▼ MONITOR ▼</p>
      {group === "makina" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/55 animate-pulse">
          <span className="rounded-lg border-2 border-amber-300 bg-amber-400/15 px-4 py-2 text-lg font-black tracking-wide text-amber-200">
            ✦ 神機マキナ群 ✦<br />
            <span className="text-sm">激 熱 ！ ！</span>
          </span>
        </div>
      ) : group ? (
        <div className="absolute inset-x-0 top-5 z-10 text-center text-sm font-extrabold text-cyan-200">
          ✦ {GROUP_LABEL[group]}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 pt-1">
        {renderReel(0)}
        {renderReel(1)}
        {renderReel(2)}
      </div>

      {reach && !bonus && (
        <p className="mt-1 text-center text-xs font-extrabold text-rose-300">★ リーチ！ ★</p>
      )}
      {promo.length > 1 && (
        <p className="mt-1 text-center text-[11px] text-amber-300">昇格！ {promo.join(" → ")}</p>
      )}
      {bonus && (
        <p
          className="mt-1 animate-pop text-center text-base font-black"
          style={{ color: getSymbol(idAt(offsets.current[1])).color }}
        >
          ✦ {bonus} ✦
        </p>
      )}
    </div>
  );
});

function Tile({ id, xc, url, blur }: { id: number; xc: number; url?: string; blur: boolean }) {
  const s = getSymbol(id);
  return (
    <div
      className="absolute inset-y-0 flex items-center justify-center"
      style={{ left: `${xc - CELL / 2}%`, width: `${CELL}%` }}
    >
      {url ? (
        <img
          src={url}
          alt={s.name}
          width={38}
          height={38}
          draggable={false}
          style={{ width: 38, height: 38, imageRendering: "pixelated", filter: blur ? "blur(1px)" : "none" }}
        />
      ) : (
        <span className="block h-9 w-9 rounded bg-white/5" />
      )}
    </div>
  );
}

export default PachinkoReels;
