// ===== 勇者のピクセルアート・スプライト（手続き生成・画像アセット無し） =====
// 16×16 グリッドを canvas に描いて base64 データURLにし、nearest-neighbor で拡大表示する
// （EnemyIcon と同じ流儀）。RUSH中のバトル映像で使う、右（ボス側）へ剣を構えた勇者。

const SIZE = 16;

/** 使用パレット（'.' は透明）。 */
const C: Record<string, string> = {
  O: "#15101c", // 輪郭
  H: "#9aa7b4", // 兜（鋼）
  h: "#c8d3de", // 兜ハイライト
  f: "#f1c79a", // 肌
  e: "#15101c", // 目
  A: "#4a7fe0", // 鎧（青）
  a: "#86abf5", // 鎧ハイライト
  S: "#dbe9f5", // 剣身
  s: "#ffffff", // 剣の輝き
  G: "#fbbf24", // 金（鍔）
  R: "#c0392b", // 盾（赤）
  r: "#fbbf24", // 盾の縁
  L: "#2a3550", // 脚
  B: "#5a3a1a", // ブーツ
};

// 右を向き、剣を右上へ掲げた勇者。各文字は C の色キー、'.' は透明。
const ART: string[] = [
  "..............s.",
  ".............sS.",
  "....hHHh....Ss..",
  "...hHHHHh..SS...",
  "...HfffH..GS....",
  "...ffefH.GG.....",
  "...ffff.aA......",
  "..rAaAAAAA......",
  "..RRAaAAAa......",
  "..rRAAAAAA......",
  "...rAALLAA......",
  "....LL..LL......",
  "....LL..LL......",
  "....LL..LL......",
  "...BBB..BBB.....",
  "................",
];

/** ART を 16×16 の色グリッドに展開し、4近傍の輪郭を付ける。 */
function buildHeroGrid(): (string | null)[][] {
  const g: (string | null)[][] = Array.from({ length: SIZE }, () =>
    Array<string | null>(SIZE).fill(null),
  );
  for (let y = 0; y < SIZE; y++) {
    const row = ART[y] ?? "";
    for (let x = 0; x < SIZE; x++) {
      const ch = row[x];
      if (ch && ch !== "." && C[ch]) g[y][x] = C[ch];
    }
  }
  // 暗い輪郭：空セルが上下左右いずれかの塗りセルに接していれば輪郭色にする。
  const outline = g.map((row) => row.slice());
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (g[y][x]) continue;
      const near =
        (y > 0 && g[y - 1][x]) ||
        (y < SIZE - 1 && g[y + 1][x]) ||
        (x > 0 && g[y][x - 1]) ||
        (x < SIZE - 1 && g[y][x + 1]);
      if (near) outline[y][x] = C.O;
    }
  }
  return outline;
}

let cached: string | null = null;

/** 勇者スプライトの base64 データURL（クライアント専用・1回だけ生成してキャッシュ）。 */
export function getHeroSpriteDataUrl(): string {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const grid = buildHeroGrid();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = grid[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  cached = canvas.toDataURL("image/png");
  return cached;
}
