"use client";

import Link from "next/link";

// お問い合わせ先。変更する場合はここを書き換える。
const CONTACT_EMAIL = "youki2227@gmail.com";
const UPDATED = "2026-06-26";

export default function PrivacyPage() {
  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
        <h1 className="font-bold">🔒 プライバシーポリシー</h1>
        <p className="mt-1 text-[11px] text-gray-400">最終更新日: {UPDATED}</p>
      </div>

      <section className="space-y-3 text-xs leading-relaxed text-gray-300">
        <p>
          「ダイスエクスマキナ」（以下「本アプリ」）は、プレイヤーのプライバシーを尊重します。
          本ポリシーは、本アプリが扱う情報とその取り扱いについて説明します。
        </p>

        <div>
          <h2 className="mb-1 text-sm font-bold text-gray-200">収集・送信する情報</h2>
          <p>
            本アプリは、アカウント登録を必要とせず、氏名・メールアドレス・電話番号・位置情報などの
            個人を特定する情報を収集しません。オンライン機能（ランキング・残響）を利用した場合に限り、
            以下の情報がサーバーに送信されます。
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>プレイヤー名（任意入力。未入力時は「Guest」）</li>
            <li>ゲーム成績（到達階・職業・難易度・装備名・プレイ時間などのゲーム内データ）</li>
            <li>端末ごとに生成されるランダムな識別トークン（プレイヤー名の所有確認のためのみに使用）</li>
          </ul>
          <p className="mt-1">
            これらは本アプリのランキング表示・オンライン機能のためにのみ利用され、
            広告・マーケティング・個人の追跡（トラッキング）には使用しません。
          </p>
        </div>

        <div>
          <h2 className="mb-1 text-sm font-bold text-gray-200">端末内に保存する情報</h2>
          <p>
            ゲームの進行状況（所持装備のIDや設定など）は、お使いの端末のローカルストレージに保存され、
            外部に送信されません。アプリの削除やデータ消去で失われます。
          </p>
        </div>

        <div>
          <h2 className="mb-1 text-sm font-bold text-gray-200">第三者サービス</h2>
          <p>
            ランキング等のデータ保存に Supabase を利用しています。広告SDK・アクセス解析SDKは
            一切使用していません。アプリ内課金もありません。
          </p>
        </div>

        <div>
          <h2 className="mb-1 text-sm font-bold text-gray-200">データの削除・お問い合わせ</h2>
          <p>
            ランキングに送信した名前・成績の削除をご希望の場合や、本ポリシーに関するご質問は、
            下記までご連絡ください。
          </p>
          <p className="mt-1">
            📧 <a className="text-sky-300 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>

        <div>
          <h2 className="mb-1 text-sm font-bold text-gray-200">改定</h2>
          <p>
            本ポリシーは、必要に応じて改定されることがあります。重要な変更がある場合は本ページで告知します。
          </p>
        </div>
      </section>
    </main>
  );
}
