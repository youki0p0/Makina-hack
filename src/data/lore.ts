// ===== Narrative content (ending / endless / 神機マキナ) =====
// The story beats of Dice Ex Machina. Kept here so docs/lore.md and the UI stay
// in sync — this file is the single source of truth for the words.

/** Staff roll shown after defeating DEUS EX MACHINA on floor 1000. */
export const ENDING_STAFF_ROLL: readonly string[] = [
  "DEUS EX MACHINA 撃破",
  "",
  "記録の終端を確認しました。",
  "",
  "これより先の領域は、",
  "想定されていません。",
  "",
  "あなたはここで",
  "終わることもできます。",
  "",
  "あるいは……",
  "",
  "全てを失い、",
  "再び始めますか？",
];

/** The unskippable YES/NO prompt at the end of the staff roll. */
export const ENDING_PROMPT = {
  yes: "はい（強くてニューゲーム）",
  no: "いいえ（Endless Abyssへ）",
};

/** Shown on the YES route — 強くてニューゲーム. */
export const NG_PLUS_SEQUENCE: readonly string[] = [
  "全てを失った。",
  "",
  "初期化完了",
  "",
  "識別番号",
  "Makina-0001",
  "",
  "再起動します",
  "",
  "神機マキナを付与する。",
];

/** Endless-Abyss story lines, shown once each at the given floor (NO route). */
export const ENDLESS_MESSAGES: readonly { floor: number; text: string }[] = [
  { floor: 1050, text: "まだいましたか。" },
  { floor: 1100, text: "私は、あなたはここで終わるものだと思っていました。" },
  { floor: 1150, text: "それでもなお、先へ進むのですね。" },
  { floor: 1200, text: "理解できません。ですが、嫌いではありません。" },
  {
    floor: 1250,
    text: "……\n（数秒沈黙）\nそれでは。続きを始めましょう。\nここで神機マキナを授与する。\n以後、システムメッセージは二度と発生しない。",
  },
];

/** The floor at which the NO route grants 神機マキナ. */
export const MAKINA_FLOOR = 1250;

/** Title id awarded for witnessing the ending / completing NG+. */
export const ENDING_TITLE_ID = "makina_0001";
