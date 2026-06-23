"use client";

/** 遊び方オーバーレイ。初回は自動表示し、以降は「遊び方」ボタンから開く。 */
export default function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <div className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/15 bg-[#14121d] p-4">
        <div className="text-center">
          <div className="text-3xl">🜨</div>
          <h2 className="mt-1 text-lg font-extrabold">アリーナ・オブ・ダイス</h2>
          <p className="text-[11px] text-gray-400">カードセット構築型 3v3 オートバトラー</p>
        </div>

        <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-gray-200">
          <Section emoji="🎯" title="勝ち方">
            ラウンドに勝ち続け、モード規定の勝利数（ショート10/ロング15）に到達すれば優勝。
            負けるとライフが減り、0で敗退。
          </Section>
          <Section emoji="🃏" title="準備フェーズが本体">
            毎ラウンド配られるカードから選び、<b>3体のモンスターに割り当てる</b>のが核心。
            技を<b className="text-amber-300">1体に集中</b>（高火力・脆い）させるか、
            <b className="text-emerald-300">3体に分散</b>（安定）させるかが悩みどころ。
          </Section>
          <Section emoji="🌋" title="フィールドが技を書き換える">
            フィールドは数値補正ではなく<b>技の効果そのもの</b>を変える。
            例：火炎斬りが火山で「噴火斬り（範囲）」、雨で「蒸気斬り（暗闇）」、森で「延焼斬り（毒）」に変化。
          </Section>
          <Section emoji="✦" title="シナジーを狙う">
            色（緑/青/赤）を揃える・技タグを重ねる・集中/分散で<b>シナジー</b>が点灯。
            左の「カードセット」で発動中シナジーを確認できる。
          </Section>
          <Section emoji="🧑‍🚀" title="オペレーター（あなたの分身）">
            戦闘には出ないが、固有パッシブで編成・フィールド適性・技変質を補強する。
          </Section>
          <Section emoji="👑" title="ボス戦">
            5の倍数ラウンドはボス戦。中央に強大な敵が出現。育てたビルドの真価が問われる。
          </Section>
          <Section emoji="🤖" title="戦闘は全自動">
            「準備完了！！」を押したら干渉不可。正面狙い・低HP狙い・範囲・挑発・撃破後の再ターゲットを自動で処理。観戦あるのみ！
          </Section>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-emerald-600 py-3 text-base font-extrabold text-white active:scale-95"
        >
          わかった！ 始める
        </button>
      </div>
    </div>
  );
}

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
      <div className="font-bold text-gray-100">
        {emoji} {title}
      </div>
      <div className="mt-0.5 text-[11px] text-gray-300">{children}</div>
    </div>
  );
}
