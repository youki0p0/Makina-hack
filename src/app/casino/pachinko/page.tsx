"use client";

import Link from "next/link";
import { useCallbackRef } from "@/lib/useCallbackRef";
import { useEffect, useRef, useState } from "react";
import PachinkoBoard, { type PachinkoBoardHandle } from "@/components/casino/PachinkoBoard";
import PachinkoReels, { type PachinkoReelsHandle } from "@/components/casino/PachinkoReels";
import PayoutParticles, { type PayoutParticlesHandle } from "@/components/casino/PayoutParticles";
import EventBadge from "@/components/EventBadge";
import { PACHINKO_CONFIG, BOARD } from "@/lib/pachinko/config";
import { spinReels, type Mode, type ReelResult } from "@/lib/pachinko/reels";
import { getSymbol } from "@/lib/pachinko/symbols";
import { rollBonus, rollContinue, ATTACKER_PRIZE, type BonusType } from "@/lib/pachinko/bonus";
import {
  MACHINE_COUNT,
  settingBucket,
  effectivePachiSettings,
  pachiSettingMult,
  pachiCeilingSpins,
  casinoEvent,
} from "@/lib/casino";
import { useGameStore } from "@/store/gameStore";
import { initAudio, slotSfx, isMuted, setMuted, setBgmTheme, startBgm, stopBgm } from "@/lib/audio";
import { fmt } from "@/lib/ui";

const HOLD_MAX = 8;
// 当たった瞬間に“何が起きたか”を見せる停止演出の長さ（スロット同様）。
const REVEAL_MS = 800;
// ボーナス1ゲーム(回転)の長さ。保証G ぶん消化したらラウンド終了→継続抽選。
const GAME_MS = 420;
const PACHI_MACHINE_KEY = "pachiMachine";

// ボーナス(RUSH)の進行状態。出玉は大入賞口に入った玉で payRemaining を削って加算。
interface Rush {
  coins: number; // この当たりの保証枚数
  gamesLeft: number; // 残り保証G
  payRemaining: number; // 残り出玉（大入賞入賞で減る／ラウンド終了でフラッシュ）
  loop: number; // 継続率
  ren: number; // 連チャン数（累計）
}

// 保留＝ヘソ入賞時に内部抽選済みの1変動（実機どおり）。色は信頼度の先読み示唆。
interface Hold {
  result: ReelResult;
  color: string;
}
const HOLD_COLORS: Record<string, string> = {
  white: "#e5e7eb",
  blue: "#38bdf8",
  green: "#34d399",
  red: "#f43f5e",
  rainbow: "#fbbf24",
};

/** 先読み色を抽選（赤/虹はほぼ当たり、まれにガセ＝裏切りで興奮を作る）。 */
function holdColorFor(result: ReelResult, rng = Math.random): string {
  if (result.win) {
    if (result.jackpot) return "rainbow";
    if (result.tier === "big") return rng() < 0.55 ? "red" : "green";
    return rng() < 0.5 ? "green" : rng() < 0.5 ? "blue" : "white";
  }
  // ハズレ：ほぼ白、まれに高信頼色（ガセ）。
  const r = rng();
  if (r < 0.012) return "red";
  if (r < 0.05) return "green";
  if (r < 0.16) return "blue";
  return "white";
}

export default function PachinkoPage() {
  const boardRef = useRef<PachinkoBoardHandle>(null);
  const reelsRef = useRef<PachinkoReelsHandle>(null);
  const particlesRef = useRef<PayoutParticlesHandle>(null);

  // 甘ダイスはカジノコインで遊技（1コイン=1玉）。発射で-1、払い出しで加算。
  const hydrate = useGameStore((s) => s.hydrate);
  const coins = useGameStore((s) => s.coins);
  const addCoins = useGameStore((s) => s.addCoins);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const [mode, setMode] = useState<Mode>("normal");
  const modeRef = useRef<Mode>("normal");
  modeRef.current = mode;

  // 保留(ヘソ入賞のストック、最大8。各保留は抽選済み結果＋先読み色を持つ)。
  const [holds, setHolds] = useState<Hold[]>([]);
  const holdsRef = useRef<Hold[]>([]);
  holdsRef.current = holds;

  // ボーナス(RUSH)の状態。null=非ボーナス。
  const [rush, setRush] = useState<Rush | null>(null);
  const rushRef = useRef<Rush | null>(null);
  rushRef.current = rush;
  // 天井カウンタ（通常時の連続ノーヒット回転数）。初当たりで0へ。
  const [spins, setSpins] = useState(0);
  const spinsRef = useRef(0);

  // 台選択（4台・隠し設定1-6・6時間ごとシャッフル＝看破の沼）。
  const [machine, setMachine] = useState(0);
  useEffect(() => {
    const saved = Number(window.localStorage.getItem(PACHI_MACHINE_KEY));
    if (Number.isInteger(saved) && saved >= 0 && saved < MACHINE_COUNT) setMachine(saved);
  }, []);
  // イベントデー中は実効設定(上書き後)で初当たり率・天井を決める。
  const setting = effectivePachiSettings(settingBucket())[machine] ?? 1;
  const winMult = pachiSettingMult(setting);
  const winMultRef = useRef(winMult);
  winMultRef.current = winMult;
  const ceiling = pachiCeilingSpins(setting);
  const ceilingRef = useRef(ceiling);
  ceilingRef.current = ceiling;
  // 別の台に座る＝新台なので天井ハマりをリセット（隠し設定はそのまま）。
  const sitMachine = (i: number) => {
    setMachine(i);
    window.localStorage.setItem(PACHI_MACHINE_KEY, String(i));
    spinsRef.current = 0;
    setSpins(0);
  };

  // おじさん（交換所）に暴かれた甘ダイス各台の設定。購入に追従して台ボタンに表示。
  const [tips, setTips] = useState<Record<number, number>>({});
  useEffect(() => {
    const load = () => {
      try {
        const raw = window.localStorage.getItem("casinoTips");
        if (raw) {
          const p = JSON.parse(raw);
          if (p && p.bucket === settingBucket()) {
            setTips(p.pachi ?? {});
            return;
          }
        }
      } catch {
        /* ignore */
      }
      setTips({});
    };
    load();
    window.addEventListener("casinoTips", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("casinoTips", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  // 獲得枚数の“その場表示”（ヘソ/大入賞の上に +N がふわっと浮く）。
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; text: string; color: string }[]>([]);
  const floatId = useRef(0);
  const lastAtkFloat = useRef(0);
  const spawnFloat = useCallbackRef((xB: number, yB: number, text: string, color: string) => {
    const id = ++floatId.current;
    const x = (xB / BOARD.width) * 100;
    const y = (yB / BOARD.height) * 100;
    setFloats((f) => [...f.slice(-11), { id, x, y, text, color }]);
    window.setTimeout(() => setFloats((f) => f.filter((p) => p.id !== id)), 850);
  });
  // 当たり確定→ボーナス突入までの停止演出中（その図柄色）。
  const [reveal, setReveal] = useState<string | null>(null);

  const [auto, setAuto] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [effects, setEffects] = useState(true);
  const [flash, setFlash] = useState(false);
  const [sound, setSound] = useState(true);
  useEffect(() => {
    setSound(!isMuted());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (m.matches) {
      setReduced(true);
      setEffects(false);
    }
  }, []);

  // ===== ボーナス突入（初当たり or 継続）。出玉=保証枚数、保証Gぶん右打ちで大入賞へ。 =====
  const enterRush = useCallbackRef((b: BonusType, ren: number) => {
    const r: Rush = { coins: b.coins, gamesLeft: b.games, payRemaining: b.coins, loop: b.loop, ren };
    rushRef.current = r;
    setRush(r);
    if (modeRef.current !== "complete") {
      setMode("complete");
      modeRef.current = "complete";
    }
    holdsRef.current = [];
    setHolds([]);
    slotSfx(b.coins >= 300 ? "bonusBig" : "bonus");
    if (effects) {
      if (typeof navigator !== "undefined") navigator.vibrate?.(ren > 1 ? [20, 20, 40] : [40, 30, 80]);
      setFlash(true);
      window.setTimeout(() => setFlash(false), b.coins >= 300 ? 1800 : 900);
    }
  });

  // ===== 大入賞口入賞＝出玉。残り保証枚数を削りながらコイン加算（玉が入る＝増える）。 =====
  const onAttacker = useCallbackRef(() => {
    const r = rushRef.current;
    if (!r || r.payRemaining <= 0) return;
    const inc = Math.min(ATTACKER_PRIZE, r.payRemaining);
    r.payRemaining -= inc;
    addCoins(inc);
    if (effects) particlesRef.current?.emit(3);
    // 大入賞口の上に +N をふわっと表示（連射で潰れないよう間引き）。
    const now = Date.now();
    if (now - lastAtkFloat.current > 110) {
      lastAtkFloat.current = now;
      spawnFloat(BOARD.attackerX, BOARD.attackerY - 6, `+${inc}`, "#ffcf33");
    }
  });

  // ===== ボーナス進行（保証G消化→ラウンド終了で残出玉フラッシュ＋継続抽選） =====
  useEffect(() => {
    if (mode !== "complete") return;
    const id = setInterval(() => {
      const r = rushRef.current;
      if (!r) return; // 当たり停止演出(reveal)中はまだ回さない
      const left = r.gamesLeft - 1;
      if (left > 0) {
        const nr = { ...r, gamesLeft: left };
        rushRef.current = nr;
        setRush(nr);
        return;
      }
      // ラウンド終了。これ以上ティックで処理しないよう一旦ロック。
      rushRef.current = null;
      // 残りの保証出玉を一気に放出（保証担保）。
      if (r.payRemaining > 0) {
        addCoins(r.payRemaining);
        if (effects) particlesRef.current?.emit(Math.min(60, r.payRemaining));
      }
      if (rollContinue(r.loop)) {
        // 継続（連チャン）：新ボーナスを抽選してループ。
        window.setTimeout(() => enterRush(rollBonus(), r.ren + 1), 350);
      } else {
        // 終了→通常へ。
        window.setTimeout(() => {
          setRush(null);
          setMode("normal");
          modeRef.current = "normal";
        }, 500);
      }
    }, reduced ? 260 : GAME_MS);
    return () => clearInterval(id);
  }, [mode, reduced, enterRush, effects, addCoins]);

  // ===== 変動の確定処理 =====
  const onReelDone = useCallbackRef((result: ReelResult) => {
    if (result.win) {
      spinsRef.current = 0; // 初当たり→天井カウンタをリセット
      setSpins(0);
      if (effects && typeof navigator !== "undefined") navigator.vibrate?.(20);
      slotSfx("reach");
      // 当たり目で止め、0.5〜1秒“何が起きたか”を見せてからボーナス突入（スロット同様）。
      setMode("complete");
      modeRef.current = "complete";
      setReveal(getSymbol(result.symbolId ?? 1).color);
      const b = rollBonus();
      window.setTimeout(() => {
        setReveal(null);
        enterRush(b, 1);
      }, reduced ? 450 : REVEAL_MS);
      return;
    }
    // ハズレ：通常モードのみ保留消化で連続変動。
    if (modeRef.current === "normal" && holdsRef.current.length > 0) {
      const [next, ...rest] = holdsRef.current;
      holdsRef.current = rest;
      setHolds(rest);
      window.setTimeout(() => doSpinWith(next.result), 80);
    }
  });

  const doSpinWith = useCallbackRef((result: ReelResult) => {
    if (result.reach && effects) slotSfx("reach");
    reelsRef.current?.spin(result, () => onReelDone(result));
  });

  // ヘソ入賞。入賞時に1変動を内部抽選し、変動中なら保留(最大8)に積む（実機どおり）。
  const onPocket = useCallbackRef(() => {
    if (modeRef.current === "complete") return; // 当たり中は右打ち＝ヘソは使わない
    slotSfx("small");
    if (effects && typeof navigator !== "undefined") navigator.vibrate?.(8);
    addCoins(BOARD.hesoPrize); // ヘソ賞球（玉持ち＝回転率改善。通常時のみ）
    spawnFloat(BOARD.pocketX, BOARD.pocketY - 4, `+${BOARD.hesoPrize}`, "#7dd3fc"); // ヘソの上に+2
    // 天井：この回転でカウンタが台の天井に達するなら強制初当たり（救済）。初当たり率は設定差で補正。
    const next = spinsRef.current + 1;
    spinsRef.current = next;
    setSpins(next);
    const result = spinReels("normal", Math.random, next >= ceilingRef.current, winMultRef.current);
    if (reelsRef.current?.busy()) {
      if (holdsRef.current.length >= HOLD_MAX) return; // 保留満タンは入賞のみ（変動せず）
      const hold: Hold = { result, color: HOLD_COLORS[holdColorFor(result)] };
      holdsRef.current = [...holdsRef.current, hold];
      setHolds(holdsRef.current);
    } else {
      doSpinWith(result);
    }
  });

  // 連チャン(ボーナス)中だけ「潮騒アイドル」BGMを流す（同Idol曲の海リカラー）。
  useEffect(() => {
    if (mode !== "complete") return;
    initAudio();
    setBgmTheme("seaIdol");
    startBgm(); // muted 時は内部で no-op
    return () => stopBgm();
  }, [mode]);

  // ===== 発射 =====
  // 当たり中は右打ち＝発射無料＝必ず純増（オート専用）。通常時のみ有料。
  const launch = useCallbackRef(() => {
    const free = modeRef.current === "complete";
    if (!free && useGameStore.getState().coins < BOARD.startCost) return;
    initAudio();
    const ok = boardRef.current?.launch();
    if (ok) {
      if (!free) addCoins(-BOARD.startCost);
      slotSfx("lever");
    }
  });

  // オート発射。当たり中(右打ち)は速めに常時自動発射＝大入賞口へ出玉を浴びせる。
  useEffect(() => {
    if (!auto && mode !== "complete") return;
    const interval = mode === "complete" ? 160 : PACHINKO_CONFIG.launchIntervalMs;
    const id = setInterval(() => {
      // 盤上の玉が多いときは発射を見送る。発射は実時間・物理はフレーム駆動なので、
      // FPSが落ちると発射が排出を追い越して玉が溜まり続け重くなる（暴走）。稼働数で
      // 絞ることでフレーム実態に追従させ、右打ち中の玉が増え続けるのを防ぐ。
      if ((boardRef.current?.activeCount() ?? 0) >= PACHINKO_CONFIG.autoMaxInflight) return;
      launch();
    }, interval);
    return () => clearInterval(id);
  }, [auto, mode, launch]);

  const complete = mode === "complete";
  const nearCeiling = spins >= ceiling - 50;
  const statusLabel = complete
    ? rush
      ? `RUSH ${rush.ren}連`
      : "大当たり！"
    : `${spins}回転`;

  return (
    <main className="flex min-h-dvh flex-col gap-2 p-3">
      {flash && (
        <div
          className="pointer-events-none fixed inset-0 z-40 animate-pulse"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(255,0,0,.18), rgba(255,200,0,.18), rgba(0,255,128,.18), rgba(0,160,255,.18), rgba(180,0,255,.18), rgba(255,0,0,.18))",
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <Link href="/casino" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← カジノ
        </Link>
        <span className="flex items-center gap-1 text-sm font-black tracking-wide text-amber-200">
          🎲 甘ダイス
          {casinoEvent().pachinko && <EventBadge />}
        </span>
        <span
          className={`text-xs font-bold ${
            complete ? "animate-pulse text-amber-300" : nearCeiling ? "animate-pulse text-rose-300" : "text-cyan-200"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* 所持コイン ＋ 保留ランプ */}
      <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-black/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">保留</span>
          <div className="flex gap-1">
            {Array.from({ length: HOLD_MAX }, (_, i) => {
              const h = holds[i];
              return (
                <span
                  key={i}
                  className="h-2.5 w-2.5 rounded-full transition-colors"
                  style={{
                    background: h ? h.color : "rgba(255,255,255,.15)",
                    boxShadow: h && h.color !== HOLD_COLORS.white ? `0 0 5px ${h.color}` : "none",
                  }}
                />
              );
            })}
          </div>
        </div>
        <span className="text-lg font-black text-amber-300">🎲 コイン {fmt(coins)}</span>
      </div>

      {/* 台選択（4台・設定は隠し・6時間ごとにシャッフル＝看破の沼）。当たり中は移動不可。 */}
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[10px] text-gray-400">台</span>
        {Array.from({ length: MACHINE_COUNT }, (_, i) => (
          <button
            key={i}
            disabled={complete}
            onClick={() => sitMachine(i)}
            className={`flex flex-1 flex-col items-center justify-center rounded-lg py-1 text-xs font-bold leading-none active:scale-95 disabled:opacity-40 ${
              i === machine ? "bg-amber-500 text-black" : "bg-white/10 text-gray-300"
            }`}
          >
            台{i + 1}
            {tips[i] != null && (
              <span className={`mt-0.5 text-[9px] ${i === machine ? "text-black/70" : "text-cyan-300"}`}>
                設定{tips[i]}
              </span>
            )}
          </button>
        ))}
        <span className="shrink-0 text-[9px] leading-tight text-gray-500">設定・天井
          <br />は隠し
        </span>
      </div>

      {/* 盤面が中央モニターを囲む“ひとつの台”。役物の窪みに図柄オーバーレイを重ねる。 */}
      <div className="relative w-full">
        <PachinkoBoard ref={boardRef} onPocket={onPocket} onAttacker={onAttacker} reduced={reduced} denchu={complete} />

        {/* 獲得枚数の“その場表示”：ヘソ/大入賞の上に +N がふわっと浮く。 */}
        {floats.map((p) => (
          <span
            key={p.id}
            className="coin-float z-30 text-sm"
            style={{ left: `${p.x}%`, top: `${p.y}%`, color: p.color }}
          >
            {p.text}
          </span>
        ))}
        <div
          className="absolute"
          style={{
            left: `${(BOARD.monitorX / BOARD.width) * 100}%`,
            top: `${(BOARD.monitorY / BOARD.height) * 100}%`,
            width: `${(BOARD.monitorW / BOARD.width) * 100}%`,
            height: `${(BOARD.monitorH / BOARD.height) * 100}%`,
          }}
        >
          <PachinkoReels ref={reelsRef} effects={effects} reduced={reduced} />
        </div>

        {/* 当たり停止演出（“何が起きたか”を見せる0.5〜1秒） */}
        {reveal && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20 text-center">
            <span
              className="animate-pulse rounded-xl border-2 px-4 py-1 text-lg font-black"
              style={{ borderColor: reveal, color: reveal, background: "rgba(0,0,0,.55)" }}
            >
              🎯 大当たり！
            </span>
          </div>
        )}

        {/* RUSH(ボーナス)バナー：連チャン数・保証枚数・残りG（役物直下） */}
        {rush && (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 text-center"
            style={{ top: `${((BOARD.monitorY + BOARD.monitorH + 2) / BOARD.height) * 100}%` }}
          >
            <span className="rounded-full bg-amber-300 px-3 py-0.5 text-xs font-black text-black">
              🔥RUSH {rush.ren}連　{rush.coins}枚保証　残り{rush.gamesLeft}G
            </span>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-cyan-300/70">
        玉がヘソ(中央)に入ると変動＆賞球+{BOARD.hesoPrize}！ 当たると右打ちで大入賞口に入った玉が出玉に。
      </p>

      <div className="rounded-xl border border-amber-400/20 bg-black/40">
        <PayoutParticles ref={particlesRef} reduced={reduced} />
      </div>

      {/* 当たり中はオート専用＝ボタンを操作不可にして“見てるだけで増える”に。 */}
      <button
        onClick={() => launch()}
        disabled={complete || coins < BOARD.startCost}
        className={`h-14 rounded-2xl text-lg font-extrabold text-black active:scale-95 disabled:active:scale-100 ${
          complete ? "animate-pulse bg-amber-300 opacity-90" : "bg-amber-500 disabled:opacity-40"
        }`}
      >
        {complete ? "🔥 当たり中（オート右打ち・発射無料）" : `● 発射（左打ち / コイン -${BOARD.startCost}）`}
      </button>
      {!complete && coins < BOARD.startCost && (
        <p className="text-center text-[11px] text-rose-300">
          コインが足りません。<Link href="/casino" className="underline">カジノ</Link>でゴールドからコインを用意してね（1コイン=1玉）。
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Toggle label="オート発射" on={auto} onClick={() => setAuto((v) => !v)} />
        <Toggle
          label="サウンド"
          on={sound}
          onClick={() => {
            initAudio();
            const next = !sound;
            setMuted(!next);
            setSound(next);
          }}
        />
        <Toggle label="軽量モード" on={reduced} onClick={() => setReduced((v) => !v)} />
        <Toggle label="演出" on={effects} onClick={() => setEffects((v) => !v)} />
      </div>

      <p className="pb-2 text-center text-[10px] text-gray-500">
        通常時は左打ち（ヘソINで図柄変動＆賞球+{BOARD.hesoPrize}で玉持ちUP）。当たると保証枚数(100〜400)×保証G(10/16)の
        RUSHへ＝右打ち・発射無料で大入賞口に出玉。継続でループ（10G≈78%/16G≈88%・平均≈5連）。
        ハマっても救済の強制初当たりあり（条件＝天井は秘密）。4台から座って設定を見極めよう。
      </p>
    </main>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-10 rounded-xl font-bold active:scale-95 ${
        on ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-300"
      }`}
    >
      {label}: {on ? "ON" : "OFF"}
    </button>
  );
}
