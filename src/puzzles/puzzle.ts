import type { StepAnswer } from '../questions/Question'

export default interface Puzzle {
  onAnswer?: (answer: StepAnswer) => void;
  onPuzzleFinished?: (solved: boolean) => void;
  destroy(): void;
}
