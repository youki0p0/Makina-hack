// ===== Ranking (深層到達者ログ) =====
// No realtime PvP — only records ("残響/記録"). Works with or without Supabase:
// if it's unconfigured OR a request fails, we transparently fall back to a local
// repository (the player's own localStorage records — no fabricated players) so
// /ranking and /echo always function. One row per player: a returning name
// updates its record (Supabase upsert / local replace) rather than duplicating.
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

function toRow(e: RankingEntry) {
  return {
    player_name: e.playerName,
    highest_floor: e.highestFloorReached,
    cleared_1000: e.cleared1000,
    endless_abyss_floor: e.endlessAbyssFloor,
    job: e.job,
    difficulty: e.difficulty,
    title: e.title,
    has_shinki_makina: e.hasShinkiMakina,
    equipped_weapon_name: e.equippedWeaponName,
    equipment_score: e.equipmentScore,
    total_play_time: e.totalPlayTime,
    updated_at: e.updatedAt,
  };
}

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

const supabaseRankingRepository: RankingRepository = {
  source: "supabase",
  async list(filter) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error("no client");
    const { data, error } = await sb.from(TABLE).select("*").limit(500);
    if (error) throw error;
    return rankEntries((data as Row[]).map(fromRow), filter);
  },
  async submit(entry) {
    const clean = sanitizeEntry(entry);
    if (!clean) return false;
    const sb = getSupabaseClient();
    if (!sb) throw new Error("no client");
    // Upsert on player_name so a returning player updates their row instead of
    // piling up duplicates (requires a unique constraint on player_name).
    const { error } = await sb.from(TABLE).upsert(toRow(clean), { onConflict: "player_name" });
    if (error) throw error;
    return true;
  },
};

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
 * Submit an entry. Returns the backend that accepted it (or null if rejected by
 * validation). Always also keeps a local copy so the player sees their record.
 */
export async function submitRanking(
  entry: RankingEntry,
): Promise<{ ok: boolean; source: "supabase" | "local" | "rejected" }> {
  const clean = sanitizeEntry(entry);
  if (!clean) return { ok: false, source: "rejected" };
  // Always mirror locally so the record is visible even offline.
  await localRankingRepository.submit(clean);
  if (isSupabaseConfigured()) {
    try {
      await supabaseRankingRepository.submit(clean);
      return { ok: true, source: "supabase" };
    } catch {
      return { ok: true, source: "local" };
    }
  }
  return { ok: true, source: "local" };
}
