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
 * returns a random factor depending on operation
 * multipliation: any factor from 2 to MAX_FACTOR works
 * division: a divisor (other than one) of the answer value so that x / factor = whole number
 */
function randomFactor(answerValue: number, isMultiplication: boolean): number {
  const factor: number = isMultiplication ? randomInt(2, MAX_FACTOR) : getRandomDivisor(Math.abs(answerValue));
  return randomSign() * factor;
}

/**
 * determines whether or not the variable terms combine such that
 * the remaining term is not x * 1 or x * 0
 *
 * if one multiplication, one division:
 * will never combine to form x * 1 or x * 0
 *
 * if both multiplication:
 * x * a and x * b must differ by at least 2, or combining them leaves x * 1 or x * 0
 *
 * if both division:
 * check difference of factor and rightFactor, and make sure it's not 0
 *
 * x / a - x / b = x * (b - a) / (a * b), so b - a can't be 0 (x * 0)
 * and |b - a| can't equal |a * b| (x * 1 or x * -1, e.g. x / 2 - x / -2 = x)
 */
function canCombineVarTerms(answerValue: number, isMultiplication: boolean, factor: number, isMultiplicationRight: boolean, rightFactor: number): boolean {
  if (isMultiplication !== isMultiplicationRight) return true;

  const difference: number = Math.abs(factor - rightFactor);

  if (isMultiplication) return difference >= 2;

  return difference !== 0 && difference !== Math.abs(factor * rightFactor);
}

/**
 * return the value of x (* or /) factor
 */
export function applyFactor(answerValue: number, isMultiplication: boolean, factor: number): number {
  return isMultiplication ? answerValue * factor : answerValue / factor;
}

/**
 * generate QuestionParts that can be used to create a question prompt for any difficulty
 */
export function generateParts(): QuestionParts {
  // generate answer
  const answerValue: number = randomNonZero(ANSWER_RANGE);

  // if answer value is +/- 1, take multiplication route instead (x / 1 is trivial)
  const canDivide: boolean = Math.abs(answerValue) !== 1;
  const isMultiplication: boolean = !canDivide || Math.random() > 0.5;
  const factor: number = randomFactor(answerValue, isMultiplication);

  // deciding variable term on right hand side
  let isMultiplicationRight: boolean;
  let rightFactor: number;
  // try until it works
  do {
    isMultiplicationRight = !canDivide || Math.random() > 0.5;
    rightFactor = randomFactor(answerValue, isMultiplicationRight);
  } while (!canCombineVarTerms(answerValue, isMultiplication, factor, isMultiplicationRight, rightFactor));

  // the added number on the RHS should be equal to leftTerm + addedNumber - rightTerm
  // to make hard questions same number of steps, should != 0, but we could change this if we want

  const leftTerm: number = applyFactor(answerValue, isMultiplication, factor);
  const rightTerm: number = applyFactor(answerValue, isMultiplicationRight, rightFactor);
  let addedNumber: number;
  let rightNumber: number;
  do {
    addedNumber = randomNonZero(ANSWER_RANGE);
    rightNumber = leftTerm + addedNumber - rightTerm;
  } while (rightNumber === 0);

  return { answerValue, isMultiplication, factor, addedNumber, isMultiplicationRight, rightFactor, rightNumber };
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
