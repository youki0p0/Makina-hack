-- ===== アリーナ「オンライン対戦」勝敗ランキング用バックエンド =====
-- arena_echoes（公開残響）とは別の、勝敗統計テーブル＋RPC。非破壊（CREATE のみ）。
-- 端末トークン(owner_token)ごとに wins/losses/streak/best_streak を集計する。

create table if not exists public.arena_pvp_stats (
  owner_token text primary key,
  player_name text not null default 'Guest',
  wins int not null default 0,
  losses int not null default 0,
  streak int not null default 0,
  best_streak int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.arena_pvp_stats enable row level security;
-- 直接アクセスは禁止（ポリシー無し）。SECURITY DEFINER の RPC からのみ。

-- 勝敗を1件記録し、更新後の統計を返す
create or replace function public.report_arena_result(p_token text, p_name text, p_win boolean)
returns table (wins int, losses int, streak int, best_streak int)
language plpgsql security definer set search_path = public as $$
declare r public.arena_pvp_stats;
begin
  insert into public.arena_pvp_stats as s (owner_token, player_name, wins, losses, streak, best_streak, updated_at)
  values (p_token, coalesce(nullif(trim(p_name), ''), 'Guest'),
          case when p_win then 1 else 0 end,
          case when p_win then 0 else 1 end,
          case when p_win then 1 else 0 end,
          case when p_win then 1 else 0 end,
          now())
  on conflict (owner_token) do update
    set player_name = excluded.player_name,
        wins   = s.wins   + (case when p_win then 1 else 0 end),
        losses = s.losses + (case when p_win then 0 else 1 end),
        streak = case when p_win then s.streak + 1 else 0 end,
        best_streak = greatest(s.best_streak, case when p_win then s.streak + 1 else 0 end),
        updated_at = now()
  returning s.* into r;
  return query select r.wins, r.losses, r.streak, r.best_streak;
end; $$;

-- ランキング（最高連勝→勝数→勝率）
create or replace function public.fetch_arena_leaderboard(p_limit int)
returns table (player_name text, wins int, losses int, best_streak int, streak int)
language sql security definer set search_path = public as $$
  select player_name, wins, losses, best_streak, streak
  from public.arena_pvp_stats
  where wins + losses >= 1
  order by best_streak desc, wins desc, (wins::numeric / nullif(wins + losses, 0)) desc
  limit greatest(1, least(100, coalesce(p_limit, 20)));
$$;

grant execute on function public.report_arena_result(text, text, boolean) to anon;
grant execute on function public.fetch_arena_leaderboard(int) to anon;
