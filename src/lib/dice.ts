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
 * Later sources override earlier ones for the same face, and every
 * contributing source is tracked in `modifiedBy` so the UI can highlight
 * changed faces.
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

function mergeEffect(
  base: DiceFaceEffect,
  patch: Partial<DiceFaceEffect>,
): DiceFaceEffect {
  return {
    kind: patch.kind ?? base.kind,
    damageMultiplier: patch.damageMultiplier ?? base.damageMultiplier,
    guard: patch.guard ?? base.guard,
    selfDamagePct: patch.selfDamagePct ?? base.selfDamagePct,
    lifestealPct: patch.lifestealPct ?? base.lifestealPct,
    extraHits: patch.extraHits ?? base.extraHits,
    isMiss: patch.isMiss ?? base.isMiss,
    statusEffect: patch.statusEffect ?? base.statusEffect,
  };
}
