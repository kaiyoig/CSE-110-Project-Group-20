import { Difficulty } from "../score";
import { getQuestion } from "../questions/QuestionGenerator";
import type { Question } from "../questions/Question";

/**
 * One wire on the power box: a Question from the QuestionGenerator on the
 * left (its equation) and that Question's answer on the right.
 */
export interface PowerBoxPair {
  question: Question;
}

/** Where the Questions come from. Defaults to getQuestion; tests pass a fixed list. */
export type QuestionSource = (difficulty: Difficulty) => Question;

/** Returns a number in [0, 1), like Math.random. Passed in so tests can be repeatable. */
export type RandomFn = () => number;

/** How many wires (equations) the power box has at each Difficulty. */
export const PAIR_COUNT: Record<Difficulty, number> = {
  [Difficulty.Easy]: 3,
  [Difficulty.Medium]: 4,
  [Difficulty.Hard]: 5,
};

/** Gives up after this many Questions if it still can't find enough different answers. */
const MAX_ATTEMPTS = 1000;

/**
 * Gets the Questions for one power box from the QuestionGenerator. No two
 * Questions share an answer, so each equation has exactly one matching value.
 */
export function generatePairs(
  difficulty: Difficulty,
  makeQuestion: QuestionSource = getQuestion,
): PowerBoxPair[] {
  const count = PAIR_COUNT[difficulty];
  const pairs: PowerBoxPair[] = [];
  const usedAnswers = new Set<string>();

  for (let attempt = 0; pairs.length < count; attempt++) {
    if (attempt >= MAX_ATTEMPTS) {
      throw new Error(`Could not get ${count} Questions with different answers`);
    }
    const question = makeQuestion(difficulty);
    const answer = question.answer.trim();
    if (usedAnswers.has(answer)) continue;
    usedAnswers.add(answer);
    pairs.push({ question });
  }
  return pairs;
}

/**
 * The order the answers appear in on the right side: a shuffle of
 * 0..count-1 that never leaves every answer straight across from its equation.
 * It shuffles once (no retry loop), so even a bad `random` can't make it hang.
 */
export function shuffledOrder(count: number, random: RandomFn = Math.random): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  if (count < 2) return order;
  // Fisher–Yates shuffle
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Landed on the original order: shift everything by one, which is never the original.
  if (order.every((value, index) => value === index)) {
    order.push(order.shift()!);
  }
  return order;
}
