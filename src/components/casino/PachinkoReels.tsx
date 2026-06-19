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
// SU予告（ステップアップ予告）の段階色（1→4で青→緑→赤→金にエスカレート）。
const SU_FILL = ["bg-sky-300", "bg-emerald-300", "bg-rose-400", "bg-amber-300"];
const SU_TEXT = ["text-sky-200", "text-emerald-200", "text-rose-200", "text-amber-200"];

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
  // 海物語式リーチ演出の段階表示。
  const [su, setSu] = useState(0); // SU予告ステップ（0=非表示）
  const [spName, setSpName] = useState<string | null>(null); // SP発展タイトル
  const [cu, setCu] = useState(0); // チャンスアップ点滅トリガ
  const [premium, setPremium] = useState(false); // プレミア（当確）

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
      setSu(0);
      setSpName(null);
      setCu(0);
      setPremium(false);
      setMoving([true, true, true]);

      const [topId, cId, botId] = result.symbols; // 中央列ライン [上, 中, 下]
      const isReach = topId === botId; // 横ドラム: 上下が揃えばテンパイ
      const sp = result.reachKind === "sp"; // SP発展＝激アツ（逆回転スロー）
      const fast = !effects || reduced;

      // フェーズ①加速: 3段同時にフリー回転開始。
      stopped.current = [false, false, false];
      tweens.current = [null, null, null];
      spinning.current = true;
      raf.current = requestAnimationFrame(animate);

      // フェーズ②予告: SU予告（ステップアップ）を順に点灯（テンパイ前の煽り）。
      if (!fast && result.su > 0) {
        for (let s = 1; s <= result.su; s++) at(60 + s * 150, () => setSu(s));
      }

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
      const reachWait = fast ? 0 : sp ? 1500 : isReach ? 700 : 0;
      const centerAt = t0 + stepT * 2 + reachWait;
      let centerEnd = centerAt + dur;

      if (fast || !isReach) {
        at(centerAt, () => tweenTo(1, nextK(offsets.current[1] + (fast ? 3 : 6), cId), dur, true));
      } else if (sp) {
        // パターンB: SP発展（黒潮＝逆回転スロー）。SPタイトル→チャンスアップ→当落。
        at(Math.max(0, centerAt - 600), () => setSpName(result.spName));
        for (let j = 1; j <= result.chanceUp; j++) at(centerAt + 200 + j * 460, () => setCu(j));
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

      // プレミア（当確）。演出ありなら本停止手前で“割り込み”、なければ確定時に。
      if (result.premium && !fast) at(Math.max(centerAt, centerEnd - 700), () => setPremium(true));

      // 確定（出目・onDone）。
      at(centerEnd + (fast ? 60 : 300), () => {
        spinning.current = false;
        setMoving([false, false, false]);
        if (result.premium) setPremium(true);
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

      {/* SU予告（ステップアップ予告）。段階が上がるほど信頼度↑。 */}
      {su > 0 && !bonus && (
        <div className="absolute left-1.5 top-1.5 z-30 flex items-center gap-0.5">
          {Array.from({ length: 4 }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-3 rounded-full ${i < su ? SU_FILL[su - 1] : "bg-white/15"}`}
            />
          ))}
          <span className={`ml-0.5 text-[9px] font-black ${SU_TEXT[su - 1]}`}>SU{su}</span>
        </div>
      )}

      {/* SP発展タイトル（ノーマル→SPリーチ昇格）。 */}
      {spName && !bonus && (
        <div className="absolute inset-x-0 top-7 z-30 text-center">
          <span className="inline-block animate-pop rounded-md border border-rose-300 bg-rose-500/25 px-3 py-0.5 text-sm font-black text-rose-100">
            ⚔ {spName} 発展！
          </span>
        </div>
      )}

      {/* チャンスアップ（SP中に追加で信頼度↑）。cu をキーに点滅再生。 */}
      {cu > 0 && !bonus && (
        <div key={cu} className="pointer-events-none absolute right-1.5 top-1/3 z-30 animate-pop">
          <span className="rounded bg-amber-400/90 px-2 py-0.5 text-[11px] font-black text-black">
            チャンスアップ！
          </span>
        </div>
      )}

      {/* プレミア演出（激レア・ほぼ当確）。 */}
      {premium && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-black/60 animate-pulse">
          <span className="rounded-xl border-2 border-amber-200 bg-amber-300/20 px-5 py-2 text-center text-lg font-black text-amber-100">
            ✦ プレミア ✦
            <br />
            <span className="text-base">当 確 ！</span>
          </span>
        </div>
      )}

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
