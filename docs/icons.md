# 手続き生成ピクセルアイコン

実装: `src/lib/itemIcon.ts`（生成＋キャッシュ）、`src/components/ItemIcon.tsx`、
`src/components/EnemyIcon.tsx`

**画像ファイルは一切持たない**（png/jpg/webp 不使用、`public/items` 不要）。装備・敵・ボスの
アイコンはすべて **16×16 のドット絵をプログラムで生成**し、Nearest-Neighbor で拡大表示する。
目的は容量削減・無限装備への対応・Modifier/Set の視認性・Dice Ex Machina 独自の雰囲気。

## 生成方式

- 16×16 のグリッドに描画 → `<canvas>` で PNG 化 → base64 data URL。
- `image-rendering: pixelated` で 4倍前後に拡大し、ドット感を維持。
- 乱数は seed から決定論的（mulberry32）。**同じ seed ⇒ 同じアイコン**。
- 同一 spec のアイコンは `Map<string,string>` に base64 をキャッシュして再生成しない。
- SSR では `document` が無いため空文字を返し、クライアントの `useEffect` で生成（描画ミスマッチ回避）。

## 装備（ItemIcon）

seed は装備IDから導出（`hashSeed(id:affix)`）。スロット→形状ファミリ:

- 武器: 剣 / 斧 / 槍 / 杖 / 短剣 / 鎌（seedで決定）
- 防具(兜/鎧/篭手/靴): 軽鎧 / 重鎧 / ローブ / プレート / マント
- 装飾: 指輪 / ペンダント / オーブ / 本 / 羽根

レアリティ色: Common灰 / Rare青 / Epic紫 / Legendary金 / Mythic赤 / Unique白＋虹色発光
（Legendary・Unique は CSS `.legendary-glow` で発光）。

Modifier（★）は段階で装飾を追加: ★宝石 / ★★鍔 / ★★★羽 / ★★★★光輪 / ★★★★★魔法陣。
Set 装備は背景に紋章（賭博師=サイコロ / 吸血鬼=赤い月 / 神託=目 / 処刑人=十字 / 手続きセット=ルーン）。

## 神機マキナ（Unique 専用）

通常生成を行わず専用ジェネレータ。中央に「歯車」と「ダイス」を融合した形、黒＋金、虹色発光。
Modifier/Ancient/Mythic なし。

## 敵・ボス（EnemyIcon）

seed は `templateId` から。形状: blob / beast / biped / winged / skull / serpent。
クリーチャー配色を seed で選択。**ボスは王冠**、**★付き（強化敵）はオーラ**を追加。

## UIグリフ（絵文字の置き換え）

絵文字を使わず、UIの記号も同じピクセルアートで描く（`getGlyphIconDataUrl(kind)` /
`PixelGlyph`）。対応グリフ: attack/defense/hp/dice/gold/material/soul/drop/fire/poison/stun/
weaken/heal/shop/casino/codex/lock/unlock/ghost/ranking/home/help/crown/star/bag/rainbow。

プレイヤーバー・敵カード・行動ボタン・リザルト・ショップ・ガチャ・装備画面・インベントリ・
タイトル導線・図鑑・アーティファクト等のUI記号をこれに置換済み。
（戦闘ログ文中の絵文字・カジノのゲーム牌・職業/消費アイテムのデータ用アイコンは別アイコン体系のため対象外。）

## 背景（手続き生成・高品質）

`getWorldBackground(world)`（`data/worlds.ts`）が**画像なし**で章ごとの高品質背景を合成:
テーマSVGテクスチャ（草・鍾乳石・石壁・雪・残り火・星座・回路など）＋大気グラデ（上方アクセント光・
下方ホライズン光）＋エッジヴィネット＋基底グラデ。戦闘画面・ショップに適用。

## 表示サイズ

- インベントリ一覧: 32px
- 装備画面: 48px
- 詳細画面 / ドロップ / ガチャ結果: 64px（ドロップは48px）
- 戦闘の敵: 56px / 図鑑の敵: 40px
