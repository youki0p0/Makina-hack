import { ITEMS } from "@/data/items";
import { rollDice } from "@/lib/dice";
import type { DiceValue, Equipment } from "@/types/game";

// ===== prizes =====

const CASINO_PRIZES = ITEMS.filter((i) => i.casinoOnly);

export function randomCasinoPrize(): Equipment {
  const pick = CASINO_PRIZES[Math.floor(Math.random() * CASINO_PRIZES.length)];
  return { ...pick };
}

// ===== dice slots =====

export interface SlotResult {
  reels: [DiceValue, DiceValue, DiceValue];
  /** Gold payout (already net of the bet, i.e. winnings only). */
  payout: number;
  /** Whether a special prize item is awarded. */
  prize: boolean;
  label: string;
}

export function spinSlots(bet: number): SlotResult {
  const reels: [DiceValue, DiceValue, DiceValue] = [rollDice(), rollDice(), rollDice()];
  const [a, b, c] = reels;
  const allSame = a === b && b === c;
  const pair = a === b || b === c || a === c;

  if (allSame && a === 6) {
    return { reels, payout: bet * 20, prize: true, label: "🎉 ジャックポット！" };
  }
  if (allSame) {
    return { reels, payout: bet * 8, prize: false, label: "トリプル！" };
  }
  if (pair) {
    return { reels, payout: bet * 2, prize: false, label: "ペア" };
  }
  return { reels, payout: 0, prize: false, label: "ハズレ" };
}

// ===== dice blackjack =====

export const BJ_TARGET = 21;
export const DEALER_STAND = 17;

export function bjTotal(dice: number[]): number {
  return dice.reduce((sum, d) => sum + d, 0);
}

export function drawDie(): DiceValue {
  return rollDice();
}

/** Dealer draws until reaching DEALER_STAND or busting. */
export function dealerPlay(start: number[]): number[] {
  const dice = [...start];
  while (bjTotal(dice) < DEALER_STAND) {
    dice.push(rollDice());
  }
  return dice;
}

export type BjOutcome = "win" | "lose" | "push";

export function bjResolve(player: number[], dealer: number[]): BjOutcome {
  const p = bjTotal(player);
  const d = bjTotal(dealer);
  if (p > BJ_TARGET) return "lose";
  if (d > BJ_TARGET) return "win";
  if (p > d) return "win";
  if (p < d) return "lose";
  return "push";
}

/** Double-up: true if a die roll matches the player's hi/lo guess. */
export function doubleUp(guessHigh: boolean): { die: DiceValue; won: boolean } {
  const die = rollDice();
  const isHigh = die >= 4;
  return { die, won: guessHigh ? isHigh : !isHigh };
}
