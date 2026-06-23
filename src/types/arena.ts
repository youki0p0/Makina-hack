// ===== Dice Arena (カードセット構築型 3v3 オートバトラー) の型定義 =====
// このゲームは Dice Ex Machina 本編とは独立した別ゲーム。本編の型/状態には
// 一切依存せず、すべて arena 名前空間に閉じる。localStorage キーも分離する。

/** モンスターの色（役割の大分類）。 */
export type MonsterColor = "green" | "blue" | "red";

/** フィールド ID（6種）。技の効果そのものを書き換える。 */
export type FieldId =
  | "forest"
  | "volcano"
  | "rain"
  | "thunder"
  | "ruins"
  | "sanctuary";

/** 技/装備に付くタグ。シナジー判定とフィールド変質の双方で使う。 */
export type SkillTag =
  | "attack"
  | "defense"
  | "heal"
  | "fire"
  | "poison"
  | "reflect"
  | "taunt"
  | "haste"
  | "regenerate"
  | "critical"
  | "area"
  | "single"
  | "execute"
  | "support"
  | "curse"
  | "blind"
  | "shield";

/** 戦闘中の状態異常 / バフ。 */
export type StatusType =
  | "burn"
  | "poison"
  | "regen"
  | "blind"
  | "haste"
  | "defDown"
  | "shield"
  | "taunt"
  | "curse"
  | "atkUp";

/** 技のターゲット方式。 */
export type TargetMode =
  | "single" // 正面の敵
  | "lowest" // HP割合が最も低い敵
  | "area" // 敵全体
  | "execute" // 低HP狙い＋処刑ボーナス
  | "self" // 自分
  | "allies"; // 味方全体

export type GameMode = "short" | "long";

// ---- データ定義（静的） ----

export interface MonsterDef {
  id: string;
  name: string;
  emoji: string;
  color: MonsterColor;
  role: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  /** 見分け用のドット絵パレット（CSS スプライト）。 */
  palette: [string, string, string];
  desc: string;
}

export interface StatusApply {
  status: StatusType;
  magnitude: number;
  duration: number;
  /** 敵全体に撒くか（毒霧など）。 */
  aoe?: boolean;
  /** 味方全体に付与するか（加速の号令など）。 */
  toAllies?: boolean;
}

interface CardCommon {
  id: string;
  name: string;
  emoji: string;
  rarity: 1 | 2 | 3;
  tags: SkillTag[];
  desc: string;
}

export interface EquipmentCard extends CardCommon {
  kind: "equipment";
  hp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  reflectPct?: number;
  regen?: number;
  critAdd?: number;
  grantRevive?: boolean; // 戦闘不能時に一度だけ蘇る保険を付与
}

export interface SkillCard extends CardCommon {
  kind: "skill";
  cooldown: number; // tick 単位
  targeting: TargetMode;
  power: number; // ダメージ = 攻撃 * power（0 で非ダメージ技）
  splash?: number; // 単体技の左右への波及割合
  heal?: number; // 回復 = 攻撃 * heal
  shield?: number; // 固定シールド
  apply?: StatusApply[];
}

export type Card = EquipmentCard | SkillCard;

/** フィールド変質後の実効スキル（UI 表示にも使う）。 */
export interface EffectiveSkill extends SkillCard {
  baseId: string;
  fieldNote?: string; // 「火山で噴火斬りに変化」等
  pierce?: boolean; // 防御無視（遺跡の重撃/貫通）
}

export interface FieldDef {
  id: FieldId;
  name: string;
  emoji: string;
  theme: string;
  background: string;
  accent: string;
  desc: string;
}

/** プレーヤーキャラ（モンスターを使役するオペレーター）。 */
export interface OperatorDef {
  id: string;
  name: string;
  title: string;
  emoji: string;
  palette: [string, string, string];
  concept: string;
  passiveName: string;
  passiveDesc: string;
  passive: OperatorPassive;
}

export interface OperatorPassive {
  /** 得意フィールド。そのフィールドで変質効果が強化される。 */
  favoredField?: FieldId;
  /** 得意フィールドでの追加倍率（火傷/毒の威力等）。 */
  fieldTransformBoost?: number;
  /** 指定色モンスターの技 CT を短縮（割合）。 */
  colorCdReduce?: { color: MonsterColor; pct: number };
  /** 装備の防御値を底上げ。 */
  equipDefenseBoost?: number;
  /** 技を3体に分散した時、戦闘開始時に全員へシールド。 */
  spreadShield?: number;
  /** 技を1体に集中した時、その威力を追加上昇（割合）。 */
  focusPowerBoost?: number;
}

// ---- シナジー ----

export interface SynergyView {
  id: string;
  name: string;
  emoji: string;
  desc: string;
}

export interface TeamMods {
  atkMult: number;
  defMult: number;
  hpMult: number;
  spdMult: number;
  cdMult: number;
  critAdd: number;
  regenAdd: number;
  burnBonus: number;
  healMult: number;
  poisonSpread: boolean;
  poisonBurn: boolean;
  reviveOnce: boolean;
  shieldStart: number;
}

// ---- 編成（ラウンドごとに育つビルド） ----

/** 1体のモンスターのビルド（装備IDと技ID）。 */
export interface MonsterBuild {
  monsterId: string;
  equipmentIds: string[];
  skillIds: string[];
}

export interface RunState {
  mode: GameMode;
  operatorId: string;
  builds: MonsterBuild[]; // 長さ3
  round: number;
  wins: number;
  losses: number;
  life: number;
  field: FieldId;
  draft: string[]; // 提示中カードID（横スクロールで閲覧）
  budget: number; // このラウンドで使えるコスト残量
  phase: RunPhase;
  lastResult: BattleResult | null;
  blessings: string[]; // 取得済み祝福ID（ラン内で永続・累積）
  pendingBlessings: string[]; // 勝利時に提示中の3択
}

export type RunPhase =
  | "setup"
  | "draft"
  | "battle"
  | "result"
  | "blessing"
  | "gameover"
  | "victory";

// ---- 戦闘 ----

export interface UnitSnapshot {
  uid: string;
  name: string;
  emoji: string;
  side: "ally" | "enemy";
  slot: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  shield: number;
  statuses: StatusType[];
}

export interface BattleFrame {
  tick: number;
  units: UnitSnapshot[];
  events: string[];
}

export interface BattleResult {
  win: boolean;
  reason: "wipe" | "timeout";
  frames: BattleFrame[];
  log: string[];
  allyHpLeft: number;
  enemyHpLeft: number;
  field: FieldId;
  round: number;
  boss: boolean;
  mvp: { name: string; dealt: number } | null; // 最大ダメージを出した味方
  firstDown: { name: string; side: "ally" | "enemy" } | null; // 最初に倒れたユニット
}

export interface RankRecord {
  bestWins: number;
  bestRound: number;
  games: number;
  wins: number;
}
