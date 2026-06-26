"use client";

import Link from "next/link";

// お問い合わせ先。変更する場合はここを書き換える。
const CONTACT_EMAIL = "youki2227@gmail.com";

const FAQ = [
  {
    q: "セーブデータはどこに保存されますか？",
    a: "お使いの端末内（ローカルストレージ）に保存されます。アプリの削除やデータ消去を行うと失われるためご注意ください。",
  },
  {
    q: "ランキングに名前が登録できません。",
    a: "プレイヤー名はオンラインで重複できません。「既に使われています」と出る場合は別の名前をお試しください。通信環境によっては送信に失敗することもあります。",
  },
  {
    q: "課金はありますか？",
    a: "アプリ内課金はありません。すべての要素が無料で遊べます。",
  },
  {
    q: "不具合を見つけました。",
    a: "お手数ですが、発生した状況（どの画面・どの操作で起きたか）を添えて下記までご連絡ください。",
  },
];

export default function SupportPage() {
  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
        <h1 className="font-bold">🛟 サポート</h1>
        <p className="mt-1 text-[11px] text-gray-400">「ダイスエクスマキナ」お問い合わせ・よくある質問</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center text-xs text-gray-300">
        <p>ご質問・不具合報告はこちらまで：</p>
        <p className="mt-1">
          📧 <a className="text-sky-300 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-300">よくある質問</h2>
        {FAQ.map((item) => (
          <div key={item.q} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
            <p className="font-bold text-gray-200">Q. {item.q}</p>
            <p className="mt-1 text-gray-400">A. {item.a}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
