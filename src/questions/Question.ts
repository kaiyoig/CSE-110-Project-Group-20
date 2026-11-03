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
}
