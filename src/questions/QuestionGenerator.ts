import { Question } from "./Question";

const RANGE: number = 20; // answers can range from -RANGE to +RANGE

function generateRandomAnswer(range: number): number {
  return Math.floor(Math.random() * (2 * range + 1)) - range;
}

// question generator
export function getQuestion(difficulty: number): Question {
  // generate answer
  let answerValue: number = generateRandomAnswer(RANGE);

  // modify answer with difficulty number steps to generate prompt

  
  // format prompt and answer

  return { prompt: "Example Prompt", answer: "Example Answer" };
}
