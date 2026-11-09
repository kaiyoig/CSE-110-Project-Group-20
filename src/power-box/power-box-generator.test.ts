import { describe, it, expect } from "vitest";
import { Difficulty } from "../score";
import type { Question } from "../questions/Question";
import {
  generatePairs,
  shuffledOrder,
  PAIR_COUNT,
  type QuestionSource,
  type RandomFn,
} from "./power-box-generator";

/** A repeatable stand-in for Math.random (a small linear congruential generator). */
function seeded(seed: number): RandomFn {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** Hands out the given Questions in order, and remembers the difficulty it was asked for. */
function fixedQuestions(questions: Question[]): QuestionSource & { asked: Difficulty[] } {
  let next = 0;
  const source = ((difficulty: Difficulty) => {
    source.asked.push(difficulty);
    return questions[next++ % questions.length];
  }) as QuestionSource & { asked: Difficulty[] };
  source.asked = [];
  return source;
}

const q = (prompt: string, answer: string): Question => ({ prompt, answer });

const ALL = [Difficulty.Easy, Difficulty.Medium, Difficulty.Hard];

describe("generatePairs", () => {
  it("uses 3 / 4 / 5 wires for Easy / Medium / Hard", () => {
    expect(PAIR_COUNT).toEqual({ [Difficulty.Easy]: 3, [Difficulty.Medium]: 4, [Difficulty.Hard]: 5 });
  });

  it.each(ALL)("asks the QuestionGenerator at the box's difficulty (%s)", (difficulty: Difficulty) => {
    const source = fixedQuestions([q("x + 1 = 2", "1"), q("x + 1 = 3", "2"), q("x + 1 = 4", "3"), q("x + 1 = 5", "4"), q("x + 1 = 6", "5")]);

    const pairs = generatePairs(difficulty, source);

    expect(pairs).toHaveLength(PAIR_COUNT[difficulty]);
    expect(source.asked.every((d) => d === difficulty)).toBe(true);
  });

  it("keeps the Question's own prompt and answer", () => {
    const questions = [q("x * 2 + 3 = 11", "4"), q("x / 3 - 1 = 2", "9"), q("x * -5 + 2 = 12", "-2")];

    const pairs = generatePairs(Difficulty.Easy, fixedQuestions(questions));

    expect(pairs.map((p) => p.question)).toEqual(questions);
  });

  it("skips a Question whose answer is already on the box", () => {
    const source = fixedQuestions([q("x + 1 = 5", "4"), q("x * 2 = 8", "4"), q("x - 1 = 6", "7"), q("x + 2 = 3", "1")]);

    const answers = generatePairs(Difficulty.Easy, source).map((p) => p.question.answer);

    expect(answers).toEqual(["4", "7", "1"]);
  });

  it("works with the real QuestionGenerator: right count, all answers different", () => {
    for (const difficulty of ALL) {
      for (let i = 0; i < 50; i++) {
        const answers = generatePairs(difficulty).map((p) => p.question.answer);
        expect(answers).toHaveLength(PAIR_COUNT[difficulty]);
        expect(new Set(answers).size).toBe(answers.length);
      }
    }
  });

  it("throws instead of looping forever if every Question has the same answer", () => {
    expect(() => generatePairs(Difficulty.Easy, () => q("x = 1", "1"))).toThrow(Error);
  });
});

describe("shuffledOrder", () => {
  it("contains every row exactly once", () => {
    for (let seed = 1; seed <= 100; seed++) {
      expect([...shuffledOrder(5, seeded(seed))].sort()).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it("never leaves every answer straight across from its equation", () => {
    for (let seed = 1; seed <= 100; seed++) {
      expect(shuffledOrder(3, seeded(seed))).not.toEqual([0, 1, 2]);
    }
  });

  it("handles 0 and 1 rows", () => {
    expect(shuffledOrder(0)).toEqual([]);
    expect(shuffledOrder(1)).toEqual([0]);
  });
});
