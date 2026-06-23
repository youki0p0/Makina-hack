import { hashSeed } from "@/lib/hashSeed";

export interface DailyBonus {
  id: string;
  label: string;
  stat: "attack" | "defense" | "reroll" | "gold";
  value: number;
}

const OPTIONS: DailyBonus[] = [
  { id: "atk", label: "攻撃 +3", stat: "attack", value: 3 },
  { id: "def", label: "防御 +3", stat: "defense", value: 3 },
  { id: "reroll", label: "リロール +1", stat: "reroll", value: 1 },
  { id: "gold", label: "ゴールド +25%", stat: "gold", value: 25 },
];

export function todaySeed(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** A deterministic daily bonus based on the date (changes each day). */
export function getDailyBonus(seed: string = todaySeed()): DailyBonus {
  return OPTIONS[hashSeed(seed) % OPTIONS.length];
}
