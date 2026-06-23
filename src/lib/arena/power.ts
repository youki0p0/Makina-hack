import { getCard, isSkill } from "@/data/arena/cards";
import { enemyStat } from "@/lib/arena/battle";
import { applyBlessings } from "@/lib/arena/blessings";
import { slotPreview } from "@/lib/arena/preview";
import { computeSynergies } from "@/lib/arena/synergy";
import type { FieldId, MonsterBuild, TeamMods } from "@/types/arena";

/**
 * 「総合力 ★」指標。装備や技・シナジー・祝福を盛るほど数値が上がり、
 * 敵チームの ★ と並べて「★120 の自軍 vs ★100 の敵」のように強さを直感できる。
 * 厳密な戦闘結果ではなく、編成判断のための分かりやすい目安。
 */

function statPower(hp: number, attack: number, defense: number, speed: number): number {
  // 実プレイテストに合わせ、生存（HP/防御）の寄与を引き上げ攻撃偏重を是正。
  return hp * 0.11 + attack * 1.0 + defense * 1.3 + speed * 0.7;
}

/** チーム補正(シナジー+祝福)を1つのスカラー倍率に丸める。 */
function teamScalar(mods: TeamMods): number {
  const base =
    mods.atkMult * 0.4 + mods.defMult * 0.3 + mods.hpMult * 0.2 + mods.spdMult * 0.1;
  const cd = mods.cdMult < 1 ? 1 + (1 - mods.cdMult) * 0.5 : 1;
  const crit = 1 + mods.critAdd / 200;
  return base * cd * crit;
}

/** 味方1体の総合力（装備込みステータス＋技の価値）。チーム倍率は別途かける。 */
function unitRawPower(build: MonsterBuild, field: FieldId, operatorId: string): number {
  const p = slotPreview(build, field, operatorId);
  let v = statPower(p.hp, p.attack, p.defense, p.speed);
  for (const id of build.skillIds) {
    const c = getCard(id);
    if (!c || !isSkill(c)) continue;
    // レア度威力差(#3)を反映。回復/シールドは生存に効くため厚めに評価。
    const rf = c.rarity === 1 ? 0.9 : c.rarity === 3 ? 1.15 : 1;
    v += 5 + c.power * 5 * rf + (c.heal ?? 0) * 8 + (c.shield ?? 0) * 0.25 + c.rarity * 2;
  }
  if (p.focused) v *= 1.15; // 集中エースは強化済み(#1)なので相応に高評価
  return v;
}

/** 味方チームの総合力 ★。 */
export function allyTeamPower(
  builds: MonsterBuild[],
  field: FieldId,
  operatorId: string,
  blessings: string[],
): number {
  const { mods } = computeSynergies(builds, operatorId);
  applyBlessings(mods, blessings);
  const scalar = teamScalar(mods);
  let total = 0;
  for (const b of builds) total += unitRawPower(b, field, operatorId);
  total = total * scalar + mods.shieldStart * 0.4 + mods.regenAdd * 3;
  return Math.round(total / 5); // 見やすい桁に圧縮（★スケール）
}

/** 次ラウンドの敵チーム総合力 ★（プレビュー比較用）。 */
export function enemyTeamPower(round: number, field: FieldId): number {
  let total = 0;
  for (let slot = 0; slot < 3; slot++) {
    const st = enemyStat(round, field, slot);
    let v = statPower(st.maxHp, st.attack, st.defense, st.speed);
    v += st.nSkills * 8;
    total += v;
  }
  return Math.round(total / 5);
}
