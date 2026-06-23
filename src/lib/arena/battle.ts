import { getCard, isEquipment, isSkill } from "@/data/arena/cards";
import { SKILLS } from "@/data/arena/cards";
import { getMonster, MONSTERS } from "@/data/arena/monsters";
import { getOperator } from "@/data/arena/operators";
import {
  fieldGrantsRevive,
  fieldStatMods,
  fieldTransform,
} from "@/lib/arena/fieldTransform";
import { computeSynergies } from "@/lib/arena/synergy";
import { applyBlessings } from "@/lib/arena/blessings";
import type {
  BattleFrame,
  BattleResult,
  EffectiveSkill,
  FieldId,
  GameMode,
  MonsterBuild,
  MonsterColor,
  SkillCard,
  StatusType,
  TeamMods,
  UnitSnapshot,
} from "@/types/arena";

// ---- 軽量な決定論 RNG（同じラウンドなら同じ展開） ----
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface StatusInst {
  type: StatusType;
  mag: number;
  dur: number;
}

interface Combatant {
  uid: string;
  name: string;
  emoji: string;
  side: "ally" | "enemy";
  slot: number;
  maxHp: number;
  hp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  crit: number;
  reflectPct: number;
  regenFlat: number;
  dmgTakenMult: number;
  focusPowerMult: number;
  skills: EffectiveSkill[];
  skillTimer: number[];
  attackTimer: number;
  statuses: StatusInst[];
  shield: number;
  alive: boolean;
  revive: boolean;
  dealt: number; // 与えた総ダメージ（MVP集計用）
}

// 1戦のうちで最初に倒れたユニット（勝因/敗因サマリ用）。simulateBattle 開始時にリセット。
let firstDown: { name: string; side: "ally" | "enemy" } | null = null;

const MAX_TICKS = 420;

function sumStatus(c: Combatant, t: StatusType): number {
  return c.statuses.filter((s) => s.type === t).reduce((a, s) => a + s.mag, 0);
}
const hasStatus = (c: Combatant, t: StatusType) => c.statuses.some((s) => s.type === t);

function effSpeed(c: Combatant): number {
  return Math.max(1, c.baseSpeed + sumStatus(c, "haste"));
}
function effAttack(c: Combatant): number {
  return c.baseAttack + sumStatus(c, "atkUp");
}
function effDefense(c: Combatant): number {
  return Math.max(0, c.baseDefense - sumStatus(c, "defDown"));
}
function attackInterval(c: Combatant): number {
  return Math.max(4, Math.round(100 / effSpeed(c)));
}

function addStatus(c: Combatant, type: StatusType, mag: number, dur: number) {
  c.statuses.push({ type, mag, dur });
}

function snapshot(units: Combatant[]): UnitSnapshot[] {
  return units.map((u) => ({
    uid: u.uid,
    name: u.name,
    emoji: u.emoji,
    side: u.side,
    slot: u.slot,
    hp: Math.max(0, Math.round(u.hp)),
    maxHp: u.maxHp,
    alive: u.alive,
    shield: Math.round(u.shield),
    statuses: Array.from(new Set(u.statuses.map((s) => s.type))),
  }));
}

/** ダメージ適用（防御・呪い・シールド・反射を処理）。返り値は反射ダメージ。 */
function dealDamage(
  attacker: Combatant,
  target: Combatant,
  raw: number,
  pierce: boolean,
  events: string[],
): void {
  if (!target.alive) return;
  let dmg = pierce ? raw : Math.max(1, raw - effDefense(target));
  const curse = sumStatus(target, "curse");
  if (curse > 0) dmg *= 1 + curse / 100;
  dmg *= target.dmgTakenMult;
  dmg = Math.round(dmg);

  // シールドで吸収
  const before = dmg;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    dmg -= absorbed;
  }
  if (dmg > 0) target.hp -= dmg;
  attacker.dealt += before; // 与ダメ集計（シールド込みの貢献）

  // 反射（DoT ではない直接攻撃のみ）
  if (target.reflectPct > 0 && attacker.alive && attacker !== target) {
    const ref = Math.round((raw * target.reflectPct) / 100);
    if (ref > 0) {
      attacker.hp -= ref;
      events.push(`🪞 ${target.name} が ${ref} を反射`);
      checkDeath(attacker, events);
    }
  }
  checkDeath(target, events);
}

function checkDeath(c: Combatant, events: string[]) {
  if (c.alive && c.hp <= 0) {
    if (c.revive) {
      c.revive = false;
      c.hp = Math.round(c.maxHp * 0.4);
      c.statuses = [];
      events.push(`⛩️ ${c.name} が一度だけ蘇った！`);
    } else {
      c.alive = false;
      c.hp = 0;
      events.push(`💀 ${c.name} が倒れた`);
      if (firstDown === null) firstDown = { name: c.name, side: c.side };
    }
  }
}

function livingFoes(all: Combatant[], side: "ally" | "enemy") {
  return all.filter((c) => c.alive && c.side !== side);
}
function livingAllies(all: Combatant[], side: "ally" | "enemy") {
  return all.filter((c) => c.alive && c.side === side);
}

function chooseTarget(
  foes: Combatant[],
  mode: "front" | "lowest",
): Combatant | null {
  if (foes.length === 0) return null;
  const taunters = foes.filter((f) => hasStatus(f, "taunt"));
  if (mode === "front") {
    const pool = taunters.length > 0 ? taunters : foes;
    return [...pool].sort((a, b) => a.slot - b.slot)[0];
  }
  // lowest HP ratio
  return [...foes].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
}

// ---- ビルド → 戦闘ユニット ----
function buildAllies(
  builds: MonsterBuild[],
  operatorId: string,
  field: FieldId,
  mods: TeamMods,
): Combatant[] {
  const op = getOperator(operatorId);
  const boost =
    op.passive.favoredField === field ? op.passive.fieldTransformBoost ?? 0 : 0;
  const fStat = fieldStatMods(field);
  const allies: Combatant[] = [];

  builds.forEach((b, slot) => {
    const m = getMonster(b.monsterId);
    if (!m) return;

    let hp = m.hp;
    let attack = m.attack;
    let defense = m.defense;
    let speed = m.speed;
    let reflect = 0;
    let regen = 0;
    let crit = 5;
    let equipRevive = false;

    for (const id of b.equipmentIds) {
      const c = getCard(id);
      if (!c || !isEquipment(c)) continue;
      hp += c.hp ?? 0;
      attack += c.attack ?? 0;
      defense += (c.defense ?? 0) + (op.passive.equipDefenseBoost ?? 0);
      speed += c.speed ?? 0;
      reflect += c.reflectPct ?? 0;
      regen += c.regen ?? 0;
      crit += c.critAdd ?? 0;
      if (c.grantRevive) equipRevive = true;
    }

    const skillCards = b.skillIds
      .map((id) => getCard(id))
      .filter((c): c is SkillCard => !!c && isSkill(c));
    const focused = skillCards.length >= 3;
    let focusPowerMult = 1;
    let dmgTakenMult = 1;
    if (focused) {
      focusPowerMult = 1.4 + (op.passive.focusPowerBoost ?? 0);
      dmgTakenMult = 1.1;
    }

    // 色 CT 短縮（オペレーター）
    let unitCdMult = mods.cdMult;
    if (op.passive.colorCdReduce && op.passive.colorCdReduce.color === m.color) {
      unitCdMult *= 1 - op.passive.colorCdReduce.pct;
    }

    const skills: EffectiveSkill[] = skillCards.map((sc) =>
      fieldTransform(sc, field, boost),
    );

    const c: Combatant = {
      uid: `ally-${slot}-${m.id}`,
      name: m.name,
      emoji: m.emoji,
      side: "ally",
      slot,
      maxHp: Math.round((hp * mods.hpMult)),
      hp: 0,
      baseAttack: Math.round((attack + 0) * mods.atkMult),
      baseDefense: Math.round((defense) * mods.defMult * fStat.defMult),
      baseSpeed: Math.max(1, Math.round(speed * mods.spdMult * fStat.spdMult)),
      crit: crit + mods.critAdd,
      reflectPct: reflect,
      regenFlat: regen + mods.regenAdd,
      dmgTakenMult,
      focusPowerMult,
      skills,
      skillTimer: skills.map((s) =>
        Math.max(10, Math.round(s.cooldown * unitCdMult * 0.6)),
      ),
      attackTimer: Math.max(4, Math.round(100 / Math.max(1, speed))),
      statuses: [],
      shield: mods.shieldStart,
      alive: true,
      revive: fieldGrantsRevive(field) || equipRevive || mods.reviveOnce,
      dealt: 0,
    };
    c.hp = c.maxHp;
    // CT 倍率を後で再利用するため skillTimer に反映済み（リセット時も同倍率）
    (c as Combatant & { cdMult: number }).cdMult = unitCdMult;
    allies.push(c);
  });

  return allies;
}

const ENEMY_SKILL_POOL = [
  "flame_slash",
  "heavy_blow",
  "area_blast",
  "chain_thunder",
  "venom_bite",
  "pinpoint",
  "dark_bolt",
  "guard_stance",
];

/** 5の倍数ラウンドはボス戦。 */
export function isBossRound(round: number): boolean {
  return round % 5 === 0;
}

function buildEnemies(
  round: number,
  field: FieldId,
  rng: () => number,
): Combatant[] {
  const enemies: Combatant[] = [];
  // 敵も色シナジーを持つ（赤=攻撃 / 緑=再生 / 青=速度）。読み合いを深くする。
  const ecolors = [0, 1, 2].map((s) => MONSTERS[(round * 3 + s) % MONSTERS.length].color);
  const cnt = (c: MonsterColor) => ecolors.filter((x) => x === c).length;
  const eAtkMult = 1 + cnt("red") * 0.04;
  const eSpdMult = 1 + cnt("blue") * 0.04;
  const eRegen = cnt("green") * 2;
  for (let slot = 0; slot < 3; slot++) {
    const st = enemyStat(round, field, slot);
    const m = st.m;
    const skills: EffectiveSkill[] = [];
    for (let i = 0; i < st.nSkills; i++) {
      const id = ENEMY_SKILL_POOL[Math.floor(rng() * ENEMY_SKILL_POOL.length)];
      const base = SKILLS.find((s) => s.id === id);
      if (base) skills.push(fieldTransform(base, field, 0));
    }
    const c: Combatant = {
      uid: `enemy-${slot}-${m.id}`,
      name: st.bossLead ? `【ボス】${m.name}` : m.name,
      emoji: st.bossLead ? "👑" : m.emoji,
      side: "enemy",
      slot,
      maxHp: st.maxHp,
      hp: 0,
      baseAttack: Math.round(st.attack * eAtkMult),
      baseDefense: st.defense,
      baseSpeed: Math.max(1, Math.round(st.speed * eSpdMult)),
      crit: 5,
      reflectPct: 0,
      regenFlat: eRegen,
      dmgTakenMult: 1,
      focusPowerMult: 1,
      skills,
      skillTimer: skills.map((s) => Math.max(12, Math.round(s.cooldown * 0.8))),
      attackTimer: Math.max(4, Math.round(100 / Math.max(1, st.speed * eSpdMult))),
      statuses: [],
      shield: 0,
      alive: true,
      revive: fieldGrantsRevive(field),
      dealt: 0,
    };
    c.hp = c.maxHp;
    (c as Combatant & { cdMult: number }).cdMult = 1;
    enemies.push(c);
  }
  return enemies;
}

/** 敵1体の決定論ステータス（戦闘とプレビューで共有）。 */
export function enemyStat(round: number, field: FieldId, slot: number) {
  const boss = isBossRound(round);
  const sf = (1 + (round - 1) * 0.2) * (boss ? 1.25 : 1);
  const fStat = fieldStatMods(field);
  const nSkills = boss ? 3 : round < 3 ? 1 : round < 9 ? 2 : 3;
  const m = MONSTERS[(round * 3 + slot) % MONSTERS.length];
  const bossLead = boss && slot === 1;
  const lead = bossLead ? 1.6 : 1;
  return {
    m,
    boss,
    bossLead,
    nSkills,
    maxHp: Math.round(m.hp * sf * 1.05 * lead),
    attack: Math.round(m.attack * sf * (bossLead ? 1.2 : 1)),
    defense: Math.round(m.defense * sf * fStat.defMult * (bossLead ? 1.3 : 1)),
    speed: Math.max(1, Math.round(m.speed * fStat.spdMult)),
  };
}

export interface EnemyPreviewUnit {
  id: string;
  name: string;
  emoji: string;
  color: MonsterColor;
  boss: boolean;
  threat: string; // 脅威の一言ヒント
}

/** 次に戦う敵編成のプレビュー（色・脅威・ボス有無のみ。詳細ステータスは伏せる）。 */
export function previewEnemies(round: number, field: FieldId): EnemyPreviewUnit[] {
  const threatOf = (color: MonsterColor) =>
    color === "red" ? "🔥 火力" : color === "green" ? "🛡️ 耐久/毒" : "💨 速さ/妨害";
  const out: EnemyPreviewUnit[] = [];
  for (let slot = 0; slot < 3; slot++) {
    const st = enemyStat(round, field, slot);
    out.push({
      id: st.m.id,
      name: st.bossLead ? `【ボス】${st.m.name}` : st.m.name,
      emoji: st.bossLead ? "👑" : st.m.emoji,
      color: st.m.color,
      boss: st.bossLead,
      threat: st.bossLead ? "👑 強大" : threatOf(st.m.color),
    });
  }
  return out;
}

function applySkillStatuses(
  caster: Combatant,
  primary: Combatant | null,
  all: Combatant[],
  skill: EffectiveSkill,
  mods: TeamMods,
  events: string[],
) {
  if (!skill.apply) return;
  const foes = livingFoes(all, caster.side);
  const allies = livingAllies(all, caster.side);
  for (const a of skill.apply) {
    const buff = a.status === "regen" || a.status === "haste" || a.status === "atkUp";
    if (buff || a.toAllies) {
      const targets = a.toAllies ? allies : [caster];
      for (const t of targets) addStatus(t, a.status, a.magnitude, a.duration);
    } else {
      // デバフ：aoe / 毒拡散なら全体、そうでなければ主対象
      const spread =
        a.aoe || (a.status === "poison" && (mods.poisonSpread || skill.tags.includes("poison") && skill.targeting === "area"));
      const targets = spread ? foes : primary ? [primary] : [];
      for (const t of targets) addStatus(t, a.status, a.magnitude, a.duration);
    }
  }
}

function castSkill(
  caster: Combatant,
  skill: EffectiveSkill,
  all: Combatant[],
  mods: TeamMods,
  rng: () => number,
  events: string[],
) {
  const blindChance = sumStatus(caster, "blind");
  const isOffense = skill.power > 0;
  if (isOffense && blindChance > 0 && rng() * 100 < blindChance) {
    events.push(`🌑 ${caster.name} の${skill.name}はミス`);
    return;
  }

  const critMult = rng() * 100 < caster.crit ? 1.6 : 1;
  const atk = effAttack(caster);

  // 回復 / シールド系
  if (skill.heal && skill.heal > 0) {
    const amount = Math.round(atk * skill.heal * mods.healMult);
    const targets =
      skill.targeting === "self" ? [caster] : livingAllies(all, caster.side);
    for (const t of targets) {
      t.hp = Math.min(t.maxHp, t.hp + amount);
    }
    events.push(`✨ ${caster.name} の${skill.name}で味方を ${amount} 回復`);
  }
  if (skill.shield && skill.shield > 0) {
    const targets =
      skill.targeting === "allies" ? livingAllies(all, caster.side) : [caster];
    for (const t of targets) t.shield += skill.shield;
    events.push(`🛡️ ${caster.name} の${skill.name}（シールド+${skill.shield}）`);
  }

  // ダメージ系
  let primary: Combatant | null = null;
  if (isOffense) {
    const foes = livingFoes(all, caster.side);
    if (foes.length === 0) return;
    // レア度で威力に差（量より質：コモン乱発を抑え、強カードの価値を上げる）
    const rf = skill.rarity === 1 ? 0.9 : skill.rarity === 3 ? 1.15 : 1;
    const baseRaw = atk * skill.power * critMult * caster.focusPowerMult * rf;

    if (skill.targeting === "area") {
      for (const f of foes) dealDamage(caster, f, Math.round(baseRaw * 0.9), !!skill.pierce, events);
      primary = foes[0];
      events.push(`💥 ${caster.name} の${skill.name}が敵全体を直撃`);
    } else if (skill.targeting === "execute") {
      const t = chooseTarget(foes, "lowest");
      if (t) {
        let raw = baseRaw;
        if (t.hp / t.maxHp < 0.35) raw *= 1.6;
        dealDamage(caster, t, Math.round(raw), !!skill.pierce, events);
        primary = t;
        events.push(`🎯 ${caster.name} の${skill.name}が ${t.name} を狙撃`);
      }
    } else if (skill.targeting === "lowest") {
      const t = chooseTarget(foes, "lowest");
      if (t) {
        dealDamage(caster, t, Math.round(baseRaw), !!skill.pierce, events);
        primary = t;
        events.push(`⚔️ ${caster.name} の${skill.name}（${t.name}へ）`);
      }
    } else {
      // single（splash あり得る）
      const t = chooseTarget(foes, "front");
      if (t) {
        dealDamage(caster, t, Math.round(baseRaw), !!skill.pierce, events);
        primary = t;
        if (skill.splash && skill.splash > 0) {
          for (const f of foes) {
            if (f !== t)
              dealDamage(caster, f, Math.round(baseRaw * skill.splash), !!skill.pierce, events);
          }
        }
        events.push(`🔥 ${caster.name} の${skill.name}（${t.name}へ）`);
      }
    }
  }

  applySkillStatuses(caster, primary, all, skill, mods, events);
}

function basicAttack(
  caster: Combatant,
  all: Combatant[],
  rng: () => number,
  events: string[],
) {
  const blindChance = sumStatus(caster, "blind");
  if (blindChance > 0 && rng() * 100 < blindChance) {
    events.push(`🌑 ${caster.name} の攻撃はミス`);
    return;
  }
  const foes = livingFoes(all, caster.side);
  const t = chooseTarget(foes, "front");
  if (!t) return;
  const critMult = rng() * 100 < caster.crit ? 1.6 : 1;
  const raw = Math.round(effAttack(caster) * critMult);
  dealDamage(caster, t, raw, false, events);
  if (critMult > 1) events.push(`✨ ${caster.name} のクリティカル！`);
}

/** 状態異常の経過処理（毎秒の DoT / 再生）。 */
function tickStatuses(all: Combatant[], mods: TeamMods, isSecond: boolean, events: string[]) {
  for (const c of all) {
    if (!c.alive) continue;
    if (isSecond) {
      const burn = sumStatus(c, "burn") + (sumStatus(c, "burn") > 0 ? mods.burnBonus : 0);
      const poison = sumStatus(c, "poison");
      if (burn > 0) {
        c.hp -= burn;
        events.push(`🔥 ${c.name} は火傷で ${burn} 受けた`);
      }
      if (poison > 0) {
        let p = poison;
        // 毒炎：毒状態の敵に火傷追加（味方シナジー → 敵にのみ適用）
        if (mods.poisonBurn && c.side === "enemy") p += 3;
        c.hp -= p;
        events.push(`☠️ ${c.name} は毒で ${p} 受けた`);
      }
      const regen = sumStatus(c, "regen") + (c.side === "ally" ? c.regenFlat : 0);
      if (regen > 0 && c.hp > 0) {
        c.hp = Math.min(c.maxHp, c.hp + regen);
      }
      checkDeath(c, events);
    }
    // 持続時間を1減らし、切れたものを除去
    c.statuses = c.statuses
      .map((s) => ({ ...s, dur: s.dur - 1 }))
      .filter((s) => s.dur > 0);
  }
}

export function simulateBattle(
  builds: MonsterBuild[],
  operatorId: string,
  field: FieldId,
  round: number,
  _mode: GameMode,
  blessings: string[] = [],
): BattleResult {
  const { mods } = computeSynergies(builds, operatorId);
  applyBlessings(mods, blessings);
  firstDown = null; // 1戦ごとにリセット
  const rng = mulberry32(round * 2654435761 + builds.length * 40503 + 7);

  const allies = buildAllies(builds, operatorId, field, mods);
  const enemies = buildEnemies(round, field, rng);
  const all = [...allies, ...enemies];

  const frames: BattleFrame[] = [];
  const log: string[] = [];

  const boss = isBossRound(round);
  const startMsg = boss ? `👑 ボス戦！（${round}回戦）` : `⚔️ 戦闘開始（${round}回戦）`;
  frames.push({ tick: 0, units: snapshot(all), events: [startMsg] });
  log.push(startMsg);

  let reason: "wipe" | "timeout" = "timeout";

  for (let tick = 1; tick <= MAX_TICKS; tick++) {
    const events: string[] = [];
    const isSecond = tick % 10 === 0;

    tickStatuses(all, mods, isSecond, events);

    // 行動（味方→敵のスロット順。タイマーは速度を反映）
    for (const c of all) {
      if (!c.alive) continue;
      c.attackTimer -= 1;
      for (let i = 0; i < c.skillTimer.length; i++) c.skillTimer[i] -= 1;

      // 発動可能な技のうち最も威力の高いものを優先
      let bestIdx = -1;
      let bestPower = -1;
      for (let i = 0; i < c.skills.length; i++) {
        if (c.skillTimer[i] <= 0) {
          const pw = c.skills[i].power + (c.skills[i].heal ?? 0) * 0.5 + (c.skills[i].shield ?? 0) * 0.01;
          if (pw > bestPower) {
            bestPower = pw;
            bestIdx = i;
          }
        }
      }
      if (bestIdx >= 0) {
        const skill = c.skills[bestIdx];
        castSkill(c, skill, all, mods, rng, events);
        const cdMult = (c as Combatant & { cdMult: number }).cdMult ?? 1;
        c.skillTimer[bestIdx] = Math.max(12, Math.round(skill.cooldown * cdMult));
      } else if (c.attackTimer <= 0) {
        basicAttack(c, all, rng, events);
        c.attackTimer = attackInterval(c);
      }

      // 即時決着チェック
      if (livingFoes(all, "enemy").length === 0 || livingFoes(all, "ally").length === 0) break;
    }

    if (events.length > 0 || isSecond) {
      frames.push({ tick, units: snapshot(all), events });
      for (const e of events) log.push(e);
    }

    const alliesLeft = livingAllies(all, "ally").length;
    const enemiesLeft = livingAllies(all, "enemy").length;
    if (alliesLeft === 0 || enemiesLeft === 0) {
      reason = "wipe";
      break;
    }
  }

  const allyHpLeft = allies.reduce((a, c) => a + Math.max(0, c.hp), 0);
  const enemyHpLeft = enemies.reduce((a, c) => a + Math.max(0, c.hp), 0);
  const enemiesAlive = enemies.some((c) => c.alive);

  let win: boolean;
  if (reason === "wipe") {
    win = !enemiesAlive;
  } else {
    win = allyHpLeft >= enemyHpLeft;
  }

  const endMsg = win ? "🏆 勝利！" : "❌ 敗北…";
  frames.push({ tick: MAX_TICKS, units: snapshot(all), events: [endMsg] });
  log.push(endMsg);

  const topAlly = allies.reduce<Combatant | null>(
    (best, c) => (best === null || c.dealt > best.dealt ? c : best),
    null,
  );
  const mvp =
    topAlly && topAlly.dealt > 0
      ? { name: topAlly.name, dealt: Math.round(topAlly.dealt) }
      : null;

  return {
    win,
    reason,
    frames,
    log,
    allyHpLeft,
    enemyHpLeft,
    field,
    round,
    boss,
    mvp,
    firstDown,
  };
}
