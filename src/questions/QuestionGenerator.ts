import { Question } from "./Question";
import { type Difficulty } from "../score";

const ANSWER_RANGE: number = 20; // answers can range from -RANGE to +RANGE
const MAX_FACTOR: number = 10; // factors can range from 2 to MAX_FACTOR

/**
 * helper functions for getting random numbers for question generation
 */
function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomSign(): 1 | -1 {
  return Math.random() > 0.5 ? 1 : -1;
}

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomNonZero(range: number): number {
  return randomInt(1, range) * randomSign();
}

/**
 * randomly generate a divisor, other than one, such that dividend / divisor is an integer
 */
function getRandomDivisor(dividend: number): number {
  const rawFactors: number[] = getFactors(dividend);

  // cut one from the factors
  const factors: number[] = rawFactors.filter(factor => factor !== 1);

  return randomChoice(factors);
}

/**
 * get a list of all of the factors of a positive number (explanation: https://pynative.com/python-find-all-divisors-of-number/)
 */
function getFactors(n: number) : number[] {
  const factors: number[] = [];

  let d = 1;
  while (d * d <= n) {
    if (n % d === 0) {
      factors.push(d);
      if (d !== n / d) {
          factors.push(n / d);
      }
    }
    d++;
  }

  return factors;
}

/**
 * question parts interface: contains every part a full hard question needs
 * x (leftOperation: * or /) (leftFactor) (+ or -) (addedNumber) = x (rightOperation) (rightFactor) (+ or -) (rightNumber)
 */
interface QuestionParts{
  answerValue: number;
  isMultiplication: boolean;
  factor: number;
  addedNumber: number;
  isMultiplicationRight: boolean;
  rightFactor: number;
  rightNumber: number;
}

/**
 * generate QuestionParts that can be used to create a question prompt for any difficulty
 */
function generateParts(): QuestionParts {
  // TODO
}

/**
 * builds the prompt for a difficulty out of QuestionParts
 */
function formatPrompt(parts: QuestionParts, difficulty: Difficulty): string {
  // TODO
}

/**
 * randomly generates and returns a Question
 *
 * Easy: 1 step to solve, e.g. x * 3 = 21, x + 4 = 5
 *
 * Medium: 2 steps to solve, e.g. x * 3 + 4 = 25
 *
 * Hard: 3+ steps to solve, e.g. x * 5 + 4 = 25 + x * 2
 *
 * @param difficulty: Difficulty.Easy / Medium / Hard (from score)
 * 
 * @return a Question with a prompt in the format x (* or /) (factor) (+ or -) (addedNumber) = (right hand side number)
 */
export function getQuestion(difficulty: Difficulty): Question {
  const parts: QuestionParts = generateParts();

  return { prompt: formatPrompt(parts, difficulty), answer: String(parts.answerValue) };
}
