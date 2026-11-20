import { describe, it, expect, vi, afterEach } from 'vitest';
import { DIFFICULTY_WEIGHTS, getQuestion, getQuestionOfDifficulty, pickDifficulty } from './QuestionGenerator';
import { Question } from './Question';
import { Difficulty } from '../score';

const ANSWER_RANGE = 20; // must match ANSWER_RANGE in QuestionGenerator.ts
const MAX_FACTOR = 10; // must match MAX_FACTOR in QuestionGenerator.ts
const ITERATIONS = 1000;

const DIFFICULTIES = [
  ['Easy', Difficulty.Easy],
  ['Medium', Difficulty.Medium],
  ['Hard', Difficulty.Hard],
] as const;

// Easy:   x (* or /) factor = number      e.g. x * 3 = 21
//         x (+ or -) number = number      e.g. x + 4 = 5
// Medium: x (* or /) factor (+ or -) number = number                        e.g. x * 3 + 4 = 25
// Hard:   x (* or /) factor (+ or -) number = x (* or /) factor (+ or -) number   e.g. x * 5 + 4 = x * 2 + 13
const EASY_FACTOR_PATTERN = /^x [*/] -?\d+ = -?\d+$/;
const EASY_ADDITION_PATTERN = /^x [+-] \d+ = -?\d+$/;
const MEDIUM_PATTERN = /^x [*/] -?\d+ [+-] \d+ = -?\d+$/;
const HARD_PATTERN = /^x [*/] -?\d+ [+-] \d+ = x [*/] -?\d+ [+-] \d+$/;

// one side of an equation: "x", "x * 3", "x + 4", "x / -2 - 7", or a plain number
const SIDE_PATTERN = /^(?:x(?: ([*/]) (-?\d+))?(?: ([+-]) (\d+))?|(-?\d+))$/;

interface VarTerm {
  operator: '*' | '/';
  factor: number;
}

interface Side {
  hasX: boolean;
  varTerm: VarTerm | null; // null for a bare "x" or a side with no x
  constant: number; // signed; 0 when the side has no number
}

interface Equation {
  left: Side;
  right: Side;
}

function parseSide(text: string): Side {
  const match = text.match(SIDE_PATTERN);
  if (!match) {
    throw new Error(`side is not in the expected format: "${text}"`);
  }

  const [, operator, factor, sign, addedNumber, plainNumber] = match;

  if (plainNumber !== undefined) {
    return { hasX: false, varTerm: null, constant: Number(plainNumber) };
  }

  return {
    hasX: true,
    varTerm: operator ? { operator: operator as '*' | '/', factor: Number(factor) } : null,
    constant: sign ? (sign === '+' ? 1 : -1) * Number(addedNumber) : 0,
  };
}

function parseEquation(prompt: string): Equation {
  const sides = prompt.split(' = ');
  if (sides.length !== 2) {
    throw new Error(`prompt does not have exactly one "=": "${prompt}"`);
  }

  return { left: parseSide(sides[0]), right: parseSide(sides[1]) };
}

function varTerms({ left, right }: Equation): VarTerm[] {
  return [left.varTerm, right.varTerm].filter((term): term is VarTerm => term !== null);
}

function evaluateSide(side: Side, x: number): number {
  if (!side.hasX) return side.constant;

  const { varTerm } = side;
  const xValue = varTerm === null ? x : varTerm.operator === '*' ? x * varTerm.factor : x / varTerm.factor;

  return xValue + side.constant;
}

/**
 * coefficient of x in a side as an exact fraction (x * f -> f / 1, x / f -> 1 / f)
 */
function coefficient(side: Side): { numerator: number; denominator: number } {
  if (side.varTerm === null) return { numerator: 1, denominator: 1 };

  const { operator, factor } = side.varTerm;
  return operator === '*' ? { numerator: factor, denominator: 1 } : { numerator: 1, denominator: factor };
}

function generateQuestions(difficulty: Difficulty, count: number = ITERATIONS): Question[] {
  return Array.from({ length: count }, () => getQuestionOfDifficulty(difficulty));
}

/**
 * which question difficulty a prompt's format corresponds to
 */
function classifyPrompt(prompt: string): Difficulty {
  if (HARD_PATTERN.test(prompt)) return Difficulty.Hard;
  if (MEDIUM_PATTERN.test(prompt)) return Difficulty.Medium;
  if (EASY_FACTOR_PATTERN.test(prompt) || EASY_ADDITION_PATTERN.test(prompt)) return Difficulty.Easy;

  throw new Error(`prompt matches no difficulty's format: "${prompt}"`);
}

describe('DIFFICULTY_WEIGHTS', () => {
  it.each(DIFFICULTIES)('has non-negative weights that add up to 1 (%s)', (_name, difficulty) => {
    const weights = DIFFICULTY_WEIGHTS[difficulty];

    for (const weight of weights) {
      expect(weight).toBeGreaterThanOrEqual(0);
    }
    expect(weights[0] + weights[1] + weights[2]).toBeCloseTo(1);
  });
});

describe('pickDifficulty', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function pickWithRoll(weights: readonly [number, number, number], roll: number): Difficulty {
    vi.spyOn(Math, 'random').mockReturnValue(roll);
    return pickDifficulty(weights);
  }

  it('picks Easy, Medium or Hard depending on which weight band the roll lands in', () => {
    const weights = [0.2, 0.6, 0.2] as const;

    expect(pickWithRoll(weights, 0)).toBe(Difficulty.Easy);
    expect(pickWithRoll(weights, 0.1)).toBe(Difficulty.Easy);
    expect(pickWithRoll(weights, 0.5)).toBe(Difficulty.Medium);
    expect(pickWithRoll(weights, 0.9)).toBe(Difficulty.Hard);
    expect(pickWithRoll(weights, 0.999)).toBe(Difficulty.Hard);
  });

  it('never picks a difficulty with a weight of 0', () => {
    expect(pickWithRoll([1, 0, 0], 0.999)).toBe(Difficulty.Easy);
    expect(pickWithRoll([0, 1, 0], 0.999)).toBe(Difficulty.Medium);
    expect(pickWithRoll([0, 0, 1], 0.001)).toBe(Difficulty.Hard);
  });

  it.each(DIFFICULTIES)('picks each difficulty for the middle of its band in DIFFICULTY_WEIGHTS (%s)', (_name, difficulty) => {
    const [easy, medium, hard] = DIFFICULTY_WEIGHTS[difficulty];

    expect(pickWithRoll(DIFFICULTY_WEIGHTS[difficulty], easy / 2)).toBe(Difficulty.Easy);
    expect(pickWithRoll(DIFFICULTY_WEIGHTS[difficulty], easy + medium / 2)).toBe(Difficulty.Medium);
    expect(pickWithRoll(DIFFICULTY_WEIGHTS[difficulty], easy + medium + hard / 2)).toBe(Difficulty.Hard);
  });
});

describe('getQuestion', () => {
  it('throws a RangeError for an unknown difficulty', () => {
    expect(() => getQuestion(3 as Difficulty)).toThrow(RangeError);
    expect(() => getQuestion(-1 as Difficulty)).toThrow(RangeError);
  });

  it.each(DIFFICULTIES)('returns questions that solve correctly (%s)', (_name, difficulty) => {
    for (let i = 0; i < ITERATIONS; i++) {
      const question = getQuestion(difficulty);
      const { left, right } = parseEquation(question.prompt);
      const x = Number(question.answer);

      expect(evaluateSide(left, x), question.prompt).toBe(evaluateSide(right, x));
    }
  });

  // every weight is at least 0.05, so missing one in 1000 tries has a chance of about 0.95^1000 ≈ 5e-23
  it.each(DIFFICULTIES)('mixes easy, medium and hard questions (%s)', (_name, difficulty) => {
    const generated = new Set(Array.from({ length: ITERATIONS }, () => classifyPrompt(getQuestion(difficulty).prompt)));

    expect(generated).toEqual(new Set([Difficulty.Easy, Difficulty.Medium, Difficulty.Hard]));
  });
});

describe('getQuestionOfDifficulty', () => {
  describe.each(DIFFICULTIES)('at every difficulty (%s)', (_name, difficulty) => {
    it('returns a prompt and an answer as strings', () => {
      const question = getQuestion(difficulty);

      expect(typeof question.prompt).toBe('string');
      expect(typeof question.answer).toBe('string');
    });

    it('returns an answer that is a non-zero integer within the range', () => {
      for (const question of generateQuestions(difficulty)) {
        const answer = Number(question.answer);

        expect(Number.isInteger(answer), `answer "${question.answer}"`).toBe(true);
        expect(answer).not.toBe(0);
        expect(Math.abs(answer)).toBeLessThanOrEqual(ANSWER_RANGE);
      }
    });

    it('returns an answer that solves the equation in the prompt', () => {
      for (const question of generateQuestions(difficulty)) {
        const { left, right } = parseEquation(question.prompt);
        const x = Number(question.answer);

        expect(evaluateSide(left, x), question.prompt).toBe(evaluateSide(right, x));
      }
    });

    it('never uses a factor of 0, 1 or -1', () => {
      for (const question of generateQuestions(difficulty)) {
        for (const { factor } of varTerms(parseEquation(question.prompt))) {
          expect(Math.abs(factor), question.prompt).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('keeps multiplication factors within MAX_FACTOR', () => {
      for (const question of generateQuestions(difficulty)) {
        for (const { operator, factor } of varTerms(parseEquation(question.prompt))) {
          if (operator !== '*') continue;

          expect(Math.abs(factor), question.prompt).toBeLessThanOrEqual(MAX_FACTOR);
        }
      }
    });

    it('only divides by numbers that evenly divide the answer', () => {
      for (const question of generateQuestions(difficulty)) {
        for (const { operator, factor } of varTerms(parseEquation(question.prompt))) {
          if (operator !== '/') continue;

          expect(Number.isInteger(Number(question.answer) / factor), question.prompt).toBe(true);
        }
      }
    });

    it('generates both multiplication and division questions', () => {
      const operators = new Set(
        generateQuestions(difficulty).flatMap((question) =>
          varTerms(parseEquation(question.prompt)).map((term) => term.operator)
        )
      );

      expect(operators).toEqual(new Set(['*', '/']));
    });

    it('generates both positive and negative answers', () => {
      const answers = generateQuestions(difficulty).map((question) => Number(question.answer));

      expect(answers.some((answer) => answer > 0)).toBe(true);
      expect(answers.some((answer) => answer < 0)).toBe(true);
    });
  });

  describe('Easy (one step)', () => {
    it('formats the prompt as "x (* or /) factor = number" or "x (+ or -) number = number"', () => {
      for (const { prompt } of generateQuestions(Difficulty.Easy)) {
        const isFactorForm = EASY_FACTOR_PATTERN.test(prompt);
        const isAdditionForm = EASY_ADDITION_PATTERN.test(prompt);

        expect(isFactorForm || isAdditionForm, prompt).toBe(true);
      }
    });

    it('generates both the factor form and the addition form', () => {
      const prompts = generateQuestions(Difficulty.Easy).map((question) => question.prompt);

      expect(prompts.some((prompt) => EASY_FACTOR_PATTERN.test(prompt))).toBe(true);
      expect(prompts.some((prompt) => EASY_ADDITION_PATTERN.test(prompt))).toBe(true);
    });

    it('never adds or subtracts 0 in the addition form', () => {
      for (const { prompt } of generateQuestions(Difficulty.Easy)) {
        if (!EASY_ADDITION_PATTERN.test(prompt)) continue;

        expect(parseEquation(prompt).left.constant, prompt).not.toBe(0);
      }
    });

    it('only has x on the left side', () => {
      for (const { prompt } of generateQuestions(Difficulty.Easy)) {
        expect(parseEquation(prompt).right.hasX, prompt).toBe(false);
      }
    });
  });

  describe('Medium (two steps)', () => {
    it('formats the prompt as "x (* or /) factor (+ or -) number = number"', () => {
      for (const { prompt } of generateQuestions(Difficulty.Medium)) {
        expect(prompt).toMatch(MEDIUM_PATTERN);
      }
    });

    it('never adds or subtracts 0', () => {
      for (const { prompt } of generateQuestions(Difficulty.Medium)) {
        expect(parseEquation(prompt).left.constant, prompt).not.toBe(0);
      }
    });
  });

  describe('Hard (three or more steps)', () => {
    it('formats the prompt as "x (* or /) factor (+ or -) number = x (* or /) factor (+ or -) number"', () => {
      for (const { prompt } of generateQuestions(Difficulty.Hard)) {
        expect(prompt).toMatch(HARD_PATTERN);
      }
    });

    it('never adds or subtracts 0 on either side', () => {
      for (const { prompt } of generateQuestions(Difficulty.Hard)) {
        const { left, right } = parseEquation(prompt);

        expect(left.constant, prompt).not.toBe(0);
        expect(right.constant, prompt).not.toBe(0);
      }
    });

    it('never has x terms that combine into x * 0, x * 1 or x * -1', () => {
      for (const { prompt } of generateQuestions(Difficulty.Hard)) {
        const { left, right } = parseEquation(prompt);
        const a = coefficient(left);
        const b = coefficient(right);

        // a - b as an exact fraction
        const numerator = a.numerator * b.denominator - b.numerator * a.denominator;
        const denominator = a.denominator * b.denominator;

        expect(numerator, `${prompt} combines to x * 0`).not.toBe(0);
        expect(Math.abs(numerator), `${prompt} combines to x * ±1`).not.toBe(Math.abs(denominator));
      }
    });

    it('generates both same-operator and mixed-operator x terms', () => {
      const pairs = generateQuestions(Difficulty.Hard).map((question) => {
        const { left, right } = parseEquation(question.prompt);
        return left.varTerm?.operator === right.varTerm?.operator ? 'same' : 'mixed';
      });

      expect(new Set(pairs)).toEqual(new Set(['same', 'mixed']));
    });
  });
});
