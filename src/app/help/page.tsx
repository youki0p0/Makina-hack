"use client";

import Link from "next/link";
import GlyphText from "@/components/GlyphText";
import { baseDiceFaces, diceKindIcon } from "@/data/diceFaces";

const PIPS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

const STATUS_HELP = [
  { icon: "☠️", name: "毒 / 🔥燃焼", desc: "毎ターン継続ダメージ（防御無視）。累積する。" },
  { icon: "⚡", name: "スタン", desc: "敵が数ターン行動できない。" },
  { icon: "🔻", name: "弱体化", desc: "敵の攻撃力を数ターン下げる。" },
];

const SYSTEMS = [
  { icon: "🎲", name: "ダイス＆装備", desc: "装備が各出目の効果を書き換える。これが攻略の核。" },
  { icon: "🌍", name: "ワールド", desc: "100階ごとに世界が変わる。1000階の先はEndless Abyss。" },
  { icon: "⚔️", name: "転職", desc: "倒れた後だけ職業を変更できる。ダイスと戦い方が変わる。" },
  { icon: "⭐", name: "★モディファイア", desc: "50階ごとに装備・敵に★が付き無限に強化。完成はない。" },
  { icon: "🏪", name: "ショップ階", desc: "4階ごとにゴールドで装備/消費を購入。" },
  { icon: "🎰", name: "カジノ", desc: "カジノコインでスロット/BJ/甘ダイス。JPで限定景品。" },
  { icon: "🔮", name: "転生ポイント", desc: "最高到達階の更新でのみ魂を獲得し永久強化。" },
  { icon: "💾", name: "セーブポイント", desc: "50階ごとに到達で記録。敗北は直後の階から再開。" },
  { icon: "📚", name: "実績/図鑑", desc: "階層実績で素材/転生P。図鑑で収集率を確認。" },
];

export default function HelpPage() {
  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
        <h1 className="font-bold">❓ 遊び方</h1>
        <p className="mt-1 text-xs text-gray-300">
          ターンごとにダイスが振られる。<br />
          <span className="text-sky-300 font-bold">リロール</span> で振り直し、
          <span className="text-emerald-300 font-bold">決定</span> で今の出目の効果を発動。
        </p>
      </div>

      <section>
        <h2 className="mb-1 text-sm font-bold text-gray-300">基本のダイス表</h2>
        <div className="space-y-1">
          {baseDiceFaces.map((f) => (
            <div key={f.value} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
              <span className="text-lg">{PIPS[f.value]}</span>
              <span className="w-20 font-bold">{diceKindIcon[f.effect.kind]} {f.name}</span>
              <span className="text-gray-400">{f.description}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-amber-300">✦ 装備・職業でこの効果が書き換わる。</p>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold text-gray-300">状態異常</h2>
        <div className="space-y-1">
          {STATUS_HELP.map((s) => (
            <div key={s.name} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
              <span className="text-lg"><GlyphText text={s.icon} size={18} /></span>
              <span className="w-24 font-bold">{s.name}</span>
              <span className="text-gray-400">{s.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold text-gray-300">システム</h2>
        <div className="space-y-1">
          {SYSTEMS.map((s) => (
            <div key={s.name} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
              <span className="text-lg"><GlyphText text={s.icon} size={18} /></span>
              <span className="w-40 font-bold">{s.name}</span>
              <span className="text-gray-400">{s.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <Link
        href="/battle"
        className="mt-2 h-14 rounded-2xl bg-emerald-600 pt-4 text-center text-lg font-bold text-white active:scale-95"
      >
        さっそく遊ぶ →
      </Link>
    </main>
  );
}
