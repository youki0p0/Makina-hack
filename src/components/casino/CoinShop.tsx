"use client";

import { useMemo, useState } from "react";
import {
  SET_WEAPON_COIN,
  SIGNATURE_WEAPON_COIN,
  SOULS_COIN,
  SETTING_TIP_COIN,
  MACHINE_COUNT,
  settingBucket,
  effectiveSlotSettings,
  effectivePachiSettings,
} from "@/lib/casino";
import { SET_DEFS, getSetDef, availableSetKeys } from "@/data/sets";
import { slotSfx } from "@/lib/audio";
import PixelGlyph from "@/components/PixelGlyph";
import { fmt } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";

export default function CoinShop() {
  const coins = useGameStore((s) => s.coins);
  const souls = useGameStore((s) => s.souls);
  const addCoins = useGameStore((s) => s.addCoins);
  const buyWeapon = useGameStore((s) => s.coinBuySetWeapon);
  const buySignature = useGameStore((s) => s.coinBuySignatureWeapon);
  const buySouls = useGameStore((s) => s.coinBuySouls);

  // 怪しいおじさん: 2000コインで「スロット4台＋甘ダイス4台＝計8台」からランダムに1台の設定を
  // “こっそり”教える。暴いた設定は localStorage(当該バケット)に貯まり、各台ボタンに表示される。
  const buyTip = () => {
    if (coins < SETTING_TIP_COIN) return;
    addCoins(-SETTING_TIP_COIN);
    const bucket = settingBucket();
    const pick = Math.floor(Math.random() * (MACHINE_COUNT * 2)); // 0..7
    const isSlot = pick < MACHINE_COUNT;
    const m = pick % MACHINE_COUNT;
    // 看破はイベント上書き後の“実効設定”を暴く（実際に効いている値と一致させる）。
    const s = (isSlot ? effectiveSlotSettings(bucket) : effectivePachiSettings(bucket))[m];
    try {
      let store: { bucket: number; slot: Record<number, number>; pachi: Record<number, number> } = {
        bucket,
        slot: {},
        pachi: {},
      };
      const raw = window.localStorage.getItem("casinoTips");
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.bucket === bucket) store = { bucket, slot: p.slot ?? {}, pachi: p.pachi ?? {} };
      }
      (isSlot ? store.slot : store.pachi)[m] = s;
      window.localStorage.setItem("casinoTips", JSON.stringify(store));
      window.dispatchEvent(new Event("casinoTips"));
    } catch {
      /* localStorage 不可でも会話は成立させる */
    }
    slotSfx("small");
    setMsg(`🕵️ おじさん「${isSlot ? "スロット" : "甘ダイス"}の台${m + 1}は…たぶん設定${s}だよ。たぶんね」`);
    setTimeout(() => setMsg(null), 4500);
  };

  // 固有セット（常設）＋ 到達済みの「生成セット（深層）」も交換できるように
  // （欲しい深層セットが買えない不満の解消）。生成セットは highestFloorReached で解放。
  const highest = useGameStore((s) => s.progress.highestFloorReached);
  const namedKeys = useMemo(() => SET_DEFS.filter((s) => !s.kingOnly).map((s) => s.key), []);
  const procKeys = useMemo(
    () => availableSetKeys(highest).filter((k) => k.startsWith("gset")),
    [highest],
  );
  const [sel, setSel] = useState(namedKeys[0] ?? "gambler");
  const [msg, setMsg] = useState<string | null>(null);

  const canWeapon = coins >= SET_WEAPON_COIN;
  const canSignature = coins >= SIGNATURE_WEAPON_COIN;
  const canSoul = coins >= SOULS_COIN;

  const doWeapon = () => {
    const w = buyWeapon(sel);
    if (w) {
      setMsg(`🎁 ${w.name} を交換！`);
      setTimeout(() => setMsg(null), 2500);
    }
  };
  const doSignature = () => {
    const w = buySignature();
    if (w) {
      setMsg(`🌟 固有武器「${w.name}」を交換！`);
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

      {/* Set gear exchange (random slot) */}
      <div className="rounded-2xl border border-fuchsia-500/40 bg-fuchsia-500/5 p-3">
        <p className="flex items-center gap-1 text-sm font-bold text-fuchsia-200">
          <PixelGlyph kind="drop" size={14} /> セット装備と交換（ランダム部位）
        </p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          所持装備に見合うティアのセット装備を入手（武器・防具・アクセからランダム＝セット完成を狙える）。深層で出会った生成セットも選べる。
        </p>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          className="mt-2 h-9 w-full rounded-lg bg-black/40 px-2 text-xs text-gray-100"
        >
          <optgroup label="固有セット">
            {namedKeys.map((k) => (
              <option key={k} value={k}>
                {getSetDef(k)?.name ?? k} セット
              </option>
            ))}
          </optgroup>
          {procKeys.length > 0 && (
            <optgroup label="生成セット（深層で解放）">
              {procKeys.map((k) => (
                <option key={k} value={k}>
                  {getSetDef(k)?.name ?? k} セット
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          onClick={doWeapon}
          disabled={!canWeapon}
          className="mt-2 h-12 w-full rounded-xl bg-fuchsia-600 text-sm font-extrabold text-white active:scale-95 disabled:opacity-40"
        >
          交換（🪙{fmt(SET_WEAPON_COIN)}）
        </button>
      </div>

      {/* 固有(signature)武器 exchange — ランダム1種 */}
      <div className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-3">
        <p className="flex items-center gap-1 text-sm font-bold text-amber-200">
          <PixelGlyph kind="drop" size={14} /> 固有武器と交換
        </p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          ダイス目を書き換える固有(銘入り)武器をランダムに1つ入手。
        </p>
        <button
          onClick={doSignature}
          disabled={!canSignature}
          className="mt-2 h-12 w-full rounded-xl bg-amber-500 text-sm font-extrabold text-black active:scale-95 disabled:opacity-40"
        >
          交換（🪙{fmt(SIGNATURE_WEAPON_COIN)}）
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

      {/* 怪しいおじさん（設定看破の裏ルート） */}
      <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-3">
        <p className="flex items-center gap-1 text-sm font-bold text-cyan-200">🕵️ 設定を聞く（おじさん）</p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          スロット＆甘ダイスの計8台から、ランダムで1台の隠し設定をこっそり教えてもらう（当たり台ボタンに表示）。
        </p>
        <button
          onClick={buyTip}
          disabled={coins < SETTING_TIP_COIN}
          className="mt-2 h-12 w-full rounded-xl bg-cyan-600 text-sm font-extrabold text-white active:scale-95 disabled:opacity-40"
        >
          聞く（🪙{fmt(SETTING_TIP_COIN)}）
        </button>
      </div>

      <p className="text-center text-[10px] text-gray-500">
        カジノコインはスロットで稼ぐ。超高額なので一攫千金（ダイスラッシュ）が近道。
      </p>
    </div>
  );
}

