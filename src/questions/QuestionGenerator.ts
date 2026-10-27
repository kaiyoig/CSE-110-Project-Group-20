import { Question } from "./Question";

const RANGE: number = 20; // answers can range from -RANGE to +RANGE

/**
 * randomly generate a non-zero number in a specified inclusive range
 *
 * @param range - maximum absolute value of generated number
 *
 * @returns a non-zero number in the range [-range, range]
 */
function getRandomNumber(range: number): number {
  const raw: number = Math.floor(Math.random() * range) + 1;
  const isPositive: boolean = Math.random() > 0.5;

  return isPositive ? raw : -raw;
}

/**
 * randomly generate a divisor, other than one, such that dividend / divisor is an integer
 *
 * @param dividend - number from which divisor should be derived from
 *
 * @returns a divisor such that dividend / divisor is an integer
 */
function getRandomDivisor(dividend: number): number {
  const rawFactors: number[] = getFactors(dividend);

  // cut one from the factors
  const factors: number[] = rawFactors.filter(factor => factor !== 1);
  
  const randomIndex: number = Math.floor(Math.random() * factors.length);

  return factors[randomIndex];
}

/**
 * get a list of all of the factors of a positive number (explanation: https://pynative.com/python-find-all-divisors-of-number/)
 *
 * @param n: the number which should be factored
 *
 * @return list of factors of n; unsorted
 */
function getFactors(n: number) : number[] {
  let factors: number[] = [];

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
 * randomly generates and returns a Question
 * @todo change question generation based on difficulty; higher difficulty = more steps
 *
 * @param difficulty: 0 = easy, 1 = medium, 2 = hard
 * 
 * @return a Question with a prompt in the format x (* or /) (factor) (+ or -) (addedNumber) = (right hand side number)
 */
export function getQuestion(difficulty: number): Question {
  // generate answer
  const answerValue: number = getRandomNumber(RANGE);

  // if answer value is +/- 1, take multiplication route instead
  const isMultiplication: boolean = Math.abs(answerValue) === 1 || Math.random() > 0.5;
  let factor: number = 1;
  if (isMultiplication) {
    while (factor === 1) {
      factor = getRandomNumber(RANGE);
    }
  } else {
    factor = getRandomDivisor(Math.abs(answerValue));
  }
  const addedNumber = getRandomNumber(RANGE);

  const rightHandSide = (isMultiplication ? answerValue * factor : answerValue / factor) + addedNumber;

  // format prompt
  // x (* or /) (factor) (+ or -) (addedNumber) = (right hand side number)
  const formattedPrompt: string = `x ${isMultiplication ? '*' : '/'} ${factor} ${addedNumber > 0 ? '+' : '-'} ${Math.abs(addedNumber)} = ${rightHandSide}`;

  return {prompt: formattedPrompt, answer: String(answerValue)}
}
