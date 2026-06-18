"use client";

import Link from "next/link";

/**
 * リリースノート（更新履歴）。Gitの歩みを、ちょっとおちゃめに翻訳したもの。
 * 新しい更新は配列の先頭に足していく。tag は遊びの版名、real が中身。
 */
interface Note {
  date: string;
  tag: string;
  emoji: string;
  title: string;
  items: string[];
}

const NOTES: Note[] = [
  {
    date: "2026-06-19",
    tag: "v∞.94「沼の大掃除」",
    emoji: "🧹",
    title: "カジノ、ぐるぐる事件を解決",
    items: [
      "交換所で発生していた無限ループ（ぐるぐる回って戻ってこないやつ）を根絶やしに。",
      "「交換所に入れない！」も成仏。コインが無くても中は覗けます。冷やかし歓迎。",
      "ついでに交換所まわりのコードを軽量化。動作もスマートに。",
    ],
  },
  {
    date: "2026-06-19",
    tag: "v∞.92「ダイエット成功」",
    emoji: "🪶",
    title: "高層階でもサクサク",
    items: [
      "深層でのカクつき・メモリ圧をまとめて軽量化。長時間プレイでも息切れしません。",
      "1日1回そっとメモリを解放。気づかないうちに元気になってます。",
    ],
  },
  {
    date: "2026-06-18",
    tag: "v∞.90「火力盛り盛り」",
    emoji: "💪",
    title: "バランス大改修",
    items: [
      "全体的に上方修正。死蔵されてたビルドにも日の目を。",
      "神機マキナ、さらに頼れる相棒に。",
    ],
  },
  {
    date: "2026-06-18",
    tag: "v∞.87「ラスボス降臨」",
    emoji: "👑",
    title: "1000階に、いよいよ終着点",
    items: [
      "固定ラスボス「機神デウス＝エクス＝マキナ」が君臨。ダイス×機械神の超ド派手ボス。",
      "専用BGMはゲーム内で一番アガる一曲。鳴らした瞬間に正座してほしい。",
      "1000階直前にセーブポイント。負けても何度でも挑める優しさ。",
      "行動パターンはJRPGのラスボス風に。固有技だけで勝負します（パクリ無し、誓って）。",
    ],
  },
  {
    date: "2026-06-18",
    tag: "v∞.86「作曲家、徹夜」",
    emoji: "🎧",
    title: "ラスボス曲、こだわりの果て",
    items: [
      "EDM風の段階ビルド、小室進行、助走イントロ、静寂からの再構築……",
      "「もうちょい長く」「ここで静かに」を何往復もして磨いた、執念の一曲。",
    ],
  },
  {
    date: "2026-06-18",
    tag: "v∞.85「鑑賞タイム」",
    emoji: "🎵",
    title: "図鑑にジュークボックス",
    items: [
      "各階層・施設のBGMを聴き放題。お気に入りをループで流して作業用BGMにどうぞ。",
      "クレジット曲「スタッフロール 〜光へ走る〜」も収録。",
    ],
  },
  {
    date: "2026-06-18",
    tag: "v∞.84「整形手術」",
    emoji: "🎨",
    title: "敵のドット絵を全面リニューアル",
    items: [
      "「想像してた姿と違う…」を解消。正体に合わせて全部描き直しました。",
    ],
  },
  {
    date: "2026-06-18",
    tag: "v∞.80「わんちゃん帯」",
    emoji: "🎰",
    title: "リーチに“ヒリつき”を追加",
    items: [
      "11%→100%の崖を撤廃。「来るか…!?」のドキドキ帯（約57%）を新設。",
      "確定じゃないカットインで、心臓に悪い演出が楽しめます。",
    ],
  },
  {
    date: "2026-06-17",
    tag: "v∞.7「カジノ、本格開店」",
    emoji: "🃏",
    title: "気づいたら沼にいる施設",
    items: [
      "4号機風スロット、約100G続くダイスラッシュ(AT)、コイン交換所、運命の大博打を実装。",
      "台パン・出禁・ハマり表示まで完備。リアルすぎて怒られそう。",
      "BIG中はアイドルポップ、通常は煌びやかな専用BGMでお出迎え。",
    ],
  },
  {
    date: "2026-06-16",
    tag: "v∞.6「ドット絵の世界」",
    emoji: "🖼️",
    title: "見た目と耳が一気にリッチに",
    items: [
      "UIの絵文字を手描きピクセルグリフ化。画像アセットは一切不使用の意地。",
      "ダンジョン/ボス/鍛冶のBGMを多層構成でゴージャスに。",
      "鍛冶屋・難易度カーブ・上位職など中身も大量追加。",
    ],
  },
  {
    date: "2026-06-15",
    tag: "v∞.5「無限化」",
    emoji: "♾️",
    title: "終わりなき成長",
    items: [
      "装備もセットも手続き生成で無限スケール。コレクションは永遠に完成しません。",
      "ユニーク武器＋セット×職業シナジーでビルドに深み。",
      "オンラインランキングと残響戦（ゴーストと戦う試し場）も登場。",
    ],
  },
  {
    date: "2026-06-14",
    tag: "v∞.1「土台づくり」",
    emoji: "🧱",
    title: "ゲームの骨格が固まる",
    items: [
      "セーブポイント、転職、状態異常（毒/麻痺）、ボス6種を実装。",
      "戦闘UIを下部固定＋利き手設定で、片手でサクサク遊べるように。",
    ],
  },
  {
    date: "—",
    tag: "v0「最初の一振り」",
    emoji: "🎲",
    title: "すべてはここから",
    items: [
      "「装備でダイスの出目が書き換わる」というたった一つのひらめきから、この旅は始まりました。",
    ],
  },
];

export default function NewsPage() {
  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
        <h1 className="font-bold">📜 リリースノート</h1>
        <p className="mt-1 text-xs text-gray-300">
          このゲームが歩んできた道のり。<br />
          <span className="text-amber-300">バグも仕様も、ぜんぶ思い出。</span>
        </p>
      </div>

      <div className="space-y-2">
        {NOTES.map((n, i) => (
          <section
            key={`${n.tag}-${i}`}
            className="rounded-xl border border-white/10 bg-black/20 p-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{n.emoji}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-100">{n.title}</p>
                <p className="text-[10px] text-gray-500">
                  {n.tag} ・ {n.date}
                </p>
              </div>
            </div>
            <ul className="mt-2 space-y-1">
              {n.items.map((it, j) => (
                <li key={j} className="flex gap-1.5 text-xs text-gray-300">
                  <span className="text-amber-400">✦</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="py-2 text-center text-[10px] text-gray-600">
        まだまだ転がり続けます。次のアプデもお楽しみに。🎲
      </p>

      <Link
        href="/battle"
        className="mb-2 h-14 rounded-2xl bg-emerald-600 pt-4 text-center text-lg font-bold text-white active:scale-95"
      >
        冒険に戻る →
      </Link>
    </main>
  );
}
