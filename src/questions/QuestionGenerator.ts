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
 * randomly generates and returns a Question
 */
export function getQuestion(difficulty: number): Question {
  // generate answer
  const answerValue: number = getRandomNumber(RANGE);
}
