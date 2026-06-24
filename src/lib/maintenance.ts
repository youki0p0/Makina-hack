// ===== 日次メンテナンス（メモリ解放リロード） =====
// 長時間プレイすると Web Audio のノードや各種オブジェクトが溜まり、画面が
// 固まりやすくなる。対策として「1日1回（日付が変わった初回起動時）」と
// 「更新後の初回1回だけ」、ページをリロードして蓄積メモリを解放する。
// セーブは localStorage に保持されるため進行は失われない（解放→読み込みの順）。

const KEY = "dice-hackslash-maint";

// この値を上げると、全プレイヤーで「次回起動時に1回だけ」強制リロードが走る。
// （= 「初回の今だけメモリ解放」を配布するためのスイッチ。）
// v2: 直近の更新（深層難化/紋章修正/セット調整 等）を未更新の端末へ確実に届けるため強制リロード。
// v3: era2移行（旧難易度開拓者への称号＋ハイコイン補填・3000階リセット・ランキング刷新）を
//     全端末へ確実に届ける（対象プレイヤーへ補填migration＋ポップアップを発火させる）。
export const MAINT_FORCE_VERSION = 3;

/** 保存しているメンテ状態。 */
export interface MaintState {
  /** 最後にメンテした日付キー（"YYYY-M-D"）。 */
  day?: string;
  /** 最後に適用した強制バージョン。 */
  v?: number;
}

/** ローカル日付のキー（"YYYY-M-D"）。端末のローカルタイムで日付を判定する。 */
export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 週キー（その週の月曜日基準, "WYYYY-M-D"）。月曜0時でウィークリーが切り替わる。 */
export function weekKey(d: Date = new Date()): string {
  const offset = (d.getDay() + 6) % 7; // 0=Mon … 6=Sun
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
  return `W${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`;
}

/**
 * 純粋関数: いまリロードして解放すべきか。
 * - 日付が変わっている（= その日初回） → true
 * - 強制バージョンが上がっている（= 更新後の初回） → true
 */
export function maintenanceNeeded(
  saved: MaintState | null,
  today: string,
  forceVersion: number = MAINT_FORCE_VERSION,
): boolean {
  const s = saved ?? {};
  const forced = (s.v ?? 0) < forceVersion;
  const newDay = s.day !== today;
  return forced || newDay;
}

// 1回のページ読み込み中に二重実行しないためのガード。
let ranThisLoad = false;

/**
 * アプリ起動時に一度だけ呼ぶ。必要なら localStorage にマーカーを記録してから
 * ページをリロードし、メモリを解放する。リロードループを避けるため、
 * マーカーを保存できた時だけリロードする（保存不可の環境では何もしない）。
 */
export function runDailyMaintenance(): void {
  if (typeof window === "undefined" || ranThisLoad) return;
  ranThisLoad = true;

  let saved: MaintState | null = null;
  try {
    const raw = window.localStorage.getItem(KEY);
    saved = raw ? (JSON.parse(raw) as MaintState) : null;
  } catch {
    saved = null;
  }

  const today = todayKey();
  if (!maintenanceNeeded(saved, today)) return;

  let recorded = false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ day: today, v: MAINT_FORCE_VERSION }));
    recorded = true;
  } catch {
    recorded = false;
  }
  // マーカーを保存できないと毎回リロードしてループするので、その場合は解放しない。
  if (!recorded) return;

  // 解放 → リロード。localStorage のセーブはそのまま引き継がれる。
  window.location.reload();
}
