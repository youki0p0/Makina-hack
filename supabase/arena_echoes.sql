-- ===== アリーナ「オンライン対戦」用バックエンド =====
-- 既存の本編ランキング（ranking_entries / submit_ranking）とは独立した追加テーブル。
-- 非破壊（CREATE のみ）。anon キーから安全に読み書きできるよう RPC 経由に限定する。
--
-- 適用方法：Supabase SQL Editor（または supabase db push）でこのファイルを実行。

-- 1) テーブル：プレイヤーがアップロードした残響編成
create table if not exists public.arena_echoes (
  id           uuid primary key default gen_random_uuid(),
  player_name  text not null default 'Guest',
  operator_id  text not null,
  builds       jsonb not null,
  blessings    jsonb not null default '[]'::jsonb,
  power        int  not null default 0,
  owner_token  text not null unique,           -- 端末ごとの所有トークン（読み出しでは返さない）
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists arena_echoes_updated_idx on public.arena_echoes (updated_at desc);

-- 2) RLS：直接の読み書きは禁止。アクセスは SECURITY DEFINER の RPC からのみ。
alter table public.arena_echoes enable row level security;
-- （ポリシーを一切作らない＝ anon からの直接 select/insert は不可。RPC のみ許可）

-- 3) 公開（upsert）：同じ owner_token なら最新で上書き
create or replace function public.submit_arena_echo(
  p_name text, p_operator text, p_builds jsonb, p_blessings jsonb, p_power int, p_token text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.arena_echoes (player_name, operator_id, builds, blessings, power, owner_token, updated_at)
  values (coalesce(nullif(trim(p_name), ''), 'Guest'), p_operator, p_builds, coalesce(p_blessings, '[]'::jsonb),
          greatest(0, coalesce(p_power, 0)), p_token, now())
  on conflict (owner_token) do update
    set player_name = excluded.player_name,
        operator_id = excluded.operator_id,
        builds      = excluded.builds,
        blessings   = excluded.blessings,
        power       = excluded.power,
        updated_at  = now();
end; $$;

-- 4) 対戦相手取得：自分以外からランダムに最大 p_limit 件（owner_token は返さない）
create or replace function public.fetch_arena_opponents(p_token text, p_limit int)
returns table (id uuid, player_name text, operator_id text, builds jsonb, blessings jsonb, power int)
language sql security definer set search_path = public as $$
  select id, player_name, operator_id, builds, blessings, power
  from public.arena_echoes
  where owner_token is distinct from p_token
  order by random()
  limit greatest(1, least(50, coalesce(p_limit, 20)));
$$;

-- 5) anon ロールに RPC 実行権限を付与
grant execute on function public.submit_arena_echo(text, text, jsonb, jsonb, int, text) to anon;
grant execute on function public.fetch_arena_opponents(text, int) to anon;
