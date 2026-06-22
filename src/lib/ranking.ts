// ===== Ranking (深層到達者ログ) =====
// No realtime PvP — only records ("残響/記録"). Works with or without Supabase:
// if it's unconfigured OR a request fails, we transparently fall back to a local
// repository (the player's own localStorage records — no fabricated players) so
// /ranking and /echo always function.
//
// Player names are UNIQUE online. Each device holds a private "owner token"
// (localStorage). Online writes go through the `submit_ranking` RPC, which
// inserts a new name, updates the row when the caller owns it (same token), or
// returns "duplicate" when the name is already taken by another device.
// No personal info is stored — playerName is optional (default Guest).

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export interface RankingEntry {
  playerName: string;
  highestFloorReached: number;
  cleared1000: boolean;
  endlessAbyssFloor: number;
  job: string;
  difficulty: string;
  title: string;
  hasShinkiMakina: boolean;
  equippedWeaponName: string;
  equipmentScore: number;
  totalPlayTime: number;
  updatedAt: string;
}

export type RankingFilter =
  | { kind: "total" }
  | { kind: "job"; job: string }
  | { kind: "difficulty"; difficulty: string }
  | { kind: "endless" }
  | { kind: "makina" };

const TABLE = "ranking_entries";
const LOCAL_KEY = "dice-ranking-local-v1";
const OWNER_KEY = "dice-ranking-owner-v1";

// Columns we read back. owner_token is intentionally never selected — it is the
// per-device ownership secret and must stay server-side.
const READ_COLUMNS =
  "player_name,highest_floor,cleared_1000,endless_abyss_floor,job,difficulty,title,has_shinki_makina,equipped_weapon_name,equipment_score,total_play_time,updated_at";

const MAX_FLOOR = 999999;
const MAX_SCORE = 1_000_000;
const MAX_NAME = 16;

/** Clamp/validate a candidate entry. Returns null if it must not be submitted. */
export function sanitizeEntry(e: RankingEntry): RankingEntry | null {
  if (!Number.isFinite(e.highestFloorReached)) return null;
  // Obviously-bogus floors are dropped entirely.
  if (e.highestFloorReached < 1 || e.highestFloorReached > MAX_FLOOR) return null;
  const name = (e.playerName || "").trim().slice(0, MAX_NAME) || "Guest";
  return {
    ...e,
    playerName: name,
    highestFloorReached: Math.floor(e.highestFloorReached),
    endlessAbyssFloor: Math.max(0, Math.min(MAX_FLOOR, Math.floor(e.endlessAbyssFloor || 0))),
    // Absurd scores are rounded down rather than rejected.
    equipmentScore: Math.max(0, Math.min(MAX_SCORE, Math.round(e.equipmentScore || 0))),
    totalPlayTime: Math.max(0, Math.min(10 ** 9, Math.round(e.totalPlayTime || 0))),
    updatedAt: e.updatedAt || new Date().toISOString(),
  };
}

/** Sort + filter a list of entries for display. */
export function rankEntries(entries: RankingEntry[], filter: RankingFilter): RankingEntry[] {
  let out = [...entries];
  if (filter.kind === "job") out = out.filter((e) => e.job === filter.job);
  else if (filter.kind === "difficulty") out = out.filter((e) => e.difficulty === filter.difficulty);
  else if (filter.kind === "endless") out = out.filter((e) => e.endlessAbyssFloor > 0);
  else if (filter.kind === "makina") out = out.filter((e) => e.hasShinkiMakina);

  const key = filter.kind === "endless" ? "endlessAbyssFloor" : "highestFloorReached";
  return out.sort((a, b) => b[key] - a[key] || b.equipmentScore - a.equipmentScore).slice(0, 100);
}

// ----- repositories -----
export interface RankingRepository {
  list(filter: RankingFilter): Promise<RankingEntry[]>;
  submit(entry: RankingEntry): Promise<boolean>;
  /** Human label for the active backend (shown discreetly in the UI). */
  readonly source: "supabase" | "local";
}

function readLocal(): RankingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as RankingEntry[]) : [];
  } catch {
    return [];
  }
}
function writeLocal(entries: RankingEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(entries.slice(-200)));
  } catch {
    // ignore
  }
}

/** Stable per-device secret that proves ownership of a player name online. */
function getOwnerToken(): string {
  if (typeof window === "undefined") return "server";
  try {
    let t = window.localStorage.getItem(OWNER_KEY);
    if (!t) {
      t =
        (typeof crypto !== "undefined" && crypto.randomUUID?.()) ||
        `own_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      window.localStorage.setItem(OWNER_KEY, t);
    }
    return t;
  } catch {
    return "anon";
  }
}

export const localRankingRepository: RankingRepository = {
  source: "local",
  async list(filter) {
    return rankEntries(dedupByName(readLocal()), filter);
  },
  async submit(entry) {
    const clean = sanitizeEntry(entry);
    if (!clean) return false;
    // One row per player: replace any prior record with the same name.
    const others = readLocal().filter((e) => e.playerName !== clean.playerName);
    writeLocal([...others, clean]);
    return true;
  },
};

interface Row {
  player_name: string;
  highest_floor: number;
  cleared_1000: boolean;
  endless_abyss_floor: number;
  job: string;
  difficulty: string;
  title: string;
  has_shinki_makina: boolean;
  equipped_weapon_name: string;
  equipment_score: number;
  total_play_time: number;
  updated_at: string;
}
function fromRow(r: Row): RankingEntry {
  return {
    playerName: r.player_name ?? "Guest",
    highestFloorReached: r.highest_floor ?? 1,
    cleared1000: Boolean(r.cleared_1000),
    endlessAbyssFloor: r.endless_abyss_floor ?? 0,
    job: r.job ?? "adventurer",
    difficulty: r.difficulty ?? "normal",
    title: r.title ?? "",
    hasShinkiMakina: Boolean(r.has_shinki_makina),
    equippedWeaponName: r.equipped_weapon_name ?? "",
    equipmentScore: r.equipment_score ?? 0,
    totalPlayTime: r.total_play_time ?? 0,
    updatedAt: r.updated_at ?? new Date().toISOString(),
  };
}

const supabaseRankingRepository: Pick<RankingRepository, "source" | "list"> = {
  source: "supabase",
  async list(filter) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error("no client");
    const { data, error } = await sb.from(TABLE).select(READ_COLUMNS).limit(500);
    if (error) throw error;
    return rankEntries((data as Row[]).map(fromRow), filter);
  },
};

type SubmitStatus = "inserted" | "updated" | "duplicate";

/**
 * Write a record online via the `submit_ranking` RPC, which enforces unique
 * player names: it inserts a new name, updates the row when the caller owns it
 * (matching owner token), or returns "duplicate" when the name already belongs
 * to another device.
 */
async function supabaseSubmit(clean: RankingEntry): Promise<SubmitStatus> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("no client");
  const { data, error } = await sb.rpc("submit_ranking", {
    p_owner: getOwnerToken(),
    p_player_name: clean.playerName,
    p_highest_floor: clean.highestFloorReached,
    p_cleared_1000: clean.cleared1000,
    p_endless_abyss_floor: clean.endlessAbyssFloor,
    p_job: clean.job,
    p_difficulty: clean.difficulty,
    p_title: clean.title,
    p_has_shinki_makina: clean.hasShinkiMakina,
    p_equipped_weapon_name: clean.equippedWeaponName,
    p_equipment_score: clean.equipmentScore,
    p_total_play_time: clean.totalPlayTime,
    p_updated_at: clean.updatedAt,
  });
  if (error) throw error;
  return (data as SubmitStatus) ?? "duplicate";
}

// ----- facade with automatic fallback -----

/** Which backend will be tried first. */
export function rankingSource(): "supabase" | "local" {
  return isSupabaseConfigured() ? "supabase" : "local";
}

/** Collapse to a single entry per player (keep their best floor; newest on tie). */
function dedupByName(entries: RankingEntry[]): RankingEntry[] {
  const best = new Map<string, RankingEntry>();
  for (const e of entries) {
    const prev = best.get(e.playerName);
    if (
      !prev ||
      e.highestFloorReached > prev.highestFloorReached ||
      (e.highestFloorReached === prev.highestFloorReached && e.updatedAt > prev.updatedAt)
    ) {
      best.set(e.playerName, e);
    }
  }
  return [...best.values()];
}

/**
 * Load ranking entries. ALWAYS merges the local copy so the player sees their
 * own record even if the Supabase write failed/lagged (the reported "登録しても
 * 追加されない" bug). Falls back to the player's local records when Supabase is
 * absent/erroring — no fabricated players are ever injected.
 */
export async function loadRanking(filter: RankingFilter): Promise<RankingEntry[]> {
  const local = readLocal();
  if (isSupabaseConfigured()) {
    try {
      const remote = await supabaseRankingRepository.list({ kind: "total" });
      return rankEntries(dedupByName([...remote, ...local]), filter);
    } catch {
      // Supabase outage → local still works.
    }
  }
  return rankEntries(dedupByName(local), filter);
}

/**
 * Submit an entry. Returns the backend that accepted it, "rejected" when the
 * values are invalid, or "duplicate" when the name is already owned by another
 * device. Keeps a local copy (except on duplicate) so the player still sees
 * their own record offline.
 */
export async function submitRanking(
  entry: RankingEntry,
): Promise<{ ok: boolean; source: "supabase" | "local" | "rejected" | "duplicate" }> {
  const clean = sanitizeEntry(entry);
  if (!clean) return { ok: false, source: "rejected" };
  if (isSupabaseConfigured()) {
    try {
      const status = await supabaseSubmit(clean);
      // Name taken by someone else → don't store it (player must pick another).
      if (status === "duplicate") return { ok: false, source: "duplicate" };
      // Mirror locally so the record stays visible even offline.
      await localRankingRepository.submit(clean);
      return { ok: true, source: "supabase" };
    } catch {
      // Online error (network/outage) → keep a local copy so it isn't lost.
      await localRankingRepository.submit(clean);
      return { ok: true, source: "local" };
    }
  }
  // No Supabase configured: local only (single device, no cross-device clash).
  await localRankingRepository.submit(clean);
  return { ok: true, source: "local" };
}
