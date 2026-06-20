"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { getItemById } from "@/data/items";
import { getItemIconDataUrl } from "@/lib/itemIcon";
import { iconSpecForItem } from "@/components/ItemIcon";
import { getSymbol, SYMBOLS } from "@/lib/pachinko/symbols";
import type { ReelResult } from "@/lib/pachinko/reels";

export interface PachinkoReelsHandle {
  /** 図柄変動を開始。完了で onDone を呼ぶ。多重呼び出しは無視（busy）。 */
  spin: (result: ReelResult, onDone: () => void) => boolean;
  busy: () => boolean;
  /** すべての演出オーバーレイを消す（RUSH中はリールが回らずリセットが走らないため）。 */
  clearEffects: () => void;
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
  // 海物語式リーチ演出の段階表示（文字ではなくグラフィック/動きで見せる）。
  const [spId, setSpId] = useState<number | null>(null); // SP発展＝この図柄でカットイン
  const [cu, setCu] = useState(0); // チャンスアップ（バースト再生トリガ）
  const [premium, setPremium] = useState(false); // プレミア（当確）
  const [winId, setWinId] = useState<number | null>(null); // 当たり確定図柄（カットイン）
  const [flash, setFlash] = useState(0); // 全画面フラッシュの再生トリガ
  const [fullReach, setFullReach] = useState<number | null>(null); // 全画面リーチ（激アツtakeover）の図柄

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
    // 直前スピンの演出（群予告/SU pip/カットイン/プレミア/全画面リーチ等）を一括で消す。
    // RUSH中はリールが回らず spin() のリセットが走らないため、突入時にこれで掃除する。
    clearEffects() {
      setGroup(null);
      setBonus(null);
      setPromo([]);
      setReach(false);
      setSpId(null);
      setCu(0);
      setPremium(false);
      setWinId(null);
      setFullReach(null);
      setFlash(0);
    },
    spin(result, onDone) {
      if (busy.current) return false;
      busy.current = true;
      clearTimers();
      setBonus(null);
      setPromo([]);
      setReach(false);
      setGroup(result.group);
      setSpId(null);
      setCu(0);
      setPremium(false);
      setWinId(null);
      setFullReach(null);
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

      // フェーズ③順次減速: 上 → 下。
      const t0 = fast ? 90 : 380;
      const stepT = fast ? 80 : 320;
      const dur = fast ? 90 : 380;
      at(t0, () => tweenTo(0, nextK(offsets.current[0] + (fast ? 3 : 7), topId), dur, true));
      at(t0 + stepT, () => {
        tweenTo(2, nextK(offsets.current[2] + (fast ? 3 : 6), botId), dur, true);
        if (isReach) {
          setReach(true);
          setFlash((f) => f + 1); // テンパイ＝フラッシュ＋判定ラインのスイープ光
        }
      });

      // フェーズ④中リール: テンパイなら変則、非テンパイは普通に停止。
      const reachWait = fast ? 0 : sp ? 1500 : isReach ? 700 : 0;
      const centerAt = t0 + stepT * 2 + reachWait;
      let centerEnd = centerAt + dur;

      if (fast || !isReach) {
        at(centerAt, () => tweenTo(1, nextK(offsets.current[1] + (fast ? 3 : 6), cId), dur, true));
      } else if (sp) {
        // パターンB: SP発展（黒潮＝逆回転スロー）。図柄カットイン→チャンスアップ→当落。
        // 激アツ(プレミア or 神機マキナ群)は「全画面リーチ」takeover に発展。
        const epic = result.premium || result.group === "makina";
        at(Math.max(0, centerAt - 600), () => {
          setSpId(topId); // テンパイ図柄でドンとカットイン
          setFlash((f) => f + 1);
          if (epic) setFullReach(topId);
        });
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
      if (result.premium && !fast) {
        at(Math.max(centerAt, centerEnd - 700), () => {
          setPremium(true);
          setFlash((f) => f + 1);
        });
      }

      // 確定（出目・onDone）。
      at(centerEnd + (fast ? 60 : 300), () => {
        spinning.current = false;
        setMoving([false, false, false]);
        setFullReach(null); // 全画面リーチ終了→結果（当たりカットイン/プレミア）へ
        if (result.premium) setPremium(true);
        if (result.win) {
          if (result.promotion.length > 1) setPromo(result.promotion);
          setBonus(getSymbol(result.symbolId ?? 1).bonus);
          setWinId(result.symbolId ?? 1); // 当たり図柄のドンッ！カットイン
          setFlash((f) => f + 1);
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

  const groupUrl = group === "makina" ? urls[7] : urls[6];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-[#04101c]/80 p-2">
      <p className="text-center text-[8px] tracking-widest text-cyan-400/70">▼ MONITOR ▼</p>

      {/* 群予告（魚群相当）: 図柄が左→右へ群れで流れる。makina=金で激アツ。 */}
      {group && !bonus && (
        <>
          {group === "makina" && (
            <div className="pointer-events-none absolute inset-0 z-20 rounded-xl bg-black/45" />
          )}
          <Swarm url={groupUrl} count={group === "makina" ? 14 : 7} hot={group === "makina"} />
        </>
      )}

      {/* SP発展: テンパイ図柄をドンとカットイン＋衝撃リング（文字なし）。 */}
      {spId != null && !bonus && (
        <CutIn url={urls[spId]} color={getSymbol(spId).color} z={30} />
      )}

      {/* チャンスアップ: 中央でスパークが弾けて舞い上がる（cu をキーに再生）。 */}
      {cu > 0 && !bonus && (
        <div key={cu} className="pointer-events-none absolute inset-0 z-30">
          <div className="fx-ring absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300" />
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className="fx-rise absolute left-1/2 top-1/2 text-amber-300"
              style={{ marginLeft: (i - 2.5) * 16, fontSize: 12, animationDelay: `${i * 0.04}s` }}
            >
              ✦
            </span>
          ))}
        </div>
      )}

      {/* プレミア（当確）: 全画面の虹フラッシュ＋光線＋神機マキナが巨大回転＋多重リング。 */}
      {premium && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-black/70" />
          <div className="rainbow-flash absolute inset-0 opacity-60" />
          <div
            className="fx-rays absolute left-1/2 top-1/2 opacity-50"
            style={{
              width: "180vmax",
              height: "180vmax",
              background:
                "repeating-conic-gradient(from 0deg, rgba(255,235,160,0) 0deg, rgba(255,235,160,.5) 5deg, rgba(255,235,160,0) 10deg)",
            }}
          />
          <div className="fx-ring absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-100" />
          <div
            className="fx-ring absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-fuchsia-200"
            style={{ animationDelay: "0.18s" }}
          />
          {urls[7] && (
            <img
              src={urls[7]}
              alt=""
              className="fx-huespin relative"
              style={{ width: 112, height: 112, imageRendering: "pixelated", filter: "drop-shadow(0 0 22px #ffcf33)" }}
            />
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 pt-1">
        {renderReel(0)}
        {renderReel(1)}
        {renderReel(2)}
      </div>

      {/* 昇格: 図柄チェインが順にせり上がって光る（3→6→7 を絵で）。 */}
      {promo.length > 1 && !premium && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex items-center justify-center gap-1">
          {promo.map((pid, i) => (
            <img
              key={i}
              src={urls[pid]}
              alt=""
              className="fx-cutin"
              style={{
                width: 28,
                height: 28,
                imageRendering: "pixelated",
                animationDelay: `${i * 0.18}s`,
                filter: `drop-shadow(0 0 6px ${getSymbol(pid).color})`,
              }}
            />
          ))}
        </div>
      )}

      {/* 当たり確定: 当たり図柄をドンッ！とカットイン＋リング＋舞い上がるスパーク。 */}
      {winId != null && (
        <CutIn url={urls[winId]} color={getSymbol(winId).color} z={35} big sparks />
      )}

      {/* 全画面リーチ（激アツtakeover）: モニターを飛び出して画面全体を支配。 */}
      {fullReach != null && (
        <div className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-black/80" />
          <div
            className="fx-rays absolute left-1/2 top-1/2 opacity-40"
            style={{
              width: "180vmax",
              height: "180vmax",
              background: `repeating-conic-gradient(from 0deg, ${getSymbol(fullReach).color}00 0deg, ${getSymbol(fullReach).color}99 5deg, ${getSymbol(fullReach).color}00 10deg)`,
            }}
          />
          <div className="rainbow-flash absolute inset-0 opacity-25" />
          <div className="fx-shake relative flex items-center justify-center">
            <div
              className="fx-ring absolute h-44 w-44 rounded-full border-4"
              style={{ borderColor: getSymbol(fullReach).color }}
            />
            <div
              className="fx-ring absolute h-44 w-44 rounded-full border-4"
              style={{ borderColor: getSymbol(fullReach).color, animationDelay: "0.2s" }}
            />
            <div className="fx-zoom">
              <img
                src={urls[fullReach]}
                alt=""
                className="fx-throb"
                style={{
                  width: 120,
                  height: 120,
                  imageRendering: "pixelated",
                  filter: `drop-shadow(0 0 24px ${getSymbol(fullReach).color})`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* テンパイ/SP/当たり/プレミアの瞬間フラッシュ（key で毎回再生）。白フラッシュは全画面。 */}
      {flash > 0 && (
        <div key={flash} className="pointer-events-none">
          <div className="fx-flash fixed inset-0 z-[62] bg-white/55" />
          <div className="fx-line absolute inset-y-0 left-0 z-50 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        </div>
      )}
    </div>
  );
});

/** 図柄カットイン: 小さく回りながらドンと拡大＋衝撃リング＋（任意で）舞うスパーク。 */
function CutIn({
  url,
  color,
  z,
  big,
  sparks,
}: {
  url?: string;
  color: string;
  z: number;
  big?: boolean;
  sparks?: boolean;
}) {
  if (!url) return null;
  const size = big ? 76 : 58;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ zIndex: z }}>
      <div
        className="fx-ring absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{ width: size + 34, height: size + 34, borderColor: color }}
      />
      <div
        className="fx-ring absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{ width: size + 34, height: size + 34, borderColor: color, animationDelay: "0.16s" }}
      />
      <img
        src={url}
        alt=""
        className="fx-cutin relative"
        style={{ width: size, height: size, imageRendering: "pixelated", filter: `drop-shadow(0 0 16px ${color})` }}
      />
      {sparks &&
        Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="fx-rise absolute left-1/2 top-1/2"
            style={{ marginLeft: (i - 4.5) * 18, color, fontSize: 13, animationDelay: `${0.1 + (i % 4) * 0.05}s` }}
          >
            ✦
          </span>
        ))}
    </div>
  );
}

/** 群予告のスウォーム: 同じ図柄が時間差で左→右へ流れる（魚群相当）。 */
function Swarm({ url, count, hot }: { url?: string; count: number; hot?: boolean }) {
  if (!url) return null;
  const size = hot ? 30 : 20;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const top = 6 + ((i * 41) % 78);
        const delay = (i * 0.11).toFixed(2);
        const dur = (1.0 + (i % 3) * 0.28).toFixed(2);
        return (
          <img
            key={i}
            src={url}
            alt=""
            style={{
              position: "absolute",
              top: `${top}%`,
              left: 0,
              width: size,
              height: size,
              imageRendering: "pixelated",
              animation: `fxSweep ${dur}s linear ${delay}s both, fxBob 0.6s ease-in-out ${delay}s infinite`,
              filter: hot ? "drop-shadow(0 0 7px #ffcf33)" : "drop-shadow(0 0 3px rgba(120,200,255,.7))",
            }}
          />
        );
      })}
    </div>
  );
}

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
