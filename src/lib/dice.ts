import { baseDiceFaces } from "@/data/diceFaces";
import type {
  DiceFace,
  DiceFaceEffect,
  DiceModifier,
  DiceValue,
} from "@/types/game";

export function rollDice(): DiceValue {
  return (Math.floor(Math.random() * 6) + 1) as DiceValue;
}

/** Anything that can rewrite dice faces: an equipment item or a character class. */
export interface ModifierSource {
  name: string;
  diceModifiers: ReadonlyArray<DiceModifier>;
}

/**
 * THE CORE SYSTEM.
 *
 * Takes the base dice table and rewrites each face according to the
 * dice modifiers of every source (character class first, then equipment).
 * 各ソースは「上書き」ではなく非破壊的に「ベスト合成＋加算」で重ねる
 * (mergeEffect 参照)。これで職アイデンティティ＋武器＋セット効果が共存する。
 * 寄与した全ソースは `modifiedBy` に記録され、UIが変更面を強調できる。
 */
export function applyEquipmentModifiers(
  equipped: ReadonlyArray<ModifierSource | null>,
): DiceFace[] {
  // Deep-ish clone so we never mutate the base table.
  const faces: DiceFace[] = baseDiceFaces.map((f) => ({
    ...f,
    effect: { ...f.effect },
    modifiedBy: [],
  }));

  for (const item of equipped) {
    if (!item) continue;
    for (const mod of item.diceModifiers) {
      for (const value of mod.faces) {
        const face = faces.find((f) => f.value === value);
        if (!face) continue;
        face.effect = mergeEffect(face.effect, mod.effect);
        if (mod.label) face.name = mod.label;
        face.description = mod.description;
        if (!face.modifiedBy.includes(item.name)) {
          face.modifiedBy.push(item.name);
        }
      }
    }
  }

  return faces;
}

/**
 * 非破壊的レイヤー合成。複数ソース(職→武器→セット)が同じ面を触っても
 * 強い効果を潰さず、火力・手数・吸血などを「ベスト or 加算」で重ねる。
 *  - damageMultiplier: 大きい方を採用 (最高火力を保持)
 *  - isMiss: どれか1ソースが isMiss:false を宣言すればミスは消える
 *  - guard / extraHits: 加算 (盾系・手数系が積み上がる)
 *  - selfDamagePct: 最大値のみ (ペナルティは積み上げない)
 *  - lifestealPct: 加算しつつ 0.75 で頭打ち
 *  - statusEffect: damagePerTurnMultiplier が高い方を優先
 *  - stun / weaken: 最大値
 *  - kind: patch がより高い火力を持つならその kind、無ければ patch.kind ?? base.kind
 */
function mergeEffect(
  base: DiceFaceEffect,
  patch: Partial<DiceFaceEffect>,
): DiceFaceEffect {
  const damageMultiplier = Math.max(base.damageMultiplier, patch.damageMultiplier ?? base.damageMultiplier);
  // patch がより高い火力を宣言するなら patch.kind を採用、そうでなければ patch.kind ?? base.kind。
  const kind =
    patch.damageMultiplier !== undefined && patch.damageMultiplier > base.damageMultiplier
      ? patch.kind ?? base.kind
      : patch.kind ?? base.kind;

  // statusEffect は継続ダメージ倍率が高い方を残す(両方あれば強い方、片方ならそれ)。
  let statusEffect = base.statusEffect;
  if (patch.statusEffect) {
    if (!statusEffect || patch.statusEffect.damagePerTurnMultiplier >= statusEffect.damagePerTurnMultiplier) {
      statusEffect = patch.statusEffect;
    }
  }

  return {
    kind,
    damageMultiplier,
    // どれか1ソースでも isMiss:false を宣言すればミス解除 (省略時は維持扱い)。
    isMiss: base.isMiss && (patch.isMiss ?? true),
    guard: base.guard + (patch.guard ?? 0),
    selfDamagePct: Math.max(base.selfDamagePct, patch.selfDamagePct ?? 0),
    lifestealPct: Math.min(0.75, base.lifestealPct + (patch.lifestealPct ?? 0)),
    extraHits: base.extraHits + (patch.extraHits ?? 0),
    statusEffect,
    stun: Math.max(base.stun ?? 0, patch.stun ?? 0),
    weaken: Math.max(base.weaken ?? 0, patch.weaken ?? 0),
    weakenPct: Math.max(base.weakenPct ?? 0, patch.weakenPct ?? 0),
  };
}
