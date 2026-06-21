// ===== Sound effects =====
// Short procedural blips for battle/UI and the slot machine, built on the
// engine's tone/noise/slide primitives.

import { noise, slideTone, tone } from "./engine";

export type Sfx =
  | "hit"
  | "hurt"
  | "crit"
  | "heal"
  | "select"
  | "roll"
  | "win"
  | "lose"
  | "coin";

export function sfx(kind: Sfx): void {
  switch (kind) {
    case "hit":
      tone(330, 0.07, "square", 0.28);
      tone(220, 0.06, "square", 0.2, 0.02);
      break;
    case "hurt":
      tone(140, 0.14, "sawtooth", 0.28);
      break;
    case "crit":
      noise(0.16, 0.22);
      tone(440, 0.1, "square", 0.3);
      tone(660, 0.1, "square", 0.25, 0.06);
      break;
    case "heal":
      tone(523, 0.1, "sine", 0.25);
      tone(784, 0.12, "sine", 0.25, 0.08);
      break;
    case "select":
      tone(520, 0.05, "square", 0.2);
      break;
    case "roll":
      tone(740, 0.04, "square", 0.15);
      tone(880, 0.04, "square", 0.15, 0.04);
      break;
    case "coin":
      tone(988, 0.05, "square", 0.2);
      tone(1319, 0.08, "square", 0.2, 0.05);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "square", 0.25, i * 0.12));
      break;
    case "lose":
      [392, 330, 262].forEach((f, i) => tone(f, 0.22, "triangle", 0.25, i * 0.16));
      break;
  }
}

// ===== Slot (パチスロ) SFX =====
// レバーON / リール停止 / 小役 / リーチ / ボーナス揃い。tone/noise/slideTone で合成。
export type SlotSfx = "lever" | "stop" | "small" | "reach" | "bonus" | "bonusBig" | "pan";

export function slotSfx(kind: SlotSfx): void {
  switch (kind) {
    case "pan": // 台パン: 筐体を殴る鈍い衝撃音
      noise(0.12, 0.4);
      slideTone(160, 50, 0.18, "square", 0.3);
      tone(60, 0.14, "sine", 0.3, 0.01);
      break;
    case "lever": // レバーを下げた「ガコッ」
      noise(0.05, 0.2);
      slideTone(240, 90, 0.13, "square", 0.26);
      tone(70, 0.08, "sine", 0.18, 0.01);
      break;
    case "stop": // リール停止の「ガコン」
      noise(0.03, 0.16);
      tone(180, 0.05, "square", 0.22);
      tone(110, 0.06, "square", 0.16, 0.01);
      break;
    case "small": // 小役の「ピロン↑」
      tone(880, 0.06, "square", 0.2);
      tone(1318, 0.1, "square", 0.2, 0.06);
      break;
    case "reach": // リーチの煽り(上昇サイレン)
      slideTone(400, 1200, 0.6, "sawtooth", 0.12);
      slideTone(404, 1212, 0.6, "sawtooth", 0.1, 0.0);
      noise(0.5, 0.05);
      break;
    case "bonus": // REGULAR 揃い ファンファーレ
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "square", 0.26, i * 0.1));
      break;
    case "bonusBig": // BIG(7/BAR) 揃い 大ファンファーレ
      noise(0.12, 0.18);
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        tone(f, 0.2, "square", 0.28, i * 0.09);
        tone(f * 1.005, 0.2, "square", 0.18, i * 0.09); // 厚み
      });
      tone(1047, 0.3, "square", 0.22, 0.5);
      tone(1319, 0.36, "square", 0.22, 0.56);
      break;
  }
}
