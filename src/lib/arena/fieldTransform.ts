import type {
  EffectiveSkill,
  FieldId,
  SkillCard,
  StatusApply,
  StatusType,
} from "@/types/arena";

/**
 * フィールドは単なる数値補正ではなく、技の効果そのものを書き換える。
 * fieldTransform は元の技カードを受け取り、フィールド（とオペレーターの得意補正）に
 * 応じて変質させた実効スキルを返す。UI には変質後の名前・説明・fieldNote を出す。
 *
 * boost: オペレーターが得意フィールドのとき、その看板状態異常（火傷/毒/再生）を
 *        さらに強める割合（0 で無補正）。
 */

function clone(skill: SkillCard): EffectiveSkill {
  return {
    ...skill,
    baseId: skill.id,
    tags: [...skill.tags],
    apply: skill.apply?.map((a) => ({ ...a })),
  };
}

const hasTag = (s: EffectiveSkill, t: string) => s.tags.includes(t as never);

/** apply 配列から指定状態を探す（なければ undefined）。 */
function findStatus(s: EffectiveSkill, st: StatusType): StatusApply | undefined {
  return s.apply?.find((a) => a.status === st);
}

function addStatus(s: EffectiveSkill, a: StatusApply) {
  if (!s.apply) s.apply = [];
  s.apply.push(a);
}

function scale(v: number, boost: number) {
  return Math.round(v * (1 + boost));
}

export function fieldTransform(
  skill: SkillCard,
  field: FieldId,
  boost = 0,
): EffectiveSkill {
  const s = clone(skill);
  const fire = hasTag(s, "fire");
  const poison = hasTag(s, "poison");
  const healish = hasTag(s, "heal") || hasTag(s, "regenerate");
  const defensive = hasTag(s, "defense") || hasTag(s, "shield");

  switch (field) {
    case "volcano": {
      if (fire) {
        const burn = findStatus(s, "burn");
        if (burn) {
          burn.magnitude = scale(burn.magnitude + 2, boost);
          burn.duration += 5;
        } else {
          addStatus(s, { status: "burn", magnitude: scale(5, boost), duration: 25 });
        }
        if (s.targeting === "single" && !s.splash) {
          s.splash = 0.5;
          s.fieldNote = "🌋 噴火：左右の敵にも飛び火し火傷を上乗せ";
          if (s.id === "flame_slash") s.name = "噴火斬り";
        } else if (s.targeting === "area") {
          s.power = +(s.power * 1.25).toFixed(2);
          s.fieldNote = "🌋 噴火：範囲火力が増す";
        } else {
          s.fieldNote = "🌋 火傷が激しくなる";
        }
      }
      break;
    }
    case "rain": {
      if (fire) {
        // 火傷 → 暗闇＋鈍足の蒸気技に変質。波及は消える。
        s.apply = (s.apply ?? []).filter((a) => a.status !== "burn");
        addStatus(s, { status: "blind", magnitude: 30, duration: 25 });
        addStatus(s, { status: "defDown", magnitude: 15, duration: 25 });
        s.splash = undefined;
        if (s.id === "flame_slash") s.name = "蒸気斬り";
        s.fieldNote = "🌧️ 蒸気：火傷の代わりに暗闇と鈍足を撒く";
      }
      if (defensive) {
        if (s.shield) s.shield = Math.round(s.shield * 1.2);
        s.fieldNote = "🌧️ 雨で守りが冴える（シールド+20%）";
      }
      if (healish && s.heal) {
        s.heal = +(s.heal * 1.15).toFixed(2);
        s.fieldNote = "🌧️ 雨で回復が増す";
      }
      break;
    }
    case "forest": {
      if (poison) {
        const p = findStatus(s, "poison");
        if (p) {
          p.aoe = true;
          p.magnitude = scale(p.magnitude, boost);
        }
        s.fieldNote = "🌲 延焼ならぬ蔓延：毒が拡散する";
      }
      if (fire && s.targeting === "single") {
        addStatus(s, { status: "poison", magnitude: scale(4, boost), duration: 30 });
        if (s.id === "flame_slash") s.name = "延焼斬り";
        s.fieldNote = "🌲 延焼斬り：火傷に毒を呼ぶ";
      }
      if (healish) {
        const r = findStatus(s, "regen");
        if (r) r.magnitude = scale(r.magnitude + 1, boost);
        else addStatus(s, { status: "regen", magnitude: scale(3, boost), duration: 25, toAllies: hasTag(s, "support") });
        s.fieldNote = "🌲 森の癒やし：再生が宿る";
      }
      break;
    }
    case "thunder": {
      if (hasTag(s, "haste")) {
        const h = findStatus(s, "haste");
        if (h) h.magnitude += 3;
        s.fieldNote = "⛈️ 雷雲：加速が増幅";
      }
      if (hasTag(s, "attack") && s.power > 0) {
        s.power = +(s.power * 1.3).toFixed(2);
        s.fieldNote = "⛈️ 追撃：威力上昇（ただし戦場全体の防御が下がる）";
      }
      break;
    }
    case "ruins": {
      if (defensive && s.shield) {
        s.shield = Math.round(s.shield * 1.3);
        s.fieldNote = "🏛️ 遺跡：守りに反射が宿る（シールド+30%）";
      }
      if ((hasTag(s, "execute") || (hasTag(s, "attack") && s.power >= 2)) && s.power > 0) {
        s.pierce = true;
        s.fieldNote = "🏛️ 貫通：防御を無視して撃ち抜く";
      }
      break;
    }
    case "sanctuary": {
      if (healish) {
        if (s.heal) s.heal = +(s.heal * 1.3).toFixed(2);
        const r = findStatus(s, "regen");
        if (r) r.magnitude = scale(r.magnitude + 1, boost);
        s.fieldNote = "⛩️ 霊場：回復が増幅（+30%）";
      }
      if (hasTag(s, "curse")) {
        const c = findStatus(s, "curse");
        if (c) c.magnitude += 15;
        s.fieldNote = "⛩️ 霊場：呪いが濃くなる";
      }
      break;
    }
  }
  return s;
}

/** フィールド由来の、両陣営共通のステータス補正。 */
export function fieldStatMods(field: FieldId): { spdMult: number; defMult: number } {
  switch (field) {
    case "thunder":
      return { spdMult: 1.15, defMult: 0.9 };
    case "rain":
      return { spdMult: 0.95, defMult: 1.05 };
    case "ruins":
      return { spdMult: 1, defMult: 1.1 };
    default:
      return { spdMult: 1, defMult: 1 };
  }
}

/** フィールドが「倒れても一度だけ蘇る」保険を与えるか（霊場）。 */
export function fieldGrantsRevive(field: FieldId): boolean {
  return field === "sanctuary";
}
