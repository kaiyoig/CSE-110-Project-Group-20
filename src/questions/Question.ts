export interface Question {
  prompt: string;
  answer: string;
}

/**
 * The player's Answer to one Step of a Question, as judged by the puzzle.
 * For an operation pick, the answers are the operator symbols.
 */
export interface StepAnswer {
  playerAnswer: string;
  correctAnswer: string;
  /** True for the Step that solves the Question. */
  isLastStep: boolean;
  stepPrompt?: string;
  /** True only for arithmetic answers from the multistep solver puzzle. */
  isMultistepArithmetic?: boolean;
  /**
   * The Question this Answer is for, when a puzzle has several (Power Box,
   * Laser Match: one per pair). Left out, the Answer is for the Room's Question.
   */
  question?: Question;
  /**
   * True when a correct Answer finishes the Room's whole puzzle. Left out, it
   * follows `isLastStep` (a Room with one Question is solved with it).
   */
  solvesRoom?: boolean;
}

/** Whether a correct `answer` solves the Room it was given in. */
export function solvesRoom(answer: StepAnswer): boolean {
  return answer.solvesRoom ?? answer.isLastStep;
}
