import type { StepAnswer } from '../questions/Question'

export default interface Puzzle {
  onAnswer?: (answer: StepAnswer) => void;
  onPuzzleFinished?: (solved: boolean) => void;
  /** Suspend external controls (such as HTML inputs) while a screen modal covers the canvas. */
  setInteractionEnabled?(enabled: boolean): void;
  /**
   * Sends any Answer the puzzle is still holding back (the multistep room
   * keeps its last one while it shows the solved answer), so leaving the Room
   * early never loses it.
   */
  sendPendingAnswer?(): void;
  destroy(): void;
}
