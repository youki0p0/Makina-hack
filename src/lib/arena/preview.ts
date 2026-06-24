import { getCard, isEquipment, isSkill } from "@/data/arena/cards";
import { getMonster } from "@/data/arena/monsters";
import { EQUIP_DEF_BOOST_CAP, getOperator } from "@/data/arena/operators";
import { fieldTransform } from "@/lib/arena/fieldTransform";
import type { EffectiveSkill, FieldId, MonsterBuild, SkillCard } from "@/types/arena";

export interface SlotPreview {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  skills: EffectiveSkill[];
  focused: boolean;
}

/**
 * 装備込みの基礎ステータスと、フィールド変質後の技一覧をUI向けに算出する。
 * （シナジーのチーム補正は CardSetPanel 側でバッジ表示するため、ここでは含めない）
 */
export function slotPreview(
  build: MonsterBuild,
  field: FieldId,
  operatorId: string,
): SlotPreview {
  const m = getMonster(build.monsterId);
  const op = getOperator(operatorId);
  const boost = op.passive.favoredField === field ? op.passive.fieldTransformBoost ?? 0 : 0;

  let hp = m?.hp ?? 0;
  let attack = m?.attack ?? 0;
  let defense = m?.defense ?? 0;
  let speed = m?.speed ?? 0;

  let passiveDefBoost = 0;
  for (const id of build.equipmentIds) {
    const c = getCard(id);
    if (!c || !isEquipment(c)) continue;
    hp += c.hp ?? 0;
    attack += c.attack ?? 0;
    defense += c.defense ?? 0;
    passiveDefBoost += op.passive.equipDefenseBoost ?? 0;
    speed += c.speed ?? 0;
  }
  defense += Math.min(passiveDefBoost, EQUIP_DEF_BOOST_CAP);

  const skills = build.skillIds
    .map((id) => getCard(id))
    .filter((c): c is SkillCard => !!c && isSkill(c))
    .map((sc) => fieldTransform(sc, field, boost));

  return { hp, attack, defense, speed, skills, focused: skills.length >= 3 };
}
