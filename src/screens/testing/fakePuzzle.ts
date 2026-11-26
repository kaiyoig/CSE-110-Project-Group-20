/**
 * Fake puzzles for screen tests. The default export stands in for
 * BasicMultistepPuzzle; `fakePuzzleOf(type)` makes stand-ins for the others:
 *
 *   vi.mock("../puzzles/basic-multistep-puzzle", () => import("./testing/fakePuzzle"));
 *   vi.mock("../puzzles/power-box-puzzle", async () =>
 *     ({ default: (await import("./testing/fakePuzzle")).fakePuzzleOf("powerBox") }));
 *
 * Every fake goes into `created`, in the order it was built.
 */
import type { StepAnswer } from "../../questions/Question";

export const created: FakePuzzle[] = [];

export class FakePuzzle {
  /** Which puzzle this stands in for (a RoomPuzzle type). */
  type = "multistep";
  destroyed = false;
  /** Set by `holdAnswer`: what `sendPendingAnswer` sends. */
  pending: StepAnswer | null = null;
  interactionEnabled = true;
  onAnswer?: (answer: StepAnswer) => void;
  onPuzzleFinished?: (solved: boolean) => void;

  /**
   * @param source What the puzzle was built from: the equation for a multistep
   *   puzzle, the pairs for a Power Box, the Questions for a Laser Match.
   */
  constructor(readonly source: unknown, readonly options: Record<string, unknown>) {
    created.push(this);
  }

  destroy(): void {
    this.destroyed = true;
  }

  setInteractionEnabled(enabled: boolean): void {
    this.interactionEnabled = enabled;
  }

  /** Simulates a puzzle holding its last Answer back (like the multistep room). */
  holdAnswer(answer: StepAnswer): void {
    this.pending = answer;
  }

  sendPendingAnswer(): void {
    const answer = this.pending;
    this.pending = null;
    if (answer) this.onAnswer?.(answer);
  }

  /** Simulates the player answering a Step. */
  answer(answer: StepAnswer): void {
    this.onAnswer?.(answer);
  }
}

/** A FakePuzzle class whose instances report `type`. */
export function fakePuzzleOf(type: string): typeof FakePuzzle {
  return class extends FakePuzzle {
    override type = type;
  };
}

export default FakePuzzle;
