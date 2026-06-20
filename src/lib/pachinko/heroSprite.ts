// ===== 勇者のピクセルアート・スプライト（手続き生成・画像アセット無し） =====
// マント付きの茶髪剣士。20×20グリッドを canvas に描いて base64 データURL化し、
// nearest-neighbor で拡大表示する（EnemyIcon と同じ流儀）。
// 数枚の差分フレーム（構え→振りかぶり→斬撃／よろけ→ダウン）を用意し、フレーム送りで
// なめらかに動かす。各フレームは生成時に1回だけ描いてキャッシュ（rAF/canvas常駐なし）。

const SIZE = 20;

/** パレット（'.' は透明）。auto-outline は OUTLINE 色で付与する。 */
const C: Record<string, string> = {
  K: "#4f2f16", // 髪（影）
  H: "#7a4a22", // 髪
  h: "#9c6a38", // 髪ハイライト
  F: "#f3cd9c", // 肌
  f: "#d9a877", // 肌の影
  E: "#20202e", // 目
  c: "#18307e", // マント（影）
  C: "#2747bf", // マント
  v: "#5174ec", // マント（ハイライト）
  B: "#3a5fd6", // 鎧/上衣
  b: "#6f93f5", // 鎧ハイライト
  L: "#5e3a1c", // ベルト
  u: "#d6a23c", // バックル
  G: "#6a4422", // 手甲
  g: "#d4a23c", // 鍔（金）
  S: "#cbd5df", // 剣身
  s: "#f2f6fa", // 剣の輝き
  n: "#202844", // 脚
  O: "#6a4422", // ブーツ
  o: "#43290f", // ブーツ（影）
  k: "#2e2440", // 暗部アクセント
};
const OUTLINE = "#130b14";

/** フレーム名。 */
export type HeroFrame = "stance" | "raise" | "slash" | "hurt" | "down";

// 右（ボス側）を向いた勇者の各ポーズ。各文字は C の色キー、'.' は透明。
const ART: Record<HeroFrame, string[]> = {
  // 構え（剣を右下へ下げた基本姿勢）。
  stance: [
    "....................", "......KHHHK.........", ".....KHHHHHK........", "....KHhHHHhHK.......",
    "....KHHFFFHHK.......", "...cKHFFFFFHK.......", "..cCKHFEFEFHh.......", "..cCCHFFfFFh........",
    ".cCCCBBBBBBb........", ".cCCBbBBBBBGg.......", ".vCCBBbBBBBGgS......", ".vCCCLLuLLBBGSs.....",
    ".vCCCnnnnnnB.SSs....", ".vCCnnn.nnnnSSs.....", "..cnnn..nnnnSs......", "..Onnn..nnnnO.......",
    "..Onnn..nnnnO.......", ".OOOO...nnOOOO......", ".oooo....OOoo.......", "....................",
  ],
  // 振りかぶり（剣を右上へ掲げる＝溜め）。
  raise: [
    "..................s.", "......KHHHK......sS.", ".....KHHHHHK....Ss..", "....KHhHHHhHK..SS...",
    "....KHHFFFHHK.gS....", "...cKHFFFFFHKGg.....", "..cCKHFEFEFHbb......", "..cCCHFFfFFhb.......",
    ".cCCCBBBBBBb........", ".cCCBbBBBBBb........", ".vCCBBbBBBBB........", ".vCCCLLuLLBB........",
    ".vCCCnnnnnnB........", ".vCCnnn.nnnn........", "..cnnn..nnnn........", "..Onnn..nnnnO.......",
    "..Onnn..nnnnO.......", ".OOOO...nnOOOO......", ".oooo....OOoo.......", "....................",
  ],
  // 斬撃（右へ突き／薙ぎ＝強打）。
  slash: [
    "....................", ".......KHHHK........", "......KHHHHHK.......", ".....KHhHHHhHK......",
    ".....KHHFFFHHK......", "....cKHFFFFFHK......", "...cCKHFEFEFHh......", "...cCCHFFfFFh.......",
    "..cCCCBBBBBBb.......", "..cCCBbBBBBBGgsss...", "..vCCBBbBBBBGSSSSs..", "..vCCCLLuLLBBg......",
    "..vCCCnnnnnnB.......", "..vCCnnn.nnnnn......", "...cnnn...nnnn......", "...Onnn...nnnn......",
    "...Onnn...nnnnO.....", "..OOOO...nnOOOO.....", "..oooo....OOoo......", "....................",
  ],
  // よろけ（被弾して左へのけぞる）。
  hurt: [
    "....................", "....KHHHK...........", "...KHHHHHK..........", "..KHhHHHhHK.........",
    "..KHHFFFHHK.........", ".cKHFFFFFHK.........", "cCKHFEFEFHh.........", "cCCHFFfFFh..........",
    "CCCCBBBBBBb.GgS.....", "cCCBbBBBBBB.GSs.....", "vCCBBbBBBBB..s......", "vCCCLLuLLBB.........",
    "vCCnnnnnnB..........", "vCnnn..nnnn.........", ".cnn...nnnnn........", ".Onn....nnnnO.......",
    "OOO.....nnOOO.......", "oo.......OOoo.......", "....................", "....................",
  ],
  // ダウン（倒れ込む）。
  down: [
    "....................", "....................", "....................", "....................",
    "....................", "....................", "............KHHK....", "...........KHHHHK...",
    "..........KHFEFHK...", "....sS....cBBBBbk...", "...sS...cCCBBnnnnO..", "..sScCCCCCnnnnnOOo..",
    "...cCCCnnnnnOOoo....", "....ccnnnOOoo.......", ".....nOoOo..........", "....................",
    "....................", "....................", "....................", "....................",
  ],
};

/** ART を 20×20 の色グリッドに展開し、4近傍の暗い輪郭を付ける。 */
function buildGrid(art: string[]): (string | null)[][] {
  const base: (string | null)[][] = Array.from({ length: SIZE }, () =>
    Array<string | null>(SIZE).fill(null),
  );
  for (let y = 0; y < SIZE; y++) {
    const row = art[y] ?? "";
    for (let x = 0; x < SIZE; x++) {
      const ch = row[x];
      if (ch && ch !== "." && C[ch]) base[y][x] = C[ch];
    }
  }
  const out = base.map((row) => row.slice());
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (base[y][x]) continue;
      const near =
        (y > 0 && base[y - 1][x]) ||
        (y < SIZE - 1 && base[y + 1][x]) ||
        (x > 0 && base[y][x - 1]) ||
        (x < SIZE - 1 && base[y][x + 1]);
      if (near) out[y][x] = OUTLINE;
    }
  }
  return out;
}

function gridToDataUrl(grid: (string | null)[][]): string {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = grid[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL("image/png");
}

let cached: Record<HeroFrame, string> | null = null;

/**
 * 勇者の全フレームの base64 データURL（クライアント専用・1回だけ生成してキャッシュ）。
 * SSR 時は空文字を返す。
 */
export function getHeroFrames(): Record<HeroFrame, string> {
  if (cached) return cached;
  const empty = { stance: "", raise: "", slash: "", hurt: "", down: "" } as Record<HeroFrame, string>;
  if (typeof document === "undefined") return empty;
  const out = { ...empty };
  (Object.keys(ART) as HeroFrame[]).forEach((k) => {
    out[k] = gridToDataUrl(buildGrid(ART[k]));
  });
  cached = out;
  return out;
}
