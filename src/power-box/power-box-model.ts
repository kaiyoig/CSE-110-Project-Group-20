import type { Question, StepAnswer } from "../questions/Question";
import type { PowerBoxPair } from "./power-box-generator";

/** What happened when the player connected a wire. */
export interface MatchResult {
  correct: boolean;
  /** Sent on to AnswerValidator (via onAnswer), like every other puzzle's Step. */
  answer: StepAnswer;
  /** The Question the player was trying to answer (the left side of the wire). */
  question: Question;
}

/**
 * The state of one power box: which equation goes with which answer, and
 * which wires are already connected. No drawing here (see PowerBoxView).
 *
 * Left side = each Question's equation (prompt), in `pairs` order.
 * Right side = each Question's answer, in `rightOrder` order (indexes into `pairs`).
 * Each connection attempt is one Step. The Step that connects the last wire
 * is the last Step, which solves the Room.
 */
export class PowerBoxModel {
  private readonly pairs: readonly PowerBoxPair[];
  private readonly rightOrder: readonly number[];
  private readonly matchedLeft = new Set<number>();

  constructor(pairs: readonly PowerBoxPair[], rightOrder: readonly number[]) {
    if (pairs.length === 0) throw new RangeError("A power box needs at least one pair");
    const answers = pairs.map((pair) => pair.question.answer.trim());
    if (new Set(answers).size !== answers.length) {
      throw new RangeError("Every pair needs a different answer, so each equation has one match");
    }
    const sorted = [...rightOrder].sort((a, b) => a - b);
    if (sorted.length !== pairs.length || sorted.some((value, index) => value !== index)) {
      throw new RangeError("rightOrder must list every pair exactly once");
    }
    this.pairs = pairs;
    this.rightOrder = rightOrder;
  }

  get size(): number {
    return this.pairs.length;
  }

  /** Left column, top to bottom: the equations. */
  equations(): string[] {
    return this.pairs.map((pair) => pair.question.prompt);
  }

  /** Right column, top to bottom: the answers, shuffled. */
  answers(): string[] {
    return this.rightOrder.map((pairIndex) => this.pairs[pairIndex].question.answer.trim());
  }

  /** The Question on left-side row `left`. */
  questionAt(left: number): Question {
    this.checkIndex(left);
    return this.pairs[left].question;
  }

  /** The right-side row that holds the answer for left-side row `left`. */
  correctRightFor(left: number): number {
    this.checkIndex(left);
    return this.rightOrder.indexOf(left);
  }

  isLeftMatched(left: number): boolean {
    this.checkIndex(left);
    return this.matchedLeft.has(left);
  }

  isRightMatched(right: number): boolean {
    this.checkIndex(right);
    return this.matchedLeft.has(this.rightOrder[right]);
  }

  get matchedCount(): number {
    return this.matchedLeft.size;
  }

  /** All wires connected: the security system is off. */
  isFinished(): boolean {
    return this.matchedCount === this.size;
  }

  /**
   * Tries to connect left row `left` to right row `right`. A correct match
   * stays connected; a wrong one changes nothing (the time penalty comes from
   * AnswerValidator). Connecting a wire that is already connected is a bug in
   * the caller, so it throws.
   */
  match(left: number, right: number): MatchResult {
    if (this.isLeftMatched(left) || this.isRightMatched(right)) {
      throw new Error("That wire is already connected");
    }
    const isLastStep = this.matchedCount === this.size - 1;
    const correct = this.rightOrder[right] === left;
    if (correct) this.matchedLeft.add(left);

    return {
      correct,
      question: this.pairs[left].question,
      answer: {
        playerAnswer: this.answers()[right],
        correctAnswer: this.pairs[left].question.answer.trim(),
        isLastStep,
      },
    };
  }

  private checkIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new RangeError(`No row ${index} on this power box`);
    }
  }
}
