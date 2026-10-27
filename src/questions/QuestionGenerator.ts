import { Question } from "./Question";

const RANGE: number = 20; // answers can range from -RANGE to +RANGE

/**
 * randomly generate a non-zero number in a specified inclusive range
 */
function getRandomNumber(range: number): number {
  const raw: number = Math.ceil(Math.random() * range);
  const isPositive: boolean = Math.random() > 0.5;

  return isPositive ? raw : -raw;
}

/**
 * randomly generate a divisor such that dividend / divisor is an integer
 */
function getRandomDivisor(dividend: number): number {
  const factors: number[] = getFactors(dividend);
  const randomIndex: number = Math.floor(Math.random() * factors.length);

  return factors[randomIndex];
}

/**
 * get a list of all of the factors of a certain number (explanation: https://pynative.com/python-find-all-divisors-of-number/)
 */
function getFactors(n: number) : number[] {
  let factors: number[] = [];

  let d = 1;
  while (d * d <= n) {
    if (n % d === 0) {
      factors.push(d)
      if (d !== n / d) {
          factors.push(n / d);
      }
    }
    d++;
  }

  return factors;
}

/**
 * randomly generates and returns a Question
 */
export function getQuestion(difficulty: number): Question {
  // generate answer
  const answerValue: number = getRandomNumber(RANGE);

  const isMultiplication: boolean = Math.random() > 0.5;
  let factor: number;
  if (isMultiplication) {
    factor = getRandomNumber(RANGE);
  } else {
    factor = getRandomDivisor(answerValue);
  }
  const multiplier = isMultiplication ? factor : 1 / factor;

  const addedNumber = getRandomNumber(RANGE);

  const rightHandSide = answerValue * multiplier + addedNumber;

  // format prompt
  // x (* or /) (factor) (+ or -) (addedNumber) = (right hand side number)
  const formattedPrompt: string = `x ${isMultiplication ? '*' : '/'} ${factor} ${addedNumber > 0 ? '+' : '-'} ${addedNumber} = ${rightHandSide}`;

  return {prompt: formattedPrompt, answer: String(answerValue)}
}
