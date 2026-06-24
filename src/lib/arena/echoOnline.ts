import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { MonsterBuild } from "@/types/arena";

/**
 * オンライン対戦（残響戦のオンライン版）。
 * 他プレイヤーがアップロードした編成（残響）を取得して観戦デュエルする。
 * Supabase 未設定 or 失敗時は全関数が安全にフォールバック（空/false）し、
 * ローカルのゴースト戦には一切影響しない。
 *
 * 必要なバックエンド（本番 Supabase に追加するテーブル/RPC）:
 *   table public.arena_echoes(id, player_name, operator_id, builds jsonb,
 *     blessings jsonb, power int, owner_token text unique, created_at)
 *   rpc submit_arena_echo(p_name,p_operator,p_builds,p_blessings,p_power,p_token)
 *   rpc fetch_arena_opponents(p_token, p_limit)
 */

export interface OnlineEcho {
  id: string;
  playerName: string;
  operatorId: string;
  builds: MonsterBuild[];
  blessings: string[];
  power: number;
}

const OWNER_KEY = "arena-echo-owner-v1";
const NAME_KEY = "arena-echo-name-v1";

export function onlineEnabled(): boolean {
  return isSupabaseConfigured();
}

function ownerToken(): string {
  if (typeof window === "undefined") return "server";
  let t = window.localStorage.getItem(OWNER_KEY);
  if (!t) {
    t = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    try {
      window.localStorage.setItem(OWNER_KEY, t);
    } catch {
      /* ignore */
    }
  }
  return t;
}

export function loadPlayerName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}
export function savePlayerName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAME_KEY, name.trim().slice(0, 16));
  } catch {
    /* ignore */
  }
}

/** 自分の残響をオンラインに公開（upsert）。成功で true。 */
export async function publishEcho(echo: {
  playerName: string;
  operatorId: string;
  builds: MonsterBuild[];
  blessings: string[];
  power: number;
}): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  const name = (echo.playerName || "Guest").trim().slice(0, 16) || "Guest";
  try {
    const { error } = await sb.rpc("submit_arena_echo", {
      p_name: name,
      p_operator: echo.operatorId,
      p_builds: echo.builds,
      p_blessings: echo.blessings,
      p_power: Math.max(0, Math.round(echo.power)),
      p_token: ownerToken(),
    });
    return !error;
  } catch {
    return false;
  }
}

/** 対戦相手（他プレイヤーの残響）をランダムめに取得。失敗時は空配列。 */
export async function fetchOpponents(limit = 20): Promise<OnlineEcho[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  try {
    const { data, error } = await sb.rpc("fetch_arena_opponents", {
      p_token: ownerToken(),
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return data
      .map((r: Record<string, unknown>): OnlineEcho | null => {
        const builds = r.builds as MonsterBuild[] | undefined;
        if (!Array.isArray(builds) || builds.length === 0) return null;
        return {
          id: String(r.id ?? Math.random()),
          playerName: String(r.player_name ?? "Guest"),
          operatorId: String(r.operator_id ?? "calibrator"),
          builds,
          blessings: Array.isArray(r.blessings) ? (r.blessings as string[]) : [],
          power: Number(r.power ?? 0),
        };
      })
      .filter((x): x is OnlineEcho => x !== null);
  } catch {
    return [];
  }
}
