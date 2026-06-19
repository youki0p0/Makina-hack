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

/**
 * 中央の巨大図柄表示。絵柄は既存の固有武器＋神機マキナの procedural ドット絵を流用。
 * 3図柄を左→右に停止、テンパイ(リーチ)・群予告・昇格を演出。effects=false / reduced で短縮。
 */
const PachinkoReels = forwardRef<
  PachinkoReelsHandle,
  { effects?: boolean; reduced?: boolean }
>(function PachinkoReels({ effects = true, reduced = false }, ref) {
  const [cells, setCells] = useState<number[]>([1, 2, 3]);
  const [stopped, setStopped] = useState<boolean[]>([true, true, true]);
  const [reach, setReach] = useState(false);
  const [group, setGroup] = useState<ReelResult["group"]>(null);
  const [bonus, setBonus] = useState<string | null>(null);
  const [promo, setPromo] = useState<number[]>([]);
  // 図柄 id → 固有武器のドット絵 data URL（クライアントで一度だけ生成）。
  const [urls, setUrls] = useState<Record<number, string>>({});

  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cycler = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (cycler.current) {
      clearInterval(cycler.current);
      cycler.current = null;
    }
  };
  useEffect(() => () => clearTimers(), []);

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
      const stoppedNow = [false, false, false];
      setStopped([...stoppedNow]);

      const fast = !effects || reduced;
      const base = fast ? 110 : 460;
      const step = fast ? 110 : 430;
      const reachExtra = fast ? 0 : 900;

      cycler.current = setInterval(
        () => {
          setCells((prev) => prev.map((v, i) => (stoppedNow[i] ? v : ((v + 1 + i) % 7) + 1)));
        },
        fast ? 60 : 70,
      );

      const stop = (col: number, delay: number) => {
        const t = setTimeout(() => {
          stoppedNow[col] = true;
          setStopped([...stoppedNow]);
          setCells((prev) => {
            const next = [...prev];
            next[col] = result.symbols[col];
            return next;
          });
          if (col === 1 && result.symbols[0] === result.symbols[1]) setReach(true);
        }, delay);
        timers.current.push(t);
      };

      stop(0, base);
      stop(1, base + step);
      const reachDelay = result.symbols[0] === result.symbols[1] ? reachExtra : 0;
      stop(2, base + step * 2 + reachDelay);

      const settleAt = base + step * 2 + reachDelay + 260;
      const finish = setTimeout(() => {
        if (cycler.current) {
          clearInterval(cycler.current);
          cycler.current = null;
        }
        if (result.win) {
          if (result.promotion.length > 1) setPromo(result.promotion);
          setBonus(getSymbol(result.symbolId ?? 1).bonus);
        }
        const doneT = setTimeout(
          () => {
            busy.current = false;
            onDone();
          },
          fast ? 60 : 420,
        );
        timers.current.push(doneT);
      }, settleAt);
      timers.current.push(finish);
      return true;
    },
  }));

  return (
    <div className="relative rounded-xl border border-cyan-500/30 bg-[#06121f] p-2">
      {group && (
        <div
          className={`absolute inset-x-0 top-1 z-10 text-center text-xs font-extrabold ${
            group === "makina" ? "animate-pulse text-amber-300" : "text-cyan-200"
          }`}
        >
          ✦ {GROUP_LABEL[group]}
          {group === "makina" && " 激熱！"}
        </div>
      )}

      <div className="flex items-stretch justify-center gap-1.5 pt-4">
        {cells.map((id, i) => {
          const s = getSymbol(id);
          const isStopped = stopped[i];
          const url = urls[id];
          return (
            <div
              key={i}
              className={`flex h-24 flex-1 flex-col items-center justify-center rounded-lg border-2 ${
                isStopped ? "" : "blur-[1px]"
              } ${reach && i === 2 && !isStopped ? "animate-pulse" : ""}`}
              style={{ borderColor: s.color, background: `${s.color}22` }}
            >
              {url ? (
                <img
                  src={url}
                  alt={s.name}
                  width={48}
                  height={48}
                  draggable={false}
                  style={{ width: 48, height: 48, imageRendering: "pixelated" }}
                />
              ) : (
                <span className="block h-12 w-12 rounded bg-white/5" />
              )}
              <span className="mt-1 text-[9px] font-bold text-gray-200">{s.name}</span>
            </div>
          );
        })}
      </div>

      {reach && !bonus && (
        <p className="mt-1 text-center text-xs font-extrabold text-rose-300">★ リーチ！ ★</p>
      )}

      {promo.length > 1 && (
        <p className="mt-1 text-center text-[11px] text-amber-300">
          昇格！ {promo.join(" → ")}
        </p>
      )}

      {bonus && (
        <p
          className="mt-1 animate-pop text-center text-base font-black"
          style={{ color: getSymbol(cells[1]).color }}
        >
          ✦ {bonus} ✦
        </p>
      )}
    </div>
  );
});

export default PachinkoReels;
