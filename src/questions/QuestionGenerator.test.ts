import { describe, it, expect } from 'vitest';
import { getQuestion } from './QuestionGenerator';
import { Question } from './Question';

const RANGE = 20; // must match RANGE in QuestionGenerator.ts
const ITERATIONS = 1000;

// x (* or /) (factor) (+ or -) (addedNumber) = (right hand side number)
const PROMPT_PATTERN = /^x ([*/]) (-?\d+) ([+-]) (\d+) = (-?\d+)$/;

interface ParsedPrompt {
  operator: string;
  factor: number;
  sign: string;
  addedNumber: number;
  rightHandSide: number;
}

function parsePrompt(prompt: string): ParsedPrompt {
  const match = prompt.match(PROMPT_PATTERN);
  if (!match) {
    throw new Error(`prompt is not in the expected format: "${prompt}"`);
  }

  return {
    operator: match[1],
    factor: Number(match[2]),
    sign: match[3],
    addedNumber: Number(match[4]),
    rightHandSide: Number(match[5]),
  };
}

function generateQuestions(count: number): Question[] {
  return Array.from({ length: count }, () => getQuestion(1));
}

describe('getQuestion', () => {
  it('returns a prompt and an answer as strings', () => {
    const question = getQuestion(1);

    expect(typeof question.prompt).toBe('string');
    expect(typeof question.answer).toBe('string');
  });

  it('returns an answer that is a non-zero integer within the range', () => {
    for (const question of generateQuestions(ITERATIONS)) {
      const answer = Number(question.answer);

      expect(Number.isInteger(answer), `answer "${question.answer}"`).toBe(true);
      expect(answer).not.toBe(0);
      expect(Math.abs(answer)).toBeLessThanOrEqual(RANGE);
    }
  });

  it('formats the prompt as "x (* or /) factor (+ or -) number = number"', () => {
    for (const question of generateQuestions(ITERATIONS)) {
      expect(question.prompt).toMatch(PROMPT_PATTERN);
    }
  });

  it('never uses a factor of zero', () => {
    for (const question of generateQuestions(ITERATIONS)) {
      const { factor } = parsePrompt(question.prompt);

      expect(factor, question.prompt).not.toBe(0);
    }
  });

  it('only divides by numbers that evenly divide the answer', () => {
    for (const question of generateQuestions(ITERATIONS)) {
      const { operator, factor } = parsePrompt(question.prompt);
      if (operator !== '/') continue;

      expect(Number.isInteger(Number(question.answer) / factor), question.prompt).toBe(true);
    }
  });

  it('returns an answer that solves the equation in the prompt', () => {
    for (const question of generateQuestions(ITERATIONS)) {
      const { operator, factor, sign, addedNumber, rightHandSide } = parsePrompt(question.prompt);
      const x = Number(question.answer);

      const product = operator === '*' ? x * factor : x / factor;
      const leftHandSide = sign === '+' ? product + addedNumber : product - addedNumber;

      expect(leftHandSide, question.prompt).toBe(rightHandSide);
    }
  });

  it('generates both multiplication and division questions', () => {
    const operators = new Set(
      generateQuestions(ITERATIONS).map((question) => parsePrompt(question.prompt).operator)
    );

    expect(operators).toEqual(new Set(['*', '/']));
  });

  it('generates both positive and negative answers', () => {
    const answers = generateQuestions(ITERATIONS).map((question) => Number(question.answer));

    expect(answers.some((answer) => answer > 0)).toBe(true);
    expect(answers.some((answer) => answer < 0)).toBe(true);
  });
});
