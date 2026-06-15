# 装備・レアリティ・品質・ガチャ

実装: `src/data/items.ts`, `src/data/quality.ts`, `src/data/affixes.ts`, `src/data/modifiers.ts`,
`src/lib/loot.ts`, `src/lib/ui.ts`

## 装備スロット（6部位）

`EQUIP_SLOTS`（`src/lib/battle.ts`）:

| slot | 表示 |
| --- | --- |
| weapon | 武器 |
| helm | 兜 |
| armor | 鎧 |
| gloves | 篭手 |
| boots | 靴 |
| accessory | 装飾 |

6スロットあることで **6部位セット** が成立する。装飾以外は職業の装備種別（軽/重/魔）制限を受ける。

## レアリティと視認性

`✦` ピップで一目で分かる（モディファイアとは別表示）:

| レアリティ | 表示 |
| --- | --- |
| Common | ✦ |
| Rare | ✦✦ |
| Epic | ✦✦✦ |
| Legendary | 🌈✦✦✦✦（虹色にゆっくり発光） |
| Cursed | ✦✦（赤） |

Legendary のみ虹色グロー（`.legendary-glow` / `globals.css`）。★モディファイアは名前に付与され、
レアリティ表示とは独立。

## 品質（Ancient / Mythic / Unique）

`src/data/quality.ts`。Legendary のみ品質に昇格しうる。

| 品質 | 倍率 | 出現 | 名前 |
| --- | --- | --- | --- |
| Ancient（古代） | ×1.3 | Legendaryの約12% | 「古代の」＋名 |
| Mythic（神話） | ×1.6 | Legendaryの約1% | 「神話の」＋名 |
| Unique（唯一） | — | 神機マキナのみ | 固有名 |

`rollQuality(item)` がドロップ時に判定、`applyQuality` がステ倍率と接頭辞を適用。

## 接尾辞（affix）

ドロップ/ガチャ装備に40%（volatileは90%）で接尾辞が付く（鋭利な/頑強な/生命の/幸運の/業物の…）。
`src/data/affixes.ts`。

## ガチャ（最低保証 / 上限）

`src/lib/loot.ts`。「10連大量回しが最適」問題を解消する設計:

| コスト | 内容 |
| --- | --- |
| 10 | コモン量産（レア以上は出ない） |
| 100 | 高補正コモン（接尾辞＋★保証、ただしレア以上なし） |
| 250 | **部位指定・レア以上保証**（レア未満は出ない） |

- ガチャの★モディファイアは **最高到達階で上限**（`modTierForFloor(highestFloorReached)`）。
  未来の階層の装備は引けない。
- カジノ専用・ガチャ専用・唯一(unique)装備はドロップ/通常プールから除外。

## 生成装備

`buildGenerated()` がティア1〜61 × 6スロットを自動生成（`minFloor` で階層ゲート）。
ティアでレアリティ決定（〜15 Common / 〜30 Rare / 〜45 Epic / それ以上 Legendary）。

## ロック / 一括売却

- 🔒 ロックした装備は一括分解・一括売却の対象外（保存対象）。
- 「未装備レジェンドを一括売却」で未装備・未ロックの Legendary をまとめて売却（確認あり）。
- 神機マキナ（`noSell`）は分解・売却不可。

## 装備比較

詳細モーダルで装備中の同スロット装備との差分（攻/防/HP/リロールの ±）を表示。
