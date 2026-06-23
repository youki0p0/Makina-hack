import { getCard, isSkill } from "@/data/arena/cards";
import { getMonster } from "@/data/arena/monsters";
import { getOperator } from "@/data/arena/operators";
import type {
  MonsterBuild,
  MonsterColor,
  SkillTag,
  SynergyView,
  TeamMods,
} from "@/types/arena";

export function emptyTeamMods(): TeamMods {
  return {
    atkMult: 1,
    defMult: 1,
    hpMult: 1,
    spdMult: 1,
    cdMult: 1,
    critAdd: 0,
    regenAdd: 0,
    burnBonus: 0,
    healMult: 1,
    poisonSpread: false,
    poisonBurn: false,
    reviveOnce: false,
    shieldStart: 0,
  };
}

/** チーム内の色の集合と各タグの出現数を数える。 */
function tally(builds: MonsterBuild[]) {
  const colors: MonsterColor[] = [];
  const tagCount: Partial<Record<SkillTag, number>> = {};
  let skillsTotal = 0;
  let monstersWithSkill = 0;
  let maxSkillsOnOne = 0;

  for (const b of builds) {
    const m = getMonster(b.monsterId);
    if (m) colors.push(m.color);
    const allCardIds = [...b.equipmentIds, ...b.skillIds];
    for (const id of allCardIds) {
      const c = getCard(id);
      if (!c) continue;
      for (const t of c.tags) tagCount[t] = (tagCount[t] ?? 0) + 1;
    }
    const nSkills = b.skillIds.length;
    skillsTotal += nSkills;
    if (nSkills > 0) monstersWithSkill += 1;
    if (nSkills > maxSkillsOnOne) maxSkillsOnOne = nSkills;
  }
  return { colors, tagCount, skillsTotal, monstersWithSkill, maxSkillsOnOne };
}

const has = (colors: MonsterColor[], c: MonsterColor) => colors.includes(c);
const countColor = (colors: MonsterColor[], c: MonsterColor) =>
  colors.filter((x) => x === c).length;

/**
 * 編成からアクティブなシナジーと、戦闘に渡すチーム補正をまとめて算出する。
 * - 色シナジー（同色3 / 三原色 / 各ペア）
 * - 技タグシナジー
 * - 集中 / 分散
 * - オペレーターのチーム規模パッシブ（分散シールド等）
 */
export function computeSynergies(
  builds: MonsterBuild[],
  operatorId: string,
): { views: SynergyView[]; mods: TeamMods } {
  const mods = emptyTeamMods();
  const views: SynergyView[] = [];
  const { colors, tagCount, monstersWithSkill, maxSkillsOnOne } = tally(builds);

  // ---- 色シナジー ----
  if (countColor(colors, "green") === 3) {
    mods.regenAdd += 4;
    views.push({ id: "ggg", name: "森の陣", emoji: "🌿", desc: "味方全体に毎秒回復 +4。" });
  }
  if (countColor(colors, "blue") === 3) {
    mods.cdMult *= 0.8;
    views.push({ id: "bbb", name: "魔導陣", emoji: "🔷", desc: "技クールダウン -20%。" });
  }
  if (countColor(colors, "red") === 3) {
    mods.atkMult *= 1.15;
    views.push({ id: "rrr", name: "猛火陣", emoji: "🔺", desc: "攻撃力 +15%。" });
  }
  if (has(colors, "green") && has(colors, "blue") && has(colors, "red")) {
    mods.atkMult *= 1.08;
    mods.defMult *= 1.08;
    mods.hpMult *= 1.08;
    mods.spdMult *= 1.08;
    views.push({ id: "gbr", name: "三原陣", emoji: "🌈", desc: "全ステータス +8%。" });
  }
  if (has(colors, "green") && has(colors, "red")) {
    mods.poisonBurn = true;
    views.push({ id: "gr", name: "毒炎", emoji: "☠️", desc: "毒状態の敵に火傷追加ダメージ。" });
  }
  if (has(colors, "blue") && has(colors, "red")) {
    mods.spdMult *= 1.1;
    mods.critAdd += 10;
    views.push({ id: "br", name: "加速火力", emoji: "💨", desc: "攻撃速度とクリ率上昇。" });
  }
  if (has(colors, "green") && has(colors, "blue")) {
    mods.defMult *= 1.12;
    mods.healMult *= 1.2;
    views.push({ id: "gb", name: "守護術式", emoji: "🛡️", desc: "防御と回復量上昇。" });
  }

  // ---- 技タグシナジー ----
  const tc = (t: SkillTag) => tagCount[t] ?? 0;
  if (tc("fire") >= 3) {
    mods.burnBonus += 4;
    views.push({ id: "fire3", name: "業火結界", emoji: "🔥", desc: "火傷ダメージ +4。" });
  }
  if (tc("poison") >= 3) {
    mods.poisonSpread = true;
    views.push({ id: "poison3", name: "瘴気蔓延", emoji: "🟣", desc: "毒が周囲に拡散する。" });
  }
  if (tc("defense") >= 3) {
    mods.defMult *= 1.12;
    views.push({ id: "def3", name: "鉄壁布陣", emoji: "🧱", desc: "防御 +12%。" });
  }
  if (tc("heal") >= 2) {
    mods.healMult *= 1.25;
    views.push({ id: "heal2", name: "癒やしの輪", emoji: "💚", desc: "回復量 +25%。" });
  }
  if (tc("critical") >= 2) {
    mods.critAdd += 12;
    views.push({ id: "crit2", name: "急所連携", emoji: "🎯", desc: "クリ率 +12%。" });
  }
  if (tc("haste") >= 2) {
    mods.spdMult *= 1.1;
    views.push({ id: "haste2", name: "疾風連携", emoji: "⚡", desc: "速度 +10%。" });
  }
  if (tc("reflect") >= 2) {
    mods.defMult *= 1.05;
    views.push({ id: "reflect2", name: "鏡面陣", emoji: "🪞", desc: "防御 +5%・反射が冴える。" });
  }

  // ---- 集中 / 分散 ----
  if (maxSkillsOnOne >= 3) {
    views.push({
      id: "focus",
      name: "集中（エース運用）",
      emoji: "💢",
      desc: "技3枚以上のエースは威力+25%。ただし被ダメージ+20%。",
    });
  }
  const monstersTotal = builds.filter((b) => getMonster(b.monsterId)).length;
  if (monstersWithSkill === monstersTotal && monstersTotal >= 3 && maxSkillsOnOne < 3) {
    views.push({
      id: "spread",
      name: "分散（安定運用）",
      emoji: "🤝",
      desc: "全員が技を持ち、崩れにくい布陣。",
    });
  }

  // ---- オペレーターのチーム規模パッシブ ----
  const op = getOperator(operatorId);
  const isSpread = monstersWithSkill === monstersTotal && monstersTotal >= 3 && maxSkillsOnOne < 3;
  if (op.passive.spreadShield && isSpread) {
    mods.shieldStart += op.passive.spreadShield;
    views.push({
      id: "op-spread",
      name: `${op.name}：守勢展開`,
      emoji: op.emoji,
      desc: `分散布陣で全員にシールド +${op.passive.spreadShield}。`,
    });
  }

  return { views, mods };
}

/** ある編成内で、指定スロットのモンスターが「集中エース」かどうか。 */
export function isFocusedSlot(builds: MonsterBuild[], slot: number): boolean {
  const b = builds[slot];
  if (!b) return false;
  return b.skillIds.filter((id) => {
    const c = getCard(id);
    return c && isSkill(c);
  }).length >= 3;
}
