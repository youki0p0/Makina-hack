# 鍛冶屋（Forge）/ バランス / 場所別BGM

実装: `src/data/forge.ts`, `src/store/gameStore.ts`, `src/components/ForgePanel.tsx`,
`src/app/forge/page.tsx`, `src/lib/audio.ts`, `src/components/AudioController.tsx`

## 難度バランス（乗算 vs 加算 の是正）

旧設計では敵が `floor×★` の**乗算**で伸び、プレイヤーは**加算/線形**だったため深層で剪刀差。
クリア200-300h見込みを短縮するため:

- 敵 `hpScale 0.18→0.13` / `atkScale 0.12→0.095`、ボス `rankMult 1.6/1.3→1.45/1.22`（`enemies.ts`）。
- **敵★定数を分離・引き下げ** `ENEMY_MOD_BONUS_PER_STAR=0.13`（装備★は0.2のまま、`modifiers.ts`）。最重要レバー。
- レベル成長 `+3atk/+2def/+11hp`（`battle.ts applyExp`）、敵EXP/ゴールド係数 `0.15→0.2`。
- 生成武器係数 `0.8→0.9`（`items.ts`）。
- そして下記の鍛冶屋が**プレイヤー初の乗算成長**を与える。

## 鍛冶屋

素材（gachaPoints）で手持ち装備を強化する。**数値(attack/defense/maxHp)と★のみ強化し、
`diceModifiers`（出目）は不可侵**＝「装備でダイス面が変わる」コアを保全。10階到達で解放。

- **鍛える**: `forgeLevel`(0..`FORGE_MAX=15`)を上げる。各+1で `+7%`加算（`applyForge`）。
  成功時に **25%+で GREAT(+2) / 8%で PERFECT(+3)** の上振れ。コスト `8 + lv²×2`。
- **レベルは下がらない**（ノーレイジ）。Lv4+で「失敗（据え置き＋素材40%返却）」が発生しうるが、
  **ピティ**（連続失敗で成功率+5%/回）と **守護鍛錬**（コスト1.5倍で失敗なし）で救済。
- **合成**: 同じ部位の最も弱い未ロック装備を1つ消費して `+1`（同名ベースは `+2`、被り救済）。
- **★注入**: `modTier` を+1（コスト `250×(tier+1)`、上限 `最高到達階の★ + 2`）。深層の天井突破。
- 結果は `lastForge` でポップアップ表示。装備中・所持品どちらも対象。

データ: `Equipment.forgeLevel/forgeStreak`、`SavedItem` にも保存。`getItemInstance` が
affix→modifier→quality→**forge** の順に再構築（保存はID＋各値のみ）。

## レジェンド一括バグ修正

`sellLegendaries` は**ゴールド**を付与していた（バグ）。**素材(gachaPoints) +24/個**に修正。
UI文言も「一括分解（素材）」に統一。

## ガチャの価値改善（渋さ解消）

部位指定（250）は従来ランダム低ティアが出て価値が薄かった。**現在所持しているその部位の最強を
基準(refTier/refMod)に、その前後値で生成**するよう変更（`genRarePlusNear` / `estimateTier`）。
キュレーション（出目持ち）排出は25%、残りは基準±のRare+。常に「side/up-grade」になる。

## 場所別BGM（手続き生成・アセットなし）

`audio.ts` をテーマ駆動化（`setBgmTheme(theme, transpose)`）。テーマ: dungeon / world / casino /
forge / boss。`AudioController` が `usePathname()`＋`currentFloor` で切替:

- カジノ → casino（C-major・明るい）、鍛冶屋 → forge（D-dorian・重厚＋金床打撃）。
- 戦闘 → **50階ごとにキーが上がる world**（`transpose=2^((⌊(floor-1)/50⌋%6)/12)`）、大ボス階(`bossRank≥2`)は boss（速い・緊迫）。
- それ以外 → dungeon（既存ループ）。

## 上位ジョブ（解禁条件）

- 200階到達（`highestFloorReached>=200`）: 剣聖 / 大魔道士 / 武神（既存よりひと回り強い）。
- 500階到達: 白の天啓（攻防一体）。
- **黒の終焉は特殊解禁**: 1000階の結末（`progress.endingSeen`）を見届けた者のみ。最強格ゆえ階層では解禁不可。
- 倍率は `data/jobBalance.ts`（2.4〜3.0）。転職は従来どおり「倒れた後」だけ可能。

## セーブ「バッグのみ引継ぎ」

`SAVE_VERSION 3→4`。v4が無く v3 がある場合、**inventory/equipped のみ移行**し、階層・レベル・
素材・進行はリセット（`migrateFromV3`）。バランス刷新に合わせた clean start ＋ 装備資産は保護。
