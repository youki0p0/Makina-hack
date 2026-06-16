# オンライン要素（ランキング / 残響戦）

実装: `src/lib/supabase.ts`, `src/lib/ranking.ts`, `src/lib/echoBattle.ts`,
`src/app/ranking/page.tsx`, `src/app/echo/page.tsx`,
`src/components/{RankingList,EchoBattleCard}.tsx`

リアルタイムPvPは実装しない。世界観として、他プレイヤー本人ではなく **「記録」「残響」** と
向き合う設計。**今後もリアルタイムPvPは実装しない方針**（記録ベースで完結させる）。

## 1. ランキング（深層到達者ログ） `/ranking`

「誰がどこまで深く潜ったか」を記録として残す。明るい競技画面ではなく「記録端末」風UI。

- フィルタ: 総合 / ジョブ別 / 難易度別 / Endless Abyss / 神機マキナ取得者
- 表示: 順位・記録者名・到達階(またはAbyss階)・ジョブ・難易度・称号・神機マキナ・装備武器
- 記録する情報: `playerName / highestFloorReached / cleared1000 / endlessAbyssFloor / job /
  difficulty / title / hasShinkiMakina / equippedWeaponName / equipmentScore / totalPlayTime /
  updatedAt`

### 送信ポリシー（最低限の不正対策）

- **個人情報は送信しない**（メール等は保存しない）。`playerName` は任意、未入力なら `Guest`。
- `highestFloorReached < 1` または `> 999999` は送信しない（`sanitizeEntry` で null）。
- `equipmentScore` が異常に高い場合は上限(1,000,000)に丸める。
- 厳密なチート対策は行わない（個人開発のため）。

## 2. 残響戦（Echo Battle） `/echo`

ランキングに保存された **記録からゴースト敵（残響）を生成**して戦う。他人本人や現在データは
読み込まない。入口はタイトル画面。

- 残響の強さ: HPは到達階、攻撃は装備スコア、行動傾向はジョブに依存。高難易度の記録ほど強い。
  神機マキナ取得者の残響は**全出目通常攻撃の安定型**（特殊行動なし）。
- 戦闘はCPU戦（通常の敵と同じ）。リアルタイム通信なし。自己完結のミニ戦闘。
- 報酬: 控えめなゴールド/素材/ランキングポイントに加え、**勝利ごとに必ず1本の「残響装備」**
  （武器/防具/装飾のいずれか）をドロップ。見た目は少し特殊（ゴーストの縁取り）だが性能は同深度の
  通常装備並み（★・品質なし）で強すぎない。

### 試し場（Trial）

ランキングデータが無くてもゴースト戦を試せるよう、`/echo` に **20段階の練習ゴースト**を用意
（`TRIAL_GHOSTS` / `trialGhost(level)`）。到達階・装備スコア・難易度がレベルに応じて段階的に上昇
（難易度は5レベルごとに normal→hard→hell→expert、Lv20は神機マキナ持ち）。
**勝利するとその強さより一回り大きい報酬**（`TRIAL_REWARD_BONUS = 1.3` 倍）が得られる。
`/echo` 上部の「記録の残響 / 試し場」タブで切り替え。

## Supabase（任意）

接続情報は**ハードコードしない**。環境変数からのみ取得する（Vercel の Environment Variables に
設定済みである前提）。

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### テーブル `ranking_entries`

```sql
create table ranking_entries (
  id uuid primary key default gen_random_uuid(),
  player_name text,
  highest_floor integer,
  cleared_1000 boolean,
  endless_abyss_floor integer,
  job text,
  difficulty text,
  title text,
  has_shinki_makina boolean,
  equipped_weapon_name text,
  equipment_score integer,
  total_play_time integer,
  updated_at timestamptz default now()
);
-- 個人開発向け: anon から insert/select を許可（厳密なRLSは任意）
alter table ranking_entries enable row level security;
create policy "read"  on ranking_entries for select using (true);
create policy "write" on ranking_entries for insert with check (true);
```

### 未設定時 / 障害時の動作（フォールバック）

- 環境変数が未設定なら `getSupabaseClient()` は `null` を返し、自動的に **localRankingRepository**
  （`localStorage` ＋ バンドル済みダミーデータ）にフォールバックする。
- Supabase 接続/クエリが失敗した場合も同様にローカルへフォールバックする。
- そのため **Supabase 障害時でも `/ranking` と `/echo` は常に利用可能**。
- 送信は常にローカルへも控えるため、オフラインでも自分の記録が見える。
- UI 右上に `● ONLINE` / `○ LOCAL` で現在のバックエンドを表示。
- 表示は常に**ローカルの自分の記録をマージ**する。Supabase設定時にinsertが失敗/遅延しても、
  自分の登録がボードに必ず出る（「登録しても追加されない」不具合の対策）。
