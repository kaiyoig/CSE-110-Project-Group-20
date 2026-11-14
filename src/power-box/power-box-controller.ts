import type { Question, StepAnswer } from "../questions/Question";
import type { PowerBoxModel } from "./power-box-model";
import type { PowerBoxViewLike } from "./power-box-view";

/**
 * Connects the power box model to its view. The player presses a left plug
 * (an equation), then a right plug (an answer):
 *  - correct → the wire stays connected and one more security light turns green
 *  - wrong   → the answer flashes red and nothing is connected
 * Dropping a cable on empty space just cancels it (no Step, no penalty).
 * Every try is one Step and goes to `onAnswer`; the Room's AnswerValidator
 * turns a wrong one into the time penalty. When every wire is connected,
 * security goes offline and `onFinished` fires.
 */
export class PowerBoxController {
  /** Every try, with the Question it was for (so history can show the right equation). */
  onAnswer?: (answer: StepAnswer, question: Question) => void;
  onFinished?: () => void;

  private readonly model: PowerBoxModel;
  private readonly view: PowerBoxViewLike;
  private selected: number | null = null;

  constructor(model: PowerBoxModel, view: PowerBoxViewLike) {
    this.model = model;
    this.view = view;
    view.onLeftPressed = (left) => this.selectLeft(left);
    view.onRightPressed = (right) => this.tryRight(right);
    view.onCancel = () => this.cancel();
    view.render(model.equations(), model.answers());
  }

  /** The left row waiting for a value, or null. */
  get selectedLeft(): number | null {
    return this.selected;
  }

  selectLeft(left: number): void {
    if (this.model.isFinished() || this.model.isLeftMatched(left)) return;
    this.selected = left;
    this.view.setSelected(left);
  }

  /** Drops the selected cable without trying it (no Step, no penalty). */
  cancel(): void {
    this.selected = null;
    this.view.setSelected(null);
  }

  tryRight(right: number): void {
    if (this.selected === null || this.model.isRightMatched(right)) return;

    const left = this.selected;
    const result = this.model.match(left, right);
    if (result.correct) {
      this.view.connect(left, right);
      this.view.setSecurity(this.model.matchedCount, this.model.size);
    } else {
      this.view.showWrong(right);
    }
    this.selected = null;
    this.view.setSelected(null);

    this.onAnswer?.(result.answer, result.question);
    if (this.model.isFinished()) this.onFinished?.();
  }

  destroy(): void {
    this.onAnswer = undefined;
    this.onFinished = undefined;
    this.view.onLeftPressed = undefined;
    this.view.onRightPressed = undefined;
    this.view.onCancel = undefined;
  }
}
